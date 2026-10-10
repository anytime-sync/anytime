import { expect, it, vi } from 'vitest';
import { pushPendingTasksForUser, validCalendarBlock } from './calendar-write';
const api = vi.hoisted(() => ({ create: vi.fn(), patch: vi.fn() }));
vi.mock('./google-calendar', () => ({ createCalendarEvent: api.create, patchCalendarEvent: api.patch, deleteCalendarEvent: vi.fn() }));
vi.mock('./calendar-token', () => ({ getValidAccessToken: vi.fn() }));
it('does not publish completed, archived, deadline-only or stale multi-day rows', async () => {
  const base = { user_id: 'owner', title: 'Task', notes: null, start_at: '2026-10-11T01:00:00Z', due_at: '2026-10-11T01:30:00Z', is_all_day: false, calendar_event_id: null, status: 'open', is_completed: false, updated_at: new Date().toISOString() };
  const rows = [
    { ...base, id: 'live' }, { ...base, id: 'done', status: 'done', is_completed: true },
    { ...base, id: 'archived', status: 'archived' }, { ...base, id: 'other', user_id: 'other' },
    { ...base, id: 'span', start_at: '2026-09-01T01:00:00Z' },
    { ...base, id: 'deadline', is_all_day: true },
    { ...base, id: 'done-linked', calendar_event_id: 'old', status: 'done', is_completed: true },
  ];
  const supabase = { from: () => {
    let selected: any[] = [...rows];
    const chain: any = {
      select: () => chain, order: () => chain, limit: () => chain,
      eq: (k: string, v: unknown) => { selected = selected.filter(r => r[k] === v); return chain; },
      neq: (k: string, v: unknown) => { selected = selected.filter(r => r[k] !== v); return chain; },
      is: (k: string, v: unknown) => { selected = selected.filter(r => r[k] === v); return chain; },
      not: (k: string, _op: string, v: unknown) => { selected = selected.filter(r => r[k] !== v); return chain; },
      gte: (k: string, v: string) => { selected = selected.filter(r => r[k] >= v); return chain; },
      update: () => chain,
      then: (resolve: any) => Promise.resolve({ data: selected, error: null }).then(resolve),
    }; return chain;
  } } as any;
  api.create.mockResolvedValue({ id: 'google-live' });
  const out = await pushPendingTasksForUser({ supabase, userId: 'owner', primaryCalendarId: 'primary', accessToken: 'test' });
  expect(out).toEqual({ created: 1, patched: 0, failed: 0 });
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.create.mock.calls[0][0].event.extendedProperties.private.firstlightTaskId).toBe('live');
  expect(api.patch).not.toHaveBeenCalled();
});
it('rejects zero-length, inverted and invalid calendar bookings', () => {
  const base = { start_at: '2026-10-11T01:00:00Z', is_all_day: false };
  for (const due_at of [base.start_at, '2026-10-10T01:00:00Z', 'bad']) expect(validCalendarBlock({ ...base, due_at })).toBe(false);
});
