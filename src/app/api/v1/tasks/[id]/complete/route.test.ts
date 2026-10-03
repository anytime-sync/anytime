import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ missing: false, historyError: false, updated: false }));
vi.mock('../../../_lib/auth', () => ({
  requireApiAuth: async () => ({ ok: true, userId: 'owner', supabase: { from: () => {
    const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: state.missing ? null : { title: 'Daily', rrule: 'FREQ=DAILY', due_at: '2026-10-03T01:00:00Z' }, error: null }), insert: async () => ({ error: state.historyError ? { message: 'History write failed' } : null }), update: () => { state.updated = true; return q; }, single: async () => ({ data: {}, error: null }) }; return q;
  } } }),
  jsonError: (status: number, code: string, message: string) => Response.json({ code, message }, { status }),
  jsonOk: (value: unknown) => Response.json(value),
}));
import { POST } from './route';
beforeEach(() => { state.missing = false; state.historyError = false; state.updated = false; });
const request = () => new NextRequest('https://example.test/api/v1/tasks/task/complete', { method: 'POST' });
it('missing tasks return 404 rather than a database error', async () => {
  state.missing = true;
  expect((await POST(request(), { params: { id: 'task' } })).status).toBe(404);
});
it('does not advance recurring tasks when completion history cannot be written', async () => {
  state.historyError = true;
  expect((await POST(request(), { params: { id: 'task' } })).status).toBe(500);
  expect(state.updated).toBe(false);
});
