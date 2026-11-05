import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ mirrors: [] as any[], inputs: [] as any[] }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } } }) },
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({
          data:
            table === 'user_preferences'
              ? { timezone: 'Asia/Taipei' }
              : { primary_calendar_id: 'fixture-calendar' },
          error: null,
        }),
      };
      return q;
    },
  }),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      upsert: async (row: any) => {
        f.mirrors.push(row);
        return { error: null };
      },
    }),
  }),
}));
vi.mock('@/lib/calendar-token', () => ({
  getValidAccessToken: async () => 'fixture-token',
}));
vi.mock('@/lib/google-calendar', () => ({
  createCalendarEvent: async ({ event }: any) => {
    f.inputs.push(event);
    return { ...event, id: 'fixture-event', etag: '"fixture-v1"' };
  },
}));
import { POST } from './route';
beforeEach(() => {
  f.mirrors = [];
  f.inputs = [];
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.invalid');
});
afterEach(() => vi.unstubAllEnvs());
it.each(['2026-11-04T16:00:00.000Z', '2026-11-05'])(
  'all-day absent end preserves Taipei November 5 from %s',
  async (start_at) => {
    const result = await POST(
      new Request('http://fixture.test/api/calendar/google/event', {
        method: 'POST',
        body: JSON.stringify({ title: 'Fixture', start_at, is_all_day: true }),
      }),
    );
    expect(result.status).toBe(200);
    expect(f.inputs[0]).toMatchObject({
      start: { date: '2026-11-05' },
      end: { date: '2026-11-06' },
    });
    expect(f.mirrors[0]).toMatchObject({
      start_at: '2026-11-04T16:00:00.000Z',
      end_at: '2026-11-05T16:00:00.000Z',
      raw: { start: { date: '2026-11-05' }, end: { date: '2026-11-06' } },
    });
  },
);
