import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ task: vi.fn(), project: vi.fn(), ai: vi.fn(), close: vi.fn(), projects: [] as any[], pending: false, connected: false }));
vi.mock('@/hooks/use-tasks', () => ({ useCreateTask: () => ({ mutateAsync: f.task }), useUpdateTask: () => ({ mutate: vi.fn() }) }));
vi.mock('@/hooks/use-projects', () => ({ useCreateProject: () => ({ mutateAsync: f.project }), useProjects: () => ({ data: f.projects, isPending: f.pending }) }));
vi.mock('@/hooks/use-tags', () => ({ useTags: () => ({ data: [] }) }));
vi.mock('@/hooks/use-ai', () => ({ useUserPrefs: () => ({ data: { timezone: 'UTC' }, isPending: false }), useParseTaskAI: () => ({ mutateAsync: f.ai }) }));
vi.mock('@/hooks/use-calendar', () => ({ useCalendarConnection: () => ({ data: { connected: f.connected } }) }));
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }));
vi.mock('@/store/ui', () => ({ useUIStore: (select: any) => select({ quickAddOpen: true, setQuickAddOpen: f.close }) }));
vi.mock('./voice-button', () => ({ VoiceButton: () => null }));
vi.mock('./scan-tasks-sheet', () => ({ ScanTasksSheet: () => null }));
import { QuickAdd } from './quick-add';
import { InlineTaskInput } from './inline-task-input';
let tree: ReactTestRenderer; let qc: QueryClient;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-03T12:00:00Z'));
  vi.clearAllMocks(); f.projects = []; f.pending = false; f.connected = false;
  f.task.mockResolvedValue({ id: 'saved-task' }); f.project.mockResolvedValue({ id: 'new-list', name: 'NewList' });
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ phrases: [], rows: [] }) })));
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => { act(() => tree?.unmount()); qc.clear(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const input = () => tree.root.findAllByType('input')[0];
function submit(kind: string) { return kind === 'quick' ? input().props.onKeyDown({ key: 'Enter' }) : tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); }
async function mount(kind: string, value: string) {
  await act(async () => { tree = create(<QueryClientProvider client={qc}>{kind === 'quick' ? <QuickAdd /> : <InlineTaskInput defaultProjectId="default-list" />}</QueryClientProvider>); });
  await act(async () => input().props.onChange({ target: { value } }));
}
it.each(['quick', 'inline'])('current-main regression: %s resolves an explicit missing list before saving without AI', async kind => {
  await mount(kind, 'Synthetic task ~NewList'); await act(async () => { await submit(kind); });
  expect(f.project).toHaveBeenCalledWith({ name: 'NewList' });
  expect(f.task).toHaveBeenCalledWith(expect.objectContaining({ title: 'Synthetic task', project_id: 'new-list' }));
  expect(f.project.mock.invocationCallOrder[0]).toBeLessThan(f.task.mock.invocationCallOrder[0]); expect(f.ai).not.toHaveBeenCalled();
});
it.each(['quick', 'inline'])('current-main regression: %s retains the entire draft after list failure', async kind => {
  f.project.mockRejectedValueOnce(new Error('Fixture list failure'));
  const raw = 'Synthetic task tomorrow 9am ~NewList #work';
  await mount(kind, raw); await act(async () => { await submit(kind); });
  expect(f.task).not.toHaveBeenCalled(); expect(input().props.value).toBe(raw); expect(f.close).not.toHaveBeenCalledWith(false);
  await act(async () => { await submit(kind); }); expect(f.task).toHaveBeenCalledTimes(1);
});
it.each(['quick', 'inline'])('%s reuses an existing list case-insensitively', async kind => {
  f.projects = [{ id: 'existing-list', name: 'NewList' }];
  await mount(kind, 'Synthetic task tomorrow 9am ~newlist'); await act(async () => { await submit(kind); });
  expect(f.project).not.toHaveBeenCalled(); expect(f.task).toHaveBeenCalledWith(expect.objectContaining({ project_id: 'existing-list', time_kind: 'deadline', start_at: null, due_at: expect.any(String) }));
});
it.each(['quick', 'inline'])('%s blocks repeated submit while pending', async kind => {
  let finish!: (value: any) => void; f.task.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await mount(kind, 'Synthetic pending'); await act(async () => { void submit(kind); void submit(kind); });
  expect(f.task).toHaveBeenCalledTimes(1); await act(async () => finish({ id: 'saved-task' }));
});
it.each(['quick', 'inline'])('%s does not write a blank draft', async kind => {
  await mount(kind, '   '); await act(async () => { await submit(kind); }); expect(f.task).not.toHaveBeenCalled(); expect(f.project).not.toHaveBeenCalled();
});

it.each(['quick', 'inline'])('%s calendar capture keeps civil intent and sends an exclusive end', async kind => {
  f.connected = true;
  await mount(kind, 'Calendar event Fixture tomorrow');
  await act(async () => { await submit(kind); });
  const request = vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/calendar/google/event');
  expect(JSON.parse(request![1]!.body as string)).toMatchObject({ title: 'Fixture', is_all_day: true, start_date: '2026-11-04', end_date: '2026-11-05' });
  expect(f.task).not.toHaveBeenCalled();
});
it.each(['quick', 'inline'])('%s failed event write preserves its draft and never creates a native task', async kind => {
  f.connected = true;
  await mount(kind, 'Calendar event Fixture tomorrow at midnight');
  vi.mocked(fetch).mockResolvedValue({ ok: false, text: async () => 'fixture_failed', json: async () => ({error:'fixture_failed'}) } as Response);
  await act(async () => { await submit(kind); });
  expect(input().props.value).toBe('Calendar event Fixture tomorrow at midnight');
  expect(f.close).not.toHaveBeenCalledWith(false); expect(f.task).not.toHaveBeenCalled();
  const request = vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/calendar/google/event');
  expect(JSON.parse(request![1]!.body as string)).toMatchObject({ is_all_day: false, start_at: '2026-11-04T00:00:00.000Z' });
});
