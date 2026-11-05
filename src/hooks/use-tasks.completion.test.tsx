import React from 'react';
import { act, create } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), toast: vi.fn() }));
vi.mock('@/hooks/use-ai', () => ({
  useUserPrefs: () => ({ data: { timezone: 'Asia/Taipei' } }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ rpc: f.rpc, from: f.from }),
}));
vi.mock('sonner', () => ({ toast: { error: f.toast } }));
import { useToggleTask } from './use-tasks';
let tree: any, qc: QueryClient, toggle: any;
const task: any = {
  id: 'fixture',
  user_id: 'owner',
  title: 'Recurring fixture',
  due_at: '2026-03-07T14:00:00Z',
  is_all_day: false,
  is_completed: false,
  time_kind: 'deadline',
  schedule_timezone: 'America/New_York',
  rrule: 'FREQ=DAILY;COUNT=2',
  updated_at: '2026-03-07T00:00:00.123456Z',
};
beforeEach(async () => {
  vi.clearAllMocks();
  qc = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  function Probe() {
    toggle = useToggleTask();
    return null;
  }
  await act(async () => {
    tree = create(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>,
    );
  });
});
afterEach(() => {
  act(() => tree.unmount());
  qc.clear();
});
it('UI history failure cannot advance independently or hide its task', async () => {
  f.rpc.mockResolvedValue({ data: null, error: { message: 'history_failed' } });
  qc.setQueryData(['tasks'], [task]);
  await act(async () => {
    toggle(task);
  });
  expect(f.rpc).toHaveBeenCalledWith(
    'complete_task_occurrence',
    expect.objectContaining({
      p_expected_updated_at: task.updated_at,
      p_next: expect.objectContaining({ due_at: '2026-03-08T13:00:00.000Z' }),
    }),
  );
  expect(f.from).not.toHaveBeenCalled();
  expect(qc.getQueryData(['tasks'])).toEqual([task]);
  expect(f.toast).toHaveBeenCalledWith('history_failed');
});
it('UI double click/lost response retries the same exact revision and never inserts a clone separately', async () => {
  f.rpc
    .mockResolvedValueOnce({ data: null, error: { message: 'response_lost' } })
    .mockResolvedValue({ data: { data: task, recurring: true }, error: null });
  await act(async () => {
    toggle(task);
  });
  await act(async () => {
    toggle(task);
    toggle(task);
  });
  expect(f.rpc.mock.calls.map((c) => c[1].p_expected_updated_at)).toEqual([
    task.updated_at,
    task.updated_at,
    task.updated_at,
  ]);
  expect(f.from).not.toHaveBeenCalled();
});
it('UI invalid recurrence is an error, not permanent completion', async () => {
  await act(async () => {
    toggle({ ...task, rrule: 'FREQ=INVALID' });
  });
  expect(f.rpc).not.toHaveBeenCalled();
  expect(f.from).not.toHaveBeenCalled();
  expect(f.toast).toHaveBeenCalledWith(
    expect.stringMatching(/Invalid recurrence/),
  );
});
