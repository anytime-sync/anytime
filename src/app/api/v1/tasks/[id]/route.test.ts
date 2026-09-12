import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ current: { start_at: '2026-09-07T08:30:00Z', due_at: '2026-09-07T09:00:00Z', is_all_day: false }, patch: null as Record<string, unknown> | null, filters: [] as unknown[], authorized: true }));
vi.mock('../../_lib/auth', () => ({
  requireApiAuth: async () => state.authorized ? { ok: true, userId: 'owner', supabase: { from: () => {
    const query = {
      select: () => query,
      eq: (column: string, value: string) => { state.filters.push([column, value]); return query; },
      update: (patch: Record<string, unknown>) => { state.patch = patch; return query; },
      maybeSingle: async () => ({ data: state.patch ?? state.current, error: null }),
    }; return query;
  } } } : { ok: false, response: Response.json({}, { status: 401 }) },
  jsonError: (status: number, code: string, message: string) => Response.json({ code, message }, { status }),
  jsonOk: (value: unknown) => Response.json(value),
}));
import { PATCH } from './route';
beforeEach(() => { state.patch = null; state.filters = []; state.authorized = true; });
const request = (body: unknown) => new NextRequest('https://example.test/api/v1/tasks/task', { method: 'PATCH', body: JSON.stringify(body) });
it('MCP/API due-only moves preserve a 30-minute work block and scope both queries', async () => {
  const response = await PATCH(request({ due_at: '2026-09-14T09:00:00Z' }), { params: { id: 'task' } });
  expect(response.status).toBe(200);
  expect(state.patch?.start_at).toBe('2026-09-14T08:30:00.000Z');
  expect(state.filters.filter(v => JSON.stringify(v) === '["user_id","owner"]')).toHaveLength(2);
});
it('does not silently replace a supplied deadline with a later one', async () => {
  const response = await PATCH(request({ start_at: '2026-09-15T09:00:00Z', due_at: '2026-09-14T09:00:00Z' }), { params: { id: 'task' } });
  expect(response.status).toBe(400); expect(state.patch).toBeNull();
});
it('rejects null JSON rather than crashing', async () => {
  expect((await PATCH(request(null), { params: { id: 'task' } })).status).toBe(400);
});
it('does not read or write dates for unauthorized callers', async () => {
  state.authorized = false;
  expect((await PATCH(request({ due_at: '2026-09-14' }), { params: { id: 'task' } })).status).toBe(401);
  expect(state.filters).toHaveLength(0); expect(state.patch).toBeNull();
});
