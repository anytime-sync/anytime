import { beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({
  inbound: vi.fn(),
  push: vi.fn(),
  drain: vi.fn(),
  token: vi.fn(),
}));
vi.mock('./calendar-sync', () => ({ syncUserCalendar: f.inbound }));
vi.mock('./calendar-write', () => ({
  pushPendingTasksForUser: f.push,
  drainCalendarDeletions: f.drain,
}));
vi.mock('./calendar-token', () => ({ getValidAccessToken: f.token }));
import { syncCalendarNow } from './calendar-sync-now';
import { fixtureDatabase } from './__fixtures__/worldwide/calendar';
beforeEach(() => {
  vi.resetAllMocks();
  f.inbound.mockResolvedValue({ status: 'ok', count: 1, tasks_updated: 1 });
  f.push.mockResolvedValue({ created: 1, patched: 2, failed: 0, conflicts: 0 });
  f.drain.mockResolvedValue({ deleted: 1, failed: 0 });
  f.token.mockResolvedValue('fixture-token');
});
it('Sync now runs both directions and only this user’s deletions', async () => {
  const db = fixtureDatabase();
  expect(await syncCalendarNow(db.db, 'owner')).toMatchObject({
    ok: true,
    inbound: { tasks_updated: 1 },
    outbound: { created: 1, patched: 2 },
    pending: 0,
    conflicts: 0,
  });
  expect(f.drain).toHaveBeenCalledWith({ supabase: db.db, userId: 'owner' });
});
it('partial inbound success plus outbound failure reports both, with pending/conflicts', async () => {
  const db = fixtureDatabase([
    {
      id: 'task',
      user_id: 'owner',
      calendar_dirty: true,
      calendar_event_id: 'event',
      calendar_conflict: { reason: 'fixture' },
    },
  ]);
  f.inbound.mockResolvedValue({
    status: 'error',
    count: 2,
    tasks_updated: 1,
    error: 'page_two_failed',
  });
  f.push.mockRejectedValue(new Error('503'));
  expect(await syncCalendarNow(db.db, 'owner')).toMatchObject({
    ok: false,
    inbound: { count: 2, tasks_updated: 1 },
    outbound: { error: '503' },
    pending: 1,
    conflicts: 1,
  });
});
it('unavailable status counts remain unknown instead of claiming completion', async () => {
  const db = fixtureDatabase();
  db.state.fail = 'tasks:read';
  expect(await syncCalendarNow(db.db, 'owner')).toMatchObject({
    ok: false,
    pending: null,
    conflicts: null,
    error: 'fixture_db_failure',
  });
});

it('unscheduled, completed and child rows without a mirror are not pending Calendar work', async () => {
  const db = fixtureDatabase([
    {
      id: 'unscheduled',
      user_id: 'owner',
      calendar_dirty: true,
      is_completed: false,
    },
    {
      id: 'done',
      user_id: 'owner',
      calendar_dirty: true,
      is_completed: true,
      due_at: '2026-11-05T00:00Z',
    },
    {
      id: 'child',
      user_id: 'owner',
      calendar_dirty: true,
      is_completed: false,
      parent_id: 'parent',
      due_at: '2026-11-05T00:00Z',
    },
  ]);
  expect(await syncCalendarNow(db.db, 'owner')).toMatchObject({
    ok: true,
    pending: 0,
  });
});

it('unexpected inbound failure still runs outbound and reports the failure', async () => {
  const db = fixtureDatabase();
  f.inbound.mockRejectedValue(new Error('fixture_transport'));
  expect(await syncCalendarNow(db.db, 'owner')).toMatchObject({
    ok: false,
    inbound: { status: 'error', error: 'fixture_transport' },
    outbound: { created: 1 },
  });
  expect(f.push).toHaveBeenCalledTimes(1);
});
