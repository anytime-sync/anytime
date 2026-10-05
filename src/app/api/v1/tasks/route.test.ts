import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ inserted: null as Record<string, unknown> | null, authorized: true }));
vi.mock('../_lib/auth', () => ({
  requireApiAuth: async () => state.authorized ? { ok: true, userId: 'owner', supabase: { from: (table: string) => {
    const q = { select: () => q, eq: () => q,
      maybeSingle: async () => ({ data: { timezone: 'Asia/Taipei' }, error: null }),
      insert: (input: Record<string, unknown>) => { state.inserted = input; return q; },
      single: async () => ({ data: { id: 'fixture', ...state.inserted }, error: null }),
    }; return q;
  } } } : { ok: false, response: Response.json({}, { status: 401 }) },
  jsonError: (status: number, code: string, message: string) => Response.json({ code, message }, { status }),
  jsonOk: (value: unknown, init?: ResponseInit) => Response.json(value, init),
}));
import { POST } from './route';
beforeEach(() => { state.inserted = null; state.authorized = true; });
const request = (body: unknown) => new NextRequest('https://example.test/api/v1/tasks', { method: 'POST', body: JSON.stringify(body) });
it.each([{ due_at: '2026-10-08T09:00:00+08:00' }, { start_at: '2026-10-08T09:00:00+08:00' }])('does not synthesize the other endpoint: %j', async dates => {
  const response = await POST(request({ title: 'Deadline', ...dates }));
  expect(response.status).toBe(201); expect(state.inserted?.time_kind).toBe('deadline');
  expect(state.inserted?.start_at).toBe(dates.start_at ?? null); expect(state.inserted?.due_at).toBe(dates.due_at ?? null);
});
it('stores civil dates at Taipei midnight', async () => {
  expect((await POST(request({ title: 'Deadline', due_at: '2026-10-08' }))).status).toBe(201);
  expect(state.inserted).toMatchObject({ due_at: '2026-10-07T16:00:00.000Z', start_at: null, is_all_day: true });
});
it.each([{ start_at: '2026-10-08T09:00:00+08:00', due_at: '2026-10-08T09:03:00+08:00' }, { start_at: '2026-10-08T09:00:00+08:00', due_at: '2026-10-10T09:00:00+08:00' }])('retains deliberate short or long intervals: %j', async dates => {
  expect((await POST(request({ title: 'Work', ...dates }))).status).toBe(201);
  expect(state.inserted).toMatchObject({ ...dates, time_kind: 'work' });
});
it.each([null, { title: 'Bad', due_at: 'invalid' }, { title: 'Bad', due_at: '2026-02-31' }, { title: 'Bad', time_kind: 'unknown' }, { title: 'Bad', time_kind: 'work', start_at: '2026-10-08T09:00:00Z' }, { title: 'Bad', start_at: '2026-10-09', due_at: '2026-10-08' }])('rejects invalid input without writing: %j', async body => {
  expect((await POST(request(body))).status).toBe(400); expect(state.inserted).toBeNull();
});
it('checks authentication before reading preferences or writing', async () => {
  state.authorized = false; expect((await POST(request({ title: 'Bad' }))).status).toBe(401); expect(state.inserted).toBeNull();
});
