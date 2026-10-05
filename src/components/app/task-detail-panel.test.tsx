import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ task: null as any, mutate: vi.fn(), close: vi.fn() }));
vi.mock('@/hooks/use-tasks', () => ({ useTask: () => ({ data: state.task }), useUpdateTask: () => ({ mutate: state.mutate }), useDeleteTask: () => ({}), useToggleTask: () => vi.fn() }));
vi.mock('@/store/ui', () => ({ useUIStore: (select: any) => select({ selectedTaskId: 'task', setSelectedTaskId: state.close }) }));
vi.mock('@/hooks/use-projects', () => ({ useProjects: () => ({ data: [] }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }));
vi.mock('./date-time-picker', () => ({ DateTimePicker: (props: any) => React.createElement('picker', props) }));
vi.mock('./ai-task-actions', () => ({ AiTaskActions: () => null }));
vi.mock('./task-comments', () => ({ TaskComments: () => null }));
vi.mock('./subtask-list', () => ({ SubtaskList: () => null }));
vi.mock('./attachment-list', () => ({ AttachmentList: () => null }));
vi.mock('./tag-editor', () => ({ TagEditor: () => null }));
import { TaskDetailPanel } from './task-detail-panel';
import { resolveTaskDates } from '@/lib/task-schedule';
const base = { id: 'task', title: 'Task', notes: null, tags: [], start_at: null, due_at: '2026-10-08T01:00:00Z', time_kind: 'deadline', is_all_day: false, priority: 0, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' };
beforeEach(() => { state.task = { ...base }; vi.clearAllMocks(); });
function mount() { let tree!: ReactTestRenderer; act(() => { tree = create(<TaskDetailPanel />); }); return tree; }
it.each([{ start_at: null }, { due_at: null, start_at: base.due_at }, { start_at: base.due_at }, { start_at: base.due_at, due_at: '2026-10-07T00:00:00Z' }])('opening and closing does not repair/mutate dates: %j', patch => {
  state.task = { ...base, ...patch }; const tree = mount();
  expect(state.mutate).not.toHaveBeenCalled();
  const close = tree.root.findAllByType('button').find(b => b.props['aria-label'] === 'Close')!;
  act(() => close.props.onClick());
  expect(state.mutate).not.toHaveBeenCalled(); act(() => tree.unmount());
});
it('clears endpoints without recreating them or changing the other boundary', () => {
  state.task = { ...base, start_at: '2026-10-08T00:00:00Z' }; const tree = mount();
  const pickers = tree.root.findAll(node => node.type === ('picker' as any));
  act(() => pickers[0].props.onChange(null)); expect(state.mutate).toHaveBeenLastCalledWith({ id: 'task', start_at: null, due_at: base.due_at });
  act(() => pickers[1].props.onChange(null)); expect(state.mutate).toHaveBeenLastCalledWith({ id: 'task', start_at: state.task.start_at, due_at: null });
  act(() => tree.unmount());
});
it('preserves date-only intent when selecting a due date', () => {
  state.task.is_all_day = true; const tree = mount();
  const picker = tree.root.findAll(node => node.type === ('picker' as any))[1];
  expect(picker.props.allDay).toBe(true); act(() => picker.props.onChange('2026-10-09T16:00:00Z'));
  expect(state.mutate.mock.calls[0][0]).not.toHaveProperty('is_all_day'); act(() => tree.unmount());
});

it('keeps an interrupted deadline-to-span-to-timed flow valid across repeated edits', () => {
  const tree = mount();
  state.mutate.mockImplementation(({ id: _id, ...patch }) => { state.task = { ...state.task, ...resolveTaskDates(state.task, patch) }; });
  for (let i = 0; i < 3; i++) {
    act(() => tree.root.findAllByType('select')[0].props.onChange({ target: { value: 'span' } }));
    act(() => tree.update(<TaskDetailPanel />));
    expect(state.task.time_kind).toBe('span');
    const checkbox = tree.root.findAllByType('input').find(input => input.props.type === 'checkbox')!;
    act(() => checkbox.props.onChange({ target: { checked: false } }));
    act(() => tree.update(<TaskDetailPanel />));
    expect(state.task).toMatchObject({ time_kind: 'deadline', start_at: null, due_at: base.due_at, is_all_day: false });
    expect(tree.root.findAllByType('select')[0].findAllByType('option').find(option => option.props.value === 'work')?.props.disabled).toBe(true);
  }
  act(() => tree.unmount());
});
