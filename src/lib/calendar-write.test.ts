import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn(), patch: vi.fn(), remove: vi.fn(), get: vi.fn(), token: vi.fn() }));
vi.mock('./google-calendar', () => ({ createCalendarEvent: mocks.create, patchCalendarEvent: mocks.patch, deleteCalendarEvent: mocks.remove, getCalendarEvent: mocks.get }));
vi.mock('./calendar-token', () => ({ getValidAccessToken: mocks.token }));
import { buildEventInput, drainCalendarDeletions, pushPendingTasksForUser, type TaskRowForPush } from './calendar-write';
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
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {}); vi.resetAllMocks();
  mocks.create.mockResolvedValue({ id: 'created' }); mocks.patch.mockResolvedValue({ id: 'linked' }); mocks.remove.mockResolvedValue(undefined);
  mocks.get.mockImplementation(async ({ eventId }) => ({ id: eventId, status: 'confirmed', extendedProperties: { private: { firstlightTaskId: base.id } } }));
  mocks.token.mockResolvedValue('fixture-token');
});
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
  expect(saved.write).toEqual({ calendar_event_id: 'linked', calendar_event_generation: 0, calendar_dirty: false });
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
    expect(c.queries.find(q => q.write)?.write).toEqual({ calendar_event_id: null, calendar_event_generation: 1, calendar_dirty: false });
  }
  expect(mocks.remove).toHaveBeenCalledTimes(5);
  for (const [args] of mocks.remove.mock.calls) expect(args).toEqual({ accessToken: 'fixture-token', calendarId: 'primary', eventId: 'linked', sendUpdates: 'none' });
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

function calendarStore() {
  const events = new Map<string, any>();
  mocks.create.mockImplementation(async ({ event }) => {
    if (events.has(event.id)) throw new Error('google_create_event_failed: 409 conflict');
    events.set(event.id, { ...event, status: 'confirmed' }); return events.get(event.id);
  });
  mocks.get.mockImplementation(async ({ eventId }) => {
    if (!events.has(eventId)) throw new Error('google_get_event_failed: 404 missing');
    return events.get(eventId);
  });
  mocks.remove.mockImplementation(async ({ eventId }) => { events.set(eventId, { id: eventId, status: 'cancelled' }); });
  mocks.patch.mockImplementation(async ({ eventId, patch }) => {
    // Google PATCH does not implicitly restore a cancelled resource.
    const updated = { ...events.get(eventId), ...patch }; events.set(eventId, updated); return updated;
  });
  return events;
}

it.each(['completion', 'unscheduling'])('supports repeated %s/reopen cycles without patching tombstones', async reason => {
  const events = calendarStore();
  let task = { ...base };
  const sync = async () => {
    const c = task.calendar_event_id ? client([], [task]) : client([task]);
    expect((await run(c)).failed).toBe(0);
    task = { ...task, ...c.queries.find(q => q.write)!.write } as TaskRowForPush;
  };
  await sync();
  const ids = [task.calendar_event_id];
  for (let i = 0; i < 4; i++) {
    const lastId = task.calendar_event_id!;
    task = { ...task, ...(reason === 'completion' ? { is_completed: true, status: 'done' } : { start_at: null, due_at: null }), updated_at: `2026-10-0${i + 1}T01:00:00Z` };
    await sync();
    expect(task.calendar_event_id).toBeNull(); expect(events.get(lastId).status).toBe('cancelled');
    task = { ...task, is_completed: false, status: 'open', due_at: base.due_at, updated_at: `2026-10-0${i + 1}T02:00:00Z` };
    await sync(); ids.push(task.calendar_event_id);
    expect(task.calendar_event_generation).toBe(i + 1);
  }
  expect(new Set(ids).size).toBe(5); expect(mocks.patch).not.toHaveBeenCalled();
  for (const [args] of [...mocks.create.mock.calls, ...mocks.remove.mock.calls]) expect(args.sendUpdates).toBe('none');
});

it('recovers a concurrent reopen after deletion but before acknowledgement', async () => {
  calendarStore();
  const initial = client([base]); await run(initial);
  const linked = { ...base, ...initial.queries.find(q => q.write)!.write } as TaskRowForPush;
  expect((await run(client([], [{ ...linked, is_completed: true }], { changed: true }))).failed).toBe(1);
  const reopened = client([], [{ ...linked, updated_at: '2026-10-08T01:00:00Z' }]);
  expect(await run(reopened)).toMatchObject({ created: 1, failed: 0 });
  expect(reopened.queries.find(q => q.write)?.write).toMatchObject({ calendar_event_generation: 1 });
  expect(mocks.patch).not.toHaveBeenCalled();
});

it('skips a generation-zero tombstone and recovers an unacknowledged replacement', async () => {
  const events = calendarStore();
  await run(client([base], [], { saveError: true }));
  const firstId = mocks.create.mock.calls[0][0].event.id;
  events.set(firstId, { id: firstId, status: 'cancelled' });
  expect((await run(client([base], [], { saveError: true }))).failed).toBe(1);
  const replacement = mocks.create.mock.calls[2][0].event.id;
  const retry = client([base]);
  expect((await run(retry)).failed).toBe(0);
  expect(retry.queries.find(q => q.write)?.write).toMatchObject({ calendar_event_id: replacement, calendar_event_generation: 1 });
  expect(mocks.patch.mock.calls[0][0].eventId).toBe(replacement);
});

it.each([{}, { due_at: null }])('preserves unowned linked appointments on task writes: %j', patch => {
  mocks.get.mockResolvedValue({ id: 'appointment', status: 'confirmed', extendedProperties: { private: { firstlightTaskId: 'someone-else' } } });
  const c = client([], [{ ...base, ...patch, calendar_event_id: 'appointment' }]);
  return run(c).then(result => {
    expect(result.failed).toBe(1); expect(mocks.patch).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
    expect(c.queries.some(q => q.write)).toBe(false);
  });
});

it('does not overwrite an unrelated event when a generated id conflicts', async () => {
  mocks.create.mockRejectedValue(new Error('google_create_event_failed: 409 conflict'));
  mocks.get.mockResolvedValue({ id: 'unrelated', status: 'confirmed', summary: 'Real appointment' });
  expect((await run(client([base]))).failed).toBe(1);
  expect(mocks.patch).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
});

it('leaves an invalid persisted work interval pending instead of deleting its event', async () => {
  const c = client([], [{ ...base, time_kind: 'work', calendar_event_id: 'linked' }]);
  expect((await run(c)).failed).toBe(1);
  expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.patch).not.toHaveBeenCalled();
  expect(c.queries.some(q => q.write)).toBe(false);
});

it('does not recreate a cancelled linked appointment without provable task ownership', async () => {
  mocks.get.mockResolvedValue({ id: 'appointment', status: 'cancelled' });
  expect((await run(client([], [{ ...base, calendar_event_id: 'appointment' }]))).failed).toBe(1);
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.patch).not.toHaveBeenCalled();
});

function deletionQueue() {
  const rpc = vi.fn().mockResolvedValue({ data: [{ id: 'queue-one', user_id: 'owner', calendar_id: 'calendar', event_id: 'queued', attempts: 1 }], error: null });
  const remove = vi.fn(), update = vi.fn(), eq = vi.fn().mockResolvedValue({ error: null });
  const q = { delete: remove.mockReturnValue({ eq }), update: update.mockReturnValue({ eq }) };
  return { supabase: { rpc, from: vi.fn().mockReturnValue(q) } as any, rpc, remove, update, eq };
}

it('drains owned task deletions silently and acknowledges only the claimed row', async () => {
  const c = deletionQueue();
  expect(await drainCalendarDeletions(c)).toEqual({ deleted: 1, failed: 0 });
  expect(mocks.remove).toHaveBeenCalledWith({ accessToken: 'fixture-token', calendarId: 'calendar', eventId: 'queued', sendUpdates: 'none' });
  expect(c.rpc).toHaveBeenCalledWith('claim_pending_calendar_deletions', { batch_size: 50 });
  expect(c.eq).toHaveBeenCalledWith('id', 'queue-one'); expect(c.remove).toHaveBeenCalledTimes(1);
});

it.each(['provider failure', 'unowned appointment'])('retains queued deletions after %s', async reason => {
  if (reason === 'provider failure') mocks.remove.mockRejectedValue(new Error('offline'));
  else mocks.get.mockResolvedValue({ id: 'queued', status: 'confirmed', summary: 'Real appointment' });
  const c = deletionQueue();
  expect(await drainCalendarDeletions(c)).toEqual({ deleted: 0, failed: 1 });
  expect(c.remove).not.toHaveBeenCalled(); expect(c.update).toHaveBeenCalledWith({ last_error: expect.any(String) });
  if (reason === 'unowned appointment') expect(mocks.remove).not.toHaveBeenCalled();
});
