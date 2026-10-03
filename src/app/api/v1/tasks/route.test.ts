import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ anchor: { id: '00000000-0000-4000-8000-000000000001', due_at: '2026-10-03T01:00:00Z' as string | null, created_at: '2026-10-01T01:00:00Z' }, calls: [] as unknown[][] }));
vi.mock('../_lib/auth', () => ({
  requireApiAuth: async () => ({ ok: true, userId: 'owner', supabase: { from: () => {
    const q: any = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'gte', 'lte', 'lt', 'is', 'or', 'insert']) q[method] = (...args: unknown[]) => { state.calls.push([method, ...args]); return q; };
    q.maybeSingle = async () => ({ data: state.anchor, error: null });
    q.single = async () => ({ data: { id: 'created' }, error: null });
    q.then = (resolve: any) => resolve({ data: [], error: null });
    return q;
  } } }),
  jsonError: (status: number, code: string, message: string) => Response.json({ code, message }, { status }),
  jsonOk: (value: unknown, init?: ResponseInit) => Response.json(value, init),
}));
import { GET, POST } from './route';
beforeEach(() => { state.calls = []; state.anchor.due_at = '2026-10-03T01:00:00Z'; });
it('rejects null and array create bodies without a database write', async () => {
  for (const body of [null, []]) {
    const res = await POST(new NextRequest('https://example.test/api/v1/tasks', { method: 'POST', body: JSON.stringify(body) }));
    expect(res.status).toBe(400);
  }
  expect(state.calls).toEqual([]);
});
it('malformed priority types do not crash the creation endpoint', async () => {
  const res = await POST(new NextRequest('https://example.test/api/v1/tasks', { method: 'POST', body: JSON.stringify({ title: 'Task', priority: {} }) }));
  expect(res.status).toBe(201);
});
it('cursor continuation uses deadline, creation time and UUID tie-breaker, not UUID alone', async () => {
  const res = await GET(new NextRequest(`https://example.test/api/v1/tasks?cursor=${state.anchor.id}`));
  expect(res.status).toBe(200);
  expect(state.calls).toContainEqual(['eq', 'user_id', 'owner']);
  expect(state.calls).toContainEqual(['order', 'id', { ascending: true }]);
  const filter = state.calls.find(c => c[0] === 'or')?.[1] as string;
  expect(filter).toContain('due_at.gt.2026-10-03T01:00:00.000Z');
  expect(filter).toContain('due_at.is.null');
  expect(filter).toContain('created_at.lt.2026-10-01T01:00:00.000Z');
  expect(filter).toContain(`id.gt.${state.anchor.id}`);
  expect(state.calls.some(c => c[0] === 'lt' && c[1] === 'id')).toBe(false);
});
it('undated cursor stays in the null-deadline partition', async () => {
  state.anchor.due_at = null;
  await GET(new NextRequest(`https://example.test/api/v1/tasks?cursor=${state.anchor.id}`));
  expect(state.calls).toContainEqual(['is', 'due_at', null]);
});
it('rejects malformed cursors before they reach a PostgREST expression', async () => {
  expect((await GET(new NextRequest('https://example.test/api/v1/tasks?cursor=not-a-uuid'))).status).toBe(400);
  expect(state.calls.some(c => c[0] === 'or')).toBe(false);
});
