import React from 'react';
import { act, create } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
import { useSyncCalendarNow } from './use-calendar';
it.each([true, false])(
  'invalidates native tasks, details and subtasks after partial response/error (%s)',
  async (response) => {
    const qc = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
      }),
      invalidate = vi.spyOn(qc, 'invalidateQueries');
    let mutation: any, tree: any;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify(
              response
                ? {
                    ok: false,
                    inbound: { status: 'error', tasks_updated: 1 },
                    outbound: { error: 'offline' },
                    deletions: {},
                    pending: 1,
                    conflicts: 1,
                    pending_deletions: 0,
                  }
                : { error: 'offline' },
            ),
            { status: response ? 200 : 503 },
          ),
        ),
    );
    function Probe() {
      mutation = useSyncCalendarNow();
      return null;
    }
    await act(async () => {
      tree = create(
        <QueryClientProvider client={qc}>
          <Probe />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await mutation.mutateAsync().catch(() => {});
    });
    for (const key of [
      'tasks',
      'task',
      'subtasks',
      'subtaskCounts',
      'calendarEvents',
      'calendarConnection',
      'upcoming-reminders',
      'calendarSyncIssues',
    ])
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] });
    act(() => tree.unmount());
    qc.clear();
    vi.unstubAllGlobals();
  },
);
