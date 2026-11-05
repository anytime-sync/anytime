import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  patch: vi.fn(),
  remove: vi.fn(),
  get: vi.fn(),
  token: vi.fn(),
}));
vi.mock('./google-calendar', () => ({
  createCalendarEvent: mocks.create,
  patchCalendarEvent: mocks.patch,
  deleteCalendarEvent: mocks.remove,
  getCalendarEvent: mocks.get,
}));
vi.mock('./calendar-token', () => ({ getValidAccessToken: mocks.token }));
import {
  buildEventInput,
  drainCalendarDeletions,
  pushPendingTasksForUser,
  taskEventId,
} from './calendar-write';
import {
  fixtureDatabase,
  fixtureProvider,
} from './__fixtures__/worldwide/calendar';
import { buildIcs } from './ical-feed';
const base = {
  id: 'task-one',
  user_id: 'owner',
  title: 'Fixture',
  notes: null,
  start_at: null,
  due_at: '2026-10-07T16:00:00Z',
  time_kind: 'deadline' as const,
  is_all_day: true,
  is_completed: false,
  status: 'open',
  calendar_event_id: null,
  calendar_dirty: true,
  updated_at: '2026-09-01T00:00:00Z',
};
let p: ReturnType<typeof fixtureProvider>;
const run = (f: ReturnType<typeof fixtureDatabase>) =>
  pushPendingTasksForUser({
    supabase: f.db,
    userId: 'owner',
    primaryCalendarId: 'primary',
    accessToken: 'fixture-token',
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.token.mockResolvedValue('fixture-token');
  p = fixtureProvider(mocks);
});
afterEach(() => vi.restoreAllMocks());
async function linked() {
  const f = fixtureDatabase([base]);
  expect(await run(f)).toMatchObject({ created: 1, failed: 0 });
  return f;
}
it.each([
  { due_at: base.due_at, start_at: null },
  { due_at: null, start_at: base.due_at },
])('pushes single endpoints with stable identity %j', async (dates) => {
  const f = fixtureDatabase([{ ...base, ...dates }]);
  expect(await run(f)).toMatchObject({ created: 1, failed: 0 });
  expect(mocks.create.mock.calls[0][0].event).toMatchObject({
    id: taskEventId(base.id, 0),
    start: { date: '2026-10-08' },
    end: { date: '2026-10-09' },
    transparency: 'transparent',
  });
  expect(f.tables.tasks[0]).toMatchObject({
    calendar_dirty: false,
    calendar_id: 'primary',
    calendar_etag: expect.any(String),
    calendar_baseline: expect.any(Object),
  });
});
it('selects only owned active dirty creates and all dirty linked removals without a freshness cutoff', async () => {
  const f = fixtureDatabase([]);
  await run(f);
  const queries = f.reads.filter((q) => q.table === 'tasks');
  for (const filter of [
    ['eq', 'user_id', 'owner'],
    ['eq', 'calendar_dirty', true],
    ['is', 'parent_id', null],
    ['eq', 'is_completed', false],
    ['neq', 'status', 'done'],
    ['neq', 'status', 'archived'],
  ])
    expect(queries[0].filters).toContainEqual(filter);
  expect(queries[1].filters).not.toContainEqual(['eq', 'is_completed', false]);
  expect(JSON.stringify(queries)).not.toContain('gte');
});
it('patches a deliberate edit using the acknowledged baseline and If-Match', async () => {
  const f = await linked();
  const before = f.tables.tasks[0].calendar_etag;
  f.edit(base.id, { title: 'Changed' });
  expect(await run(f)).toMatchObject({ patched: 1, failed: 0 });
  expect(mocks.patch).toHaveBeenCalledWith(
    expect.objectContaining({
      ifMatch: before,
      sendUpdates: 'none',
      patch: expect.objectContaining({ summary: 'Changed' }),
    }),
  );
  expect(f.tables.tasks[0].calendar_dirty).toBe(false);
});
it.each([
  { start_at: null, due_at: null },
  { is_completed: true },
  { status: 'done' },
  { status: 'archived' },
  { parent_id: 'child' },
])('removes only acknowledged owned mirrors %j', async (edit) => {
  const f = await linked();
  f.edit(base.id, edit);
  expect(await run(f)).toMatchObject({ failed: 0 });
  expect(f.tables.tasks[0]).toMatchObject({
    calendar_event_id: null,
    calendar_event_generation: 1,
    calendar_dirty: false,
  });
  expect(mocks.remove).toHaveBeenCalledWith(
    expect.objectContaining({
      ifMatch: expect.any(String),
      sendUpdates: 'none',
    }),
  );
});
it.each(['completion', 'unscheduling'])(
  'preserves generations through four %s/reopen cycles',
  async (reason) => {
    const f = await linked();
    const ids = [f.tables.tasks[0].calendar_event_id];
    for (let i = 0; i < 4; i++) {
      f.edit(
        base.id,
        reason === 'completion' ? { is_completed: true } : { due_at: null },
      );
      await run(f);
      expect(f.tables.tasks[0].calendar_event_id).toBeNull();
      f.edit(base.id, { is_completed: false, due_at: base.due_at });
      expect(await run(f)).toMatchObject({ created: 1, failed: 0 });
      ids.push(f.tables.tasks[0].calendar_event_id);
    }
    expect(new Set(ids).size).toBe(5);
    expect(mocks.patch).not.toHaveBeenCalled();
  },
);
it('recovers lost create response without a duplicate or blind patch', async () => {
  const f = fixtureDatabase([base]);
  p.state.createLost = true;
  expect((await run(f)).failed).toBe(1);
  expect((await run(f)).created).toBe(1);
  expect(p.events.size).toBe(1);
  expect(mocks.patch).not.toHaveBeenCalled();
});
it('recovers lost PATCH response without losing a subsequent local edit', async () => {
  const f = await linked();
  f.edit(base.id, { title: 'First edit' });
  p.state.patchLost = true;
  expect((await run(f)).failed).toBe(1);
  f.edit(base.id, { title: 'Later edit' });
  await run(f);
  expect(f.tables.tasks[0]).toMatchObject({
    title: 'Later edit',
    calendar_dirty: true,
  });
  await run(f);
  expect(p.events.get(f.tables.tasks[0].calendar_event_id).summary).toBe(
    'Later edit',
  );
});
it('overlapping workers retain one stable Google identity', async () => {
  const f = fixtureDatabase([base]);
  await Promise.all([run(f), run(f)]);
  await run(f);
  expect(p.events.size).toBe(1);
  expect(f.tables.tasks[0].calendar_dirty).toBe(false);
});
it('edit during push fails exact-version acknowledgement and remains pending', async () => {
  const f = await linked();
  f.edit(base.id, { title: 'Sent edit' });
  p.state.beforePatch = () => {
    p.state.beforePatch = null;
    f.edit(base.id, { title: 'New local edit' });
  };
  expect((await run(f)).failed).toBe(1);
  expect(f.tables.tasks[0]).toMatchObject({
    title: 'New local edit',
    calendar_dirty: true,
  });
  await run(f);
  await run(f);
  expect(p.events.get(f.tables.tasks[0].calendar_event_id).summary).toBe(
    'New local edit',
  );
});
it('reopen during deletion recovers its pending removal then creates a new generation', async () => {
  const f = await linked();
  const first = f.tables.tasks[0].calendar_event_id;
  f.edit(base.id, { is_completed: true });
  p.state.beforeDelete = () => {
    p.state.beforeDelete = null;
    f.edit(base.id, { is_completed: false });
  };
  expect((await run(f)).failed).toBe(1);
  await run(f);
  expect(f.tables.tasks[0]).toMatchObject({
    calendar_event_id: null,
    calendar_dirty: true,
    calendar_event_generation: 1,
  });
  await run(f);
  expect(f.tables.tasks[0].calendar_event_id).not.toBe(first);
  expect(p.events.get(first).status).toBe('cancelled');
});
it.each(['google_patch_event_failed: 429', 'google_patch_event_failed: 503'])(
  'keeps %s pending',
  async (error) => {
    const f = await linked();
    f.edit(base.id, { title: 'Edit' });
    p.state.fail = error;
    expect((await run(f)).failed).toBe(1);
    expect(f.tables.tasks[0].calendar_dirty).toBe(true);
  },
);
it.each(['patch', 'delete'])(
  '412 %s refetches and stages a conflict without retrying overwrite',
  async (operation) => {
    const f = await linked();
    f.edit(
      base.id,
      operation === 'patch' ? { title: 'Local' } : { is_completed: true },
    );
    const change = (id: string) =>
      p.save({ ...p.events.get(id), summary: 'Remote edit' });
    if (operation === 'patch') p.state.beforePatch = change;
    else p.state.beforeDelete = change;
    expect((await run(f)).conflicts).toBe(1);
    expect(f.tables.tasks[0].calendar_conflict.reason).toBe(
      'remote_changed_during_write',
    );
    expect(p.events.get(f.tables.tasks[0].calendar_event_id).summary).toBe(
      'Remote edit',
    );
    expect(mocks.get.mock.calls.length).toBeGreaterThanOrEqual(2);
  },
);
it('remote edit since acknowledged baseline conflicts even when latest ETag is fetched', async () => {
  const f = await linked();
  const id = f.tables.tasks[0].calendar_event_id;
  p.save({ ...p.events.get(id), summary: 'Remote' });
  f.edit(base.id, { title: 'Local' });
  expect((await run(f)).conflicts).toBe(1);
  expect(mocks.patch).not.toHaveBeenCalled();
});
it('missing baseline cannot authorize overwriting a tagged event', async () => {
  const f = await linked();
  delete f.tables.tasks[0].calendar_baseline;
  f.edit(base.id, { title: 'Local' });
  expect((await run(f)).conflicts).toBe(1);
  expect(mocks.patch).not.toHaveBeenCalled();
});
it('exact echo bootstraps an old mapping without rewriting provider data', async () => {
  const f = await linked();
  delete f.tables.tasks[0].calendar_baseline;
  delete f.tables.tasks[0].calendar_etag;
  f.edit(base.id, {});
  expect((await run(f)).patched).toBe(1);
  expect(mocks.patch).not.toHaveBeenCalled();
});
it('remote deletion retains the native task and stages review, never auto-completes it', async () => {
  const f = await linked();
  const id = f.tables.tasks[0].calendar_event_id;
  p.save({ id, status: 'cancelled' });
  f.edit(base.id, {});
  expect((await run(f)).conflicts).toBe(1);
  expect(f.tables.tasks[0].is_completed).toBe(false);
  expect(mocks.create).toHaveBeenCalledTimes(1);
});
it('does not overwrite unrelated tags, IDs or invalid work intervals', async () => {
  const f = await linked();
  const id = f.tables.tasks[0].calendar_event_id;
  p.save({
    ...p.events.get(id),
    extendedProperties: { private: { firstlightTaskId: 'other' } },
  });
  f.edit(base.id, { title: 'Edit' });
  expect((await run(f)).failed).toBe(1);
  expect(mocks.patch).not.toHaveBeenCalled();
  f.edit(base.id, { time_kind: 'work', start_at: null });
  expect((await run(f)).failed).toBe(1);
  expect(mocks.remove).not.toHaveBeenCalled();
});
it.each([null, 'linked'])(
  'preserves unknown legacy exclusions (%s)',
  async (calendar_event_id) => {
    for (const dates of [
      { start_at: null, due_at: base.due_at, is_all_day: true },
      {
        start_at: '2026-10-01T01:00Z',
        due_at: '2026-11-01T01:00Z',
        is_all_day: false,
      },
    ]) {
      const f = fixtureDatabase([
        { ...base, ...dates, time_kind: null, calendar_event_id },
      ]);
      expect(await run(f)).toMatchObject({
        created: 0,
        patched: 0,
        failed: 0,
        conflicts: 0,
      });
    }
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  },
);
it('preserves Google/ICS inclusive task spans and exclusive DATE ends', () => {
  const t = {
    ...base,
    start_at: '2026-10-07T16:00Z',
    due_at: '2026-10-09T16:00Z',
    time_kind: 'span' as const,
    rrule: 'FREQ=DAILY;UNTIL=20261030T160000Z;BYHOUR=9',
  };
  const input = buildEventInput(t, 'Asia/Taipei')!;
  expect(input).toMatchObject({
    start: { date: '2026-10-08' },
    end: { date: '2026-10-11' },
    recurrence: ['RRULE:FREQ=DAILY;UNTIL=20261031'],
  });
  expect(
    buildIcs(
      [{ ...t, created_at: base.updated_at, estimated_minutes: null }],
      'Asia/Taipei',
    ),
  ).toContain('DTEND;VALUE=DATE:20261011');
});
it('surfaces database selection and acknowledgement failures as pending', async () => {
  const f = fixtureDatabase([base]);
  f.state.fail = 'tasks:read';
  await expect(run(f)).rejects.toMatchObject({ message: 'fixture_db_failure' });
  f.state.fail = 'tasks:update';
  expect((await run(f)).failed).toBe(1);
  expect(mocks.create).not.toHaveBeenCalled();
});
async function queue() {
  const f = await linked();
  const t = f.tables.tasks[0];
  f.tables.pending_calendar_deletions.push({
    id: 'queue',
    user_id: 'owner',
    calendar_id: 'primary',
    event_id: t.calendar_event_id,
    attempts: 1,
  });
  f.tables.task_calendar_deletion_baselines.push({
    user_id: 'owner',
    event_id: t.calendar_event_id,
    calendar_id: 'primary',
    task_id: base.id,
    etag: t.calendar_etag,
    baseline: t.calendar_baseline,
  });
  return f;
}
it('drains claimed owned deletions conditionally and silently', async () => {
  const f = await queue();
  expect(await drainCalendarDeletions({ supabase: f.db })).toEqual({
    deleted: 1,
    failed: 0,
  });
  expect(f.db.rpc).toHaveBeenCalledWith('claim_pending_calendar_deletions', {
    batch_size: 50,
  });
  expect(mocks.remove).toHaveBeenCalledWith(
    expect.objectContaining({
      ifMatch: expect.any(String),
      sendUpdates: 'none',
    }),
  );
});
it.each(['no baseline', 'remote edit', 'provider failure'])(
  'retains queue after %s',
  async (reason) => {
    const f = await queue();
    if (reason === 'no baseline')
      f.tables.task_calendar_deletion_baselines = [];
    else if (reason === 'remote edit') {
      const id = f.tables.tasks[0].calendar_event_id;
      p.save({ ...p.events.get(id), summary: 'Remote' });
    } else p.state.fail = '503';
    expect(await drainCalendarDeletions({ supabase: f.db })).toEqual({
      deleted: 0,
      failed: 1,
    });
    expect(f.tables.pending_calendar_deletions).toHaveLength(1);
  },
);
it('Sync now scopes deletion work to its user and reports failed claims', async () => {
  const f = await queue();
  f.tables.pending_calendar_deletions.push({
    id: 'other',
    user_id: 'other',
    event_id: 'private',
  });
  await drainCalendarDeletions({ supabase: f.db, userId: 'owner' });
  expect(f.tables.pending_calendar_deletions).toEqual([
    expect.objectContaining({ id: 'other' }),
  ]);
  f.state.fail = 'rpc';
  await expect(drainCalendarDeletions({ supabase: f.db })).rejects.toThrow(
    'fixture_rpc_failed',
  );
});

it('lost create response followed by a local edit keeps one event and retries only the later revision', async () => {
  const f = fixtureDatabase([base]);
  p.state.createLost = true;
  expect((await run(f)).failed).toBe(1);
  f.edit(base.id, { title: 'Later title' });
  expect((await run(f)).created).toBe(1);
  expect(f.tables.tasks[0].calendar_dirty).toBe(true);
  expect(mocks.patch).not.toHaveBeenCalled();
  await run(f);
  expect(p.events.size).toBe(1);
  expect(p.events.get(f.tables.tasks[0].calendar_event_id).summary).toBe(
    'Later title',
  );
});

it('queued deletion 412 refetches and retains a remote edit instead of retrying deletion', async () => {
  const f = await queue();
  p.state.beforeDelete = (id) =>
    p.save({ ...p.events.get(id), summary: 'Remote edit' });
  expect(await drainCalendarDeletions({ supabase: f.db })).toEqual({
    deleted: 0,
    failed: 1,
  });
  expect(f.tables.pending_calendar_deletions[0].last_error).toBe(
    'deletion_conflict_remote_changed',
  );
  expect(mocks.remove).toHaveBeenCalledTimes(1);
  expect(mocks.get.mock.calls.length).toBeGreaterThanOrEqual(2);
});

it('pending series edits cannot silently clear an unresolved occurrence conflict', async () => {
  const f = await linked();
  f.edit(base.id, {
    title: 'Local',
    calendar_conflict: { reason: 'recurring_occurrence_edit_requires_review' },
  });
  expect((await run(f)).conflicts).toBe(1);
  expect(mocks.patch).not.toHaveBeenCalled();
  expect(f.tables.tasks[0].calendar_dirty).toBe(true);
});
