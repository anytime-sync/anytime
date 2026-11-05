import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  token: vi.fn(),
  create: vi.fn(),
  patch: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('./google-calendar', () => ({
  listCalendarEvents: mocks.list,
  getCalendarEvent: mocks.get,
  createCalendarEvent: mocks.create,
  patchCalendarEvent: mocks.patch,
  deleteCalendarEvent: mocks.remove,
}));
vi.mock('./calendar-token', () => ({ getValidAccessToken: mocks.token }));
import { syncUserCalendar } from './calendar-sync';
import { buildEventInput } from './calendar-write';
import { eventBaseline, sameEvent } from './calendar-reconcile';
import {
  fixtureDatabase,
  fixtureProvider,
} from './__fixtures__/worldwide/calendar';
const task = {
  id: 'task',
  user_id: 'owner',
  title: 'Task fixture',
  notes: null,
  start_at: '2026-11-05T01:00:00Z',
  due_at: '2026-11-05T02:00:00Z',
  time_kind: 'work' as const,
  is_all_day: false,
  is_completed: false,
  status: 'open',
  calendar_event_id: 'master',
  calendar_id: 'primary',
  calendar_dirty: false,
  schedule_timezone: 'Asia/Taipei',
  updated_at: '2026-10-01T00:00:00Z',
};
const run = (f: ReturnType<typeof fixtureDatabase>) =>
  syncUserCalendar({ supabase: f.db, userId: 'owner' });
let p: ReturnType<typeof fixtureProvider>;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.token.mockResolvedValue('fixture-token');
  p = fixtureProvider(mocks);
});
function linked(extra: any = {}) {
  const t = { ...task, ...extra };
  const ev = p.save({
    ...buildEventInput(t, 'Asia/Taipei'),
    id: 'master',
    status: 'confirmed',
  });
  const f = fixtureDatabase([
    { ...t, calendar_baseline: eventBaseline(ev), calendar_etag: ev.etag },
  ]);
  return { f, ev };
}
it('410 resets a bounded window without deleting missing rows or clearing the old checkpoint early', async () => {
  const f = fixtureDatabase([]);
  f.tables.user_calendar_connections[0].sync_token = 'expired';
  f.tables.calendar_events.push({ external_id: 'outside-window' });
  mocks.list
    .mockRejectedValueOnce(new Error('google_sync_token_expired'))
    .mockResolvedValueOnce({ items: [], nextSyncToken: 'fresh' });
  expect((await run(f)).status).toBe('ok');
  expect(mocks.list.mock.calls[1][0]).toMatchObject({
    syncToken: null,
    pageToken: undefined,
  });
  expect(
    Date.parse(mocks.list.mock.calls[1][0].timeMax) -
      Date.parse(mocks.list.mock.calls[1][0].timeMin),
  ).toBe(120 * 86400000);
  expect(f.tables.calendar_events).toHaveLength(1);
  expect(
    f.writes.filter((w) => w.table === 'user_calendar_connections'),
  ).toHaveLength(1);
  expect(f.tables.user_calendar_connections[0].sync_token).toBe('fresh');
});
it('failed reset persistence retains the prior checkpoint', async () => {
  const f = fixtureDatabase([]);
  f.tables.user_calendar_connections[0].sync_token = 'expired';
  f.state.fail = 'calendar_events:upsert';
  mocks.list
    .mockRejectedValueOnce(new Error('google_sync_token_expired'))
    .mockResolvedValueOnce({
      items: [{ id: 'external' }],
      nextSyncToken: 'fresh',
    });
  expect((await run(f)).status).toBe('error');
  expect(f.tables.user_calendar_connections[0].sync_token).toBe('expired');
});
it('partial page cap never advances checkpoint', async () => {
  const f = fixtureDatabase([]);
  mocks.list.mockResolvedValue({ items: [], nextPageToken: 'more' });
  expect(await run(f)).toMatchObject({
    status: 'error',
    error: 'calendar_sync_page_limit',
  });
  expect(mocks.list).toHaveBeenCalledTimes(25);
  expect(f.writes).toHaveLength(0);
});
it('page-two failure keeps successfully saved rows but no checkpoint', async () => {
  const f = fixtureDatabase([]);
  mocks.list
    .mockResolvedValueOnce({
      items: [{ id: 'one', summary: 'Fixture' }],
      nextPageToken: 'two',
    })
    .mockRejectedValueOnce(new Error('429'));
  expect(await run(f)).toMatchObject({ status: 'error', count: 1 });
  expect(f.tables.calendar_events).toHaveLength(1);
  expect(f.tables.user_calendar_connections[0].sync_token).toBeNull();
});
it('checkpoint failure or overlapping worker does not report success', async () => {
  const f = fixtureDatabase([]);
  f.state.fail = 'user_calendar_connections:update';
  mocks.list.mockResolvedValue({ items: [], nextSyncToken: 'new' });
  expect((await run(f)).status).toBe('error');
  f.state.fail = '';
  const results = await Promise.all([run(f), run(f)]);
  expect(results.map((r) => r.status).sort()).toEqual(['error', 'ok']);
});
it('verified tagged remote edit updates the same native identity and exact echo is idempotent', async () => {
  const { f, ev } = linked();
  const remote = p.save({
    ...ev,
    summary: 'Edited in Google',
    start: { dateTime: '2026-11-05T02:00:00Z', timeZone: 'Asia/Taipei' },
    end: { dateTime: '2026-11-05T03:00:00Z', timeZone: 'Asia/Taipei' },
  });
  mocks.list.mockResolvedValue({ items: [remote], nextSyncToken: 'new' });
  expect(await run(f)).toMatchObject({ status: 'ok', tasks_updated: 1 });
  expect(f.tables.tasks).toHaveLength(1);
  expect(f.tables.tasks[0]).toMatchObject({
    id: 'task',
    title: 'Edited in Google',
    start_at: '2026-11-05T02:00:00.000Z',
    calendar_dirty: false,
  });
  expect(f.tables.calendar_events).toHaveLength(0);
  expect(await run(f)).toMatchObject({ tasks_updated: 0 });
});
it('unmapped arbitrary tag is an external event, never permission to change another task', async () => {
  const { f, ev } = linked();
  mocks.list.mockResolvedValue({
    items: [{ ...ev, id: 'unrelated', summary: 'Do not overwrite' }],
    nextSyncToken: 'new',
  });
  expect((await run(f)).count).toBe(1);
  expect(f.tables.tasks[0].title).toBe(task.title);
  expect(f.db.rpc).not.toHaveBeenCalled();
});
it('mapped event with changed ownership tag stages conflict', async () => {
  const { f, ev } = linked();
  mocks.list.mockResolvedValue({
    items: [
      { ...ev, extendedProperties: { private: { firstlightTaskId: 'other' } } },
    ],
    nextSyncToken: 'new',
  });
  expect((await run(f)).conflicts).toBe(1);
  expect(f.tables.tasks[0].title).toBe(task.title);
});
it('unsent local edit survives inbound changes and is surfaced as a conflict', async () => {
  const { f, ev } = linked();
  f.edit('task', { title: 'Local' });
  mocks.list.mockResolvedValue({
    items: [{ ...ev, summary: 'Remote', etag: '"remote"' }],
    nextSyncToken: 'new',
  });
  expect((await run(f)).conflicts).toBe(1);
  expect(f.tables.tasks[0]).toMatchObject({
    title: 'Local',
    calendar_dirty: true,
    calendar_conflict: { reason: 'both_sides_changed' },
  });
});
it('unchanged remote preserves pending local edits', async () => {
  const { f, ev } = linked();
  f.edit('task', { title: 'Local' });
  mocks.list.mockResolvedValue({ items: [ev], nextSyncToken: 'new' });
  expect((await run(f)).conflicts).toBe(0);
  expect(f.tables.tasks[0].calendar_dirty).toBe(true);
});
it('remote deletion never deletes or completes a native task', async () => {
  const { f, ev } = linked();
  mocks.list.mockResolvedValue({
    items: [{ ...ev, status: 'cancelled' }],
    nextSyncToken: 'new',
  });
  expect((await run(f)).conflicts).toBe(1);
  expect(f.tables.tasks[0].is_completed).toBe(false);
});
it('recurring expansions reconcile the verified master once without moving its start to an instance', async () => {
  const { f, ev } = linked({ rrule: 'FREQ=DAILY;COUNT=3' });
  const instance = (date: string) => ({
    ...ev,
    id: 'instance-' + date,
    recurrence: undefined,
    recurringEventId: 'master',
    originalStartTime: { dateTime: date + 'T01:00:00Z' },
    start: { dateTime: date + 'T01:00:00Z' },
    end: { dateTime: date + 'T02:00:00Z' },
  });
  mocks.list.mockResolvedValue({
    items: [instance('2026-11-06'), instance('2026-11-07')],
    nextSyncToken: 'new',
  });
  expect((await run(f)).conflicts).toBe(0);
  expect(f.tables.tasks[0].start_at).toBe(task.start_at);
  expect(f.tables.tasks[0].calendar_event_id).toBe('master');
  expect(mocks.get).toHaveBeenCalledTimes(1);
});
it.each(['moved', 'cancelled', 'renamed'])(
  'unsupported %s recurring occurrence becomes conflict, never a series shift',
  async (kind) => {
    const { f, ev } = linked({ rrule: 'FREQ=DAILY;COUNT=3' });
    const instance = {
      ...ev,
      id: 'instance',
      recurrence: undefined,
      recurringEventId: 'master',
      originalStartTime: { dateTime: '2026-11-06T01:00:00Z' },
      start: {
        dateTime:
          kind === 'moved' ? '2026-11-06T03:00:00Z' : '2026-11-06T01:00:00Z',
      },
      end: { dateTime: '2026-11-06T02:00:00Z' },
      status: kind === 'cancelled' ? 'cancelled' : 'confirmed',
      summary: kind === 'renamed' ? 'Exception' : ev.summary,
    };
    mocks.list.mockResolvedValue({ items: [instance], nextSyncToken: 'new' });
    expect((await run(f)).conflicts).toBe(1);
    expect(f.tables.tasks[0]).toMatchObject({
      start_at: task.start_at,
      calendar_event_id: 'master',
      is_completed: false,
    });
  },
);
it('all-day immediate and inbound mirrors retain byte-identical dates and exclusive ends', async () => {
  const f = fixtureDatabase([]);
  const ev = {
    id: 'date',
    start: { date: '2026-11-05' },
    end: { date: '2026-11-06' },
  };
  mocks.list.mockResolvedValue({ items: [ev], nextSyncToken: 'new' });
  await run(f);
  expect(f.tables.calendar_events[0]).toMatchObject({
    start_at: '2026-11-04T16:00:00.000Z',
    end_at: '2026-11-05T16:00:00.000Z',
    raw: ev,
  });
});
it('failed native persistence prevents checkpoint advancement', async () => {
  const { f, ev } = linked();
  f.state.fail = 'rpc';
  mocks.list.mockResolvedValue({ items: [ev], nextSyncToken: 'new' });
  expect((await run(f)).status).toBe('error');
  expect(f.tables.user_calendar_connections[0].sync_token).toBeNull();
});

it('jsonb key ordering does not turn an exact echo into a conflict', async () => {
  const { f, ev } = linked();
  const reverse = (v: any): any =>
    Array.isArray(v)
      ? v.map(reverse)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .reverse()
              .map(([k, x]) => [k, reverse(x)]),
          )
        : v;
  f.tables.tasks[0].calendar_baseline = reverse(
    f.tables.tasks[0].calendar_baseline,
  );
  expect(
    sameEvent(f.tables.tasks[0].calendar_baseline, eventBaseline(ev)),
  ).toBe(true);
  mocks.list.mockResolvedValue({
    items: [{ ...ev, summary: 'Remote title' }],
    nextSyncToken: 'new',
  });
  expect(await run(f)).toMatchObject({ tasks_updated: 1, conflicts: 0 });
});
it('ordinary occurrences cannot clear an earlier exception conflict in the same pull', async () => {
  const { f, ev } = linked({ rrule: 'FREQ=DAILY;COUNT=3' });
  const normal = {
    ...ev,
    id: 'normal',
    recurrence: undefined,
    recurringEventId: 'master',
    originalStartTime: { dateTime: '2026-11-06T01:00:00Z' },
    start: { dateTime: '2026-11-06T01:00:00Z' },
    end: { dateTime: '2026-11-06T02:00:00Z' },
  };
  mocks.list.mockResolvedValue({
    items: [
      { ...normal, id: 'exception', summary: 'Changed occurrence' },
      normal,
    ],
    nextSyncToken: 'new',
  });
  expect((await run(f)).conflicts).toBe(1);
  expect(f.tables.tasks[0].calendar_conflict.reason).toBe(
    'recurring_occurrence_edit_requires_review',
  );
  expect(f.db.rpc).not.toHaveBeenCalled();
});

it('an unresolved occurrence conflict survives later master echoes', async () => {
  const { f, ev } = linked({
    rrule: 'FREQ=DAILY;COUNT=3',
    calendar_conflict: { reason: 'recurring_occurrence_edit_requires_review' },
  });
  mocks.list.mockResolvedValue({ items: [ev], nextSyncToken: 'new' });
  expect((await run(f)).conflicts).toBe(1);
  expect(f.tables.tasks[0].calendar_conflict.reason).toBe(
    'recurring_occurrence_edit_requires_review',
  );
  expect(f.db.rpc).not.toHaveBeenCalled();
});

it('a thrown checkpoint transport failure still reports already persisted native changes', async () => {
  const { f, ev } = linked();
  mocks.list.mockResolvedValue({
    items: [{ ...ev, summary: 'Remote title' }],
    nextSyncToken: 'new',
  });
  f.state.beforeWrite = (table) => {
    if (table === 'user_calendar_connections')
      throw new Error('fixture_transport');
  };
  expect(await run(f)).toMatchObject({
    status: 'error',
    tasks_updated: 1,
    error: 'fixture_transport',
  });
  expect(f.tables.tasks[0].title).toBe('Remote title');
});

it('conflicts on shared tasks do not expose provider-only event content', async () => {
  const { f, ev } = linked();
  f.edit('task', { title: 'Local' });
  mocks.list.mockResolvedValue({
    items: [
      {
        ...ev,
        summary: 'Remote',
        attendees: [{ email: 'private-fixture@example.test' }],
        location: 'Private fixture location',
        extendedProperties: {
          private: {
            firstlightTaskId: 'task',
            unrelatedPrivateKey: 'private-fixture-value',
          },
        },
      },
    ],
    nextSyncToken: 'new',
  });
  expect((await run(f)).conflicts).toBe(1);
  expect(f.tables.tasks[0].calendar_conflict.remote).toEqual({
    id: ev.id,
    etag: ev.etag,
    status: ev.status,
  });
  expect(JSON.stringify(f.tables.tasks[0])).not.toContain('private-fixture');
});
it('an expanded instance cannot authorize reconciliation against an unverified master', async () => {
  const { f, ev } = linked({ rrule: 'FREQ=DAILY;COUNT=3' });
  p.save({
    ...ev,
    extendedProperties: { private: { firstlightTaskId: 'another-task' } },
  });
  mocks.list.mockResolvedValue({
    items: [
      {
        ...ev,
        id: 'instance',
        recurringEventId: 'master',
        originalStartTime: { dateTime: '2026-11-06T01:00:00Z' },
        start: { dateTime: '2026-11-06T01:00:00Z' },
        end: { dateTime: '2026-11-06T02:00:00Z' },
      },
    ],
    nextSyncToken: 'new',
  });
  expect((await run(f)).conflicts).toBe(1);
  expect(f.tables.tasks[0].calendar_conflict.reason).toBe(
    'unverified_task_tag',
  );
  expect(f.db.rpc).not.toHaveBeenCalled();
});
