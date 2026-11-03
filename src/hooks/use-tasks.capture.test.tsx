import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ zone: 'Asia/Taipei', pending: false, prefsError: null as Error | null,
  fail: '', asResponse: false, calls: [] as any[], tasks: [] as any[], links: [] as any[] }));
vi.mock('@/hooks/use-ai', () => ({ useUserPrefs: () => ({ data: { timezone: fixture.zone },
  isPending: fixture.pending, isSuccess: !fixture.pending && !fixture.prefsError, error: fixture.prefsError }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } } }) },
  from(table: string) {
    let op = 'select'; let values: any; const filters: any[] = []; const q: any = {};
    for (const name of ['select', 'order', 'eq', 'neq', 'is', 'or', 'single']) q[name] = (...args: any[]) => { filters.push([name, ...args]); return q; };
    for (const name of ['insert', 'upsert']) q[name] = (v: any, options: any) => { op = name; values = v; filters.push([name, options]); return q; };
    q.then = (resolve: any, reject: any) => Promise.resolve().then(() => {
      fixture.calls.push({ table, op, values, filters });
      if (table === fixture.fail && op !== 'select') {
        if (table === 'task_tags') fixture.links = values; // accepted, response lost
        if (fixture.asResponse) return { data: null, error: { message: 'Fixture network failure' } };
        throw new TypeError('Fixture network failure');
      }
      if (table === 'tasks' && op === 'insert') {
        const task = { ...values, id: `saved-${fixture.tasks.length + 1}` }; fixture.tasks.push(task);
        return { data: task, error: null };
      }
      if (table === 'tags') return { data: values.map((v: any) => ({ ...v, id: `tag-${v.name}` })), error: null };
      if (table === 'task_tags') fixture.links = values;
      return { data: [], error: null };
    }).then(resolve, reject);
    return q;
  },
}) }));
import { useCreateTask, useTasks } from './use-tasks';
import { toast } from 'sonner';
let tree: ReactTestRenderer;
let qc: QueryClient;
let rerender: () => void;
beforeEach(() => {
  fixture.zone = 'Asia/Taipei'; fixture.pending = false; fixture.prefsError = null;
  fixture.fail = ''; fixture.asResponse = false; fixture.calls = []; fixture.tasks = []; fixture.links = [];
  vi.clearAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-25T18:00:00Z'));
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { act(() => tree?.unmount()); qc.clear(); vi.useRealTimers(); });
async function mount(hook: () => any) {
  let result: any; function Probe() { result = hook(); return null; }
  const render = () => <QueryClientProvider client={qc}><Probe /></QueryClientProvider>;
  await act(async () => { tree = create(render()); }); rerender = () => tree.update(render());
  return () => result;
}
const filter = () => fixture.calls.at(-1).filters.find((f: any) => f[0] === 'or')[1];
it('current-main regression: Today follows the stored Taipei date', async () => {
  await mount(() => useTasks({ view: 'today' }));
  expect(filter()).toBe('due_at.lt.2026-10-26T16:00:00.000Z,and(due_at.is.null,start_at.lt.2026-10-26T16:00:00.000Z)');
});
it('current-main regression: Tomorrow uses inclusive start and exclusive next start on a 25-hour day', async () => {
  fixture.zone = 'America/New_York'; vi.setSystemTime(new Date('2026-10-31T16:00:00Z'));
  await mount(() => useTasks({ view: 'tomorrow' }));
  expect(filter()).toBe('and(due_at.gte.2026-11-01T04:00:00.000Z,due_at.lt.2026-11-02T05:00:00.000Z),and(due_at.is.null,start_at.gte.2026-11-01T04:00:00.000Z,start_at.lt.2026-11-02T05:00:00.000Z)');
});
it.each([['tags', false], ['tags', true], ['task_tags', false], ['task_tags', true]] as const)(
  'current-main regression: retain the task after %s failure (response error %s) and retry only tags', async (table, asResponse) => {
    fixture.fail = table; fixture.asResponse = asResponse;
    qc.setQueryData(['tasks', {}], [{ id: 'existing', tags: [] }]);
    const current = await mount(useCreateTask); let task: any;
    await act(async () => { task = await current().mutateAsync({ title: 'Synthetic task', tagNames: ['work', 'work'] }); });
    expect(task.id).toBe('saved-1'); expect(fixture.tasks).toHaveLength(1);
    expect(qc.getQueryData<any[]>(['tasks', {}])?.map(t => t.id)).toEqual(['saved-1', 'existing']);
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith("Task saved. Tags couldn't be saved.", expect.objectContaining({ duration: Infinity }));
    const retry = (vi.mocked(toast.warning).mock.calls.at(-1)![1]!.action as any).onClick;
    await act(async () => { await retry(); }); // another lost response
    fixture.fail = '';
    await act(async () => { await retry(); await retry(); });
    expect(fixture.tasks).toHaveLength(1); expect(fixture.links).toEqual([{ task_id: 'saved-1', tag_id: 'tag-work' }]);
    expect(fixture.calls.filter(c => c.table === 'task_tags').every(c => c.op === 'upsert' && c.filters.some((f: any) => f[1]?.onConflict === 'task_id,tag_id' && f[1]?.ignoreDuplicates))).toBe(true);
  });
it('creates an ordinary task once and preserves PR26 date intent', async () => {
  const current = await mount(useCreateTask);
  await act(async () => { await current().mutateAsync({ title: 'Synthetic work', start_at: '2026-11-03T08:00:00Z', due_at: '2026-11-03T08:05:00Z', time_kind: 'work' }); });
  expect(fixture.tasks).toHaveLength(1); expect(fixture.tasks[0]).toMatchObject({ time_kind: 'work', start_at: '2026-11-03T08:00:00Z', due_at: '2026-11-03T08:05:00Z' });
  expect(toast.warning).not.toHaveBeenCalled();
});
it('waits for preferences and changes cache identity on a timezone change', async () => {
  fixture.pending = true; await mount(() => useTasks({ view: 'today' })); expect(fixture.calls).toHaveLength(0);
  fixture.pending = false; await act(async () => rerender()); expect(filter()).toContain('2026-10-26T16:00:00.000Z');
  fixture.zone = 'America/Los_Angeles'; await act(async () => rerender()); expect(filter()).toContain('2026-10-26T07:00:00.000Z');
  expect(qc.getQueryCache().findAll({ queryKey: ['tasks'] }).map(q => q.queryKey.slice(2))).toEqual([
    ['Asia/Taipei', '2026-10-26'], ['America/Los_Angeles', '2026-10-25'],
  ]);
});
it('advances an open view at account midnight', async () => {
  vi.useRealTimers(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-26T15:59:59Z'));
  await mount(() => useTasks({ view: 'today' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(filter()).toContain('2026-10-27T16:00:00.000Z');
});
it('does not substitute device time after a failed preference read', async () => {
  fixture.prefsError = new Error('Fixture preference failure'); await mount(() => useTasks({ view: 'today' }));
  expect(fixture.calls).toHaveLength(0);
});
it('a failed task insert removes only its optimistic row', async () => {
  fixture.fail = 'tasks'; qc.setQueryData(['tasks', {}], [{ id: 'existing', tags: [] }]);
  const current = await mount(useCreateTask);
  const stop = qc.getQueryCache().subscribe(event => {
    const rows = event.query.state.data as any[];
    if (Array.isArray(rows) && rows.some(t => t.id.startsWith('optimistic-')) && !rows.some(t => t.id === 'concurrent')) qc.setQueryData(['tasks', {}], [...rows, { id: 'concurrent', tags: [] }]);
  });
  await act(async () => { await expect(current().mutateAsync({ title: 'Rejected task' })).rejects.toThrow('Fixture network failure'); }); stop();
  expect(qc.getQueryData<any[]>(['tasks', {}])?.map(t => t.id)).toEqual(['existing', 'concurrent']);
});
