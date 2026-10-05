import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn(), patch: vi.fn(), remove: vi.fn() }));
vi.mock('./google-calendar', () => ({ createCalendarEvent: mocks.create, patchCalendarEvent: mocks.patch, deleteCalendarEvent: mocks.remove }));
vi.mock('./calendar-token', () => ({ getValidAccessToken: vi.fn() }));
import { buildEventInput, pushPendingTasksForUser, type TaskRowForPush } from './calendar-write';
import { buildIcs } from './ical-feed';
const base: TaskRowForPush = { id: 'task-one', user_id: 'owner', title: 'Task', notes: null, start_at: null, due_at: '2026-10-07T16:00:00Z', is_all_day: true, calendar_event_id: null, updated_at: '2026-09-01T00:00:00Z' };
function client(creates: TaskRowForPush[], patches: TaskRowForPush[] = [], options: { saveError?: boolean; changed?: boolean; queryError?: boolean } = {}) {
  const queries: Array<{ table: string; filters: unknown[][]; write?: Record<string, unknown> }> = [];
  let taskReads = 0;
  const supabase = { from: (table: string) => {
    const log: typeof queries[number] = { table, filters: [] }; queries.push(log);
    const result = () => table === 'user_preferences' ? { data: { timezone: 'Asia/Taipei' }, error: null }
      : log.write ? { data: options.changed ? [] : [{ id: 'task-one' }], error: options.saveError ? { message: 'save failed' } : null }
      : { data: taskReads++ === 0 ? creates : patches, error: options.queryError ? { message: 'read failed' } : null };
    const q: any = { then: (resolve: any) => Promise.resolve(result()).then(resolve), maybeSingle: async () => result() };
    for (const name of ['select','eq','is','not','neq','or','order','limit','gte']) q[name] = (...args: unknown[]) => { log.filters.push([name,...args]); return q; };
    q.update = (write: Record<string, unknown>) => { log.write = write; return q; };
    return q;
  } };
  return { supabase: supabase as any, queries };
}
const run = (c: ReturnType<typeof client>) => pushPendingTasksForUser({ supabase: c.supabase, userId: 'owner', primaryCalendarId: 'primary', accessToken: 'fixture-token' });
afterEach(() => vi.restoreAllMocks());
beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); vi.clearAllMocks(); mocks.create.mockResolvedValue({ id: 'created' }); mocks.patch.mockResolvedValue({ id: 'linked' }); mocks.remove.mockResolvedValue(undefined); });
it.each([{ due_at: base.due_at, start_at: null }, { due_at: null, start_at: base.due_at }])('pushes date-only single endpoints %j', async dates => {
  const c = client([{ ...base, ...dates }]);
  expect(await run(c)).toMatchObject({ created: 1, failed: 0 });
  expect(mocks.create.mock.calls[0][0].event).toMatchObject({ start: { date: '2026-10-08' }, end: { date: '2026-10-09' }, transparency: 'transparent' });
  const selection = c.queries.find(q => q.table === 'tasks' && !q.write)!;
  expect(selection.filters).toContainEqual(['or', 'start_at.not.is.null,due_at.not.is.null']);
  expect(selection.filters).not.toContainEqual(['not','start_at','is',null]);
  expect(selection.filters).not.toContainEqual(['not','due_at','is',null]);
});
it('selects dirty linked tasks regardless of when they were edited', async () => {
  const c = client([], [{ ...base, calendar_event_id: 'linked' }]);
  expect(await run(c)).toMatchObject({ patched: 1, failed: 0 });
  expect(c.queries.some(q => q.filters.some(f => f[0] === 'gte'))).toBe(false);
  expect(c.queries[2].filters).toContainEqual(['eq','calendar_dirty',true]);
  const saved = c.queries.find(q => q.write)!;
  expect(saved.filters).toContainEqual(['eq','updated_at',base.updated_at]);
  expect(saved.filters).toContainEqual(['eq','user_id','owner']);
  expect(saved.write).toEqual({ calendar_event_id: 'linked', calendar_dirty: false });
});
it('keeps Google and ICS span boundaries, recurrence and transparency aligned', () => {
  const task = { ...base, start_at: '2026-10-07T16:00:00Z', due_at: '2026-10-09T16:00:00Z', time_kind: 'span' as const, rrule: 'FREQ=DAILY;UNTIL=20261030T160000Z;BYHOUR=9' };
  const input = buildEventInput(task, 'Asia/Taipei')!;
  const ics = buildIcs([{ ...task, is_all_day: true, is_completed: false, created_at: base.updated_at!, updated_at: base.updated_at!, estimated_minutes: null }], 'Asia/Taipei');
  expect(input).toMatchObject({ start: { date: '2026-10-08', dateTime: null }, end: { date: '2026-10-11', dateTime: null }, recurrence: ['RRULE:FREQ=DAILY;UNTIL=20261031'] });
  expect(ics).toContain('DTSTART;VALUE=DATE:20261008\r\nDTEND;VALUE=DATE:20261011');
  expect(ics).toContain('TRANSP:TRANSPARENT');
  expect(ics).toContain(input.recurrence![0]);
});
it('preserves multiday work exactly and clears old DATE fields', () => {
  const input = buildEventInput({ ...base, start_at: '2026-10-07T16:00:00Z', due_at: '2026-10-10T17:00:00Z', time_kind: 'work', is_all_day: false }, 'Asia/Taipei')!;
  expect(input).toMatchObject({ start: { date: null, dateTime: '2026-10-07T16:00:00.000Z', timeZone: 'Asia/Taipei' }, end: { dateTime: '2026-10-10T17:00:00.000Z' }, transparency: 'opaque' });
});
it('removes linked events after unscheduling or completion and acknowledges the version', async () => {
  for (const patch of [{ start_at: null, due_at: null }, { is_completed: true }, { status: 'done' }, { status: 'archived' }, { parent_id: 'parent-task' }]) {
    const c = client([], [{ ...base, ...patch, calendar_event_id: 'linked' }]);
    expect((await run(c)).failed).toBe(0);
    expect(c.queries.find(q => q.write)?.write).toEqual({ calendar_event_id: null, calendar_dirty: false });
  }
  expect(mocks.remove).toHaveBeenCalledTimes(5);
});
it('does not acknowledge failed provider writes', async () => {
  mocks.patch.mockRejectedValue(new Error('offline'));
  const c = client([], [{ ...base, calendar_event_id: 'linked' }]);
  expect((await run(c)).failed).toBe(1);
  expect(c.queries.some(q => q.write)).toBe(false);
});
it.each([{ saveError: true }, { changed: true }])('leaves persistence failures/concurrent edits pending: %j', async options => {
  const c = client([base], [], options);
  expect((await run(c)).failed).toBe(1);
  expect(c.queries.find(q => q.write)?.filters).toContainEqual(['eq','updated_at',base.updated_at]);
});
it('uses stable provider identity and recovers a successful create whose link save failed', async () => {
  await run(client([base]));
  const id = mocks.create.mock.calls[0][0].event.id;
  expect(id).toMatch(/^[0-9a-v]+$/);
  mocks.create.mockRejectedValue(new Error('google_create_event_failed: 409 conflict'));
  expect((await run(client([base]))).failed).toBe(0);
  expect(mocks.create.mock.calls[1][0].event.id).toBe(id);
  expect(mocks.patch.mock.calls[0][0]).toMatchObject({ eventId: id, sendUpdates: 'none' });
});
it('reports database selection errors without calling Google', async () => {
  await expect(run(client([], [], { queryError: true }))).rejects.toMatchObject({ message: 'read failed' });
  expect(mocks.create).not.toHaveBeenCalled();
});
it('does not silently acknowledge missing linked events', async () => {
  mocks.patch.mockResolvedValue({ status: 'cancelled' });
  const c = client([], [{ ...base, calendar_event_id: 'missing' }]);
  expect((await run(c)).failed).toBe(1);
  expect(c.queries.some(q => q.write)).toBe(false);
});
