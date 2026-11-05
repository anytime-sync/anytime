import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({
  db: null as any,
  patch: vi.fn(),
  remove: vi.fn(),
  get: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: () => fixture.db }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => fixture.db }));
vi.mock('@/lib/calendar-token', () => ({
  getValidAccessToken: async () => 'fixture-token',
}));
vi.mock('@/lib/google-calendar', () => ({
  patchCalendarEvent: fixture.patch,
  deleteCalendarEvent: fixture.remove,
  getCalendarEvent: fixture.get,
}));
import { fixtureDatabase } from '@/lib/__fixtures__/worldwide/calendar';
import { PATCH, DELETE } from './route';
let data: ReturnType<typeof fixtureDatabase>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.invalid');
  data = fixtureDatabase();
  fixture.db = data.db;
  fixture.db.auth = {
    getUser: async () => ({ data: { user: { id: 'owner' } } }),
  };
  data.tables.calendar_events.push({
    id: 'row',
    user_id: 'owner',
    provider: 'google',
    external_id: 'event',
    calendar_id: 'primary',
    title: 'Previous',
    start_at: '2026-11-04T16:00Z',
    end_at: '2026-11-05T16:00Z',
    is_all_day: true,
    raw: {
      id: 'event',
      etag: '"previous"',
      start: { date: '2026-11-05' },
      end: { date: '2026-11-06' },
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
function request(method: string, etag = '"previous"') {
  return new Request('http://fixture.test/api/calendar/google/event/row', {
    method,
    headers: { 'If-Match': etag },
    ...(method === 'PATCH'
      ? { body: JSON.stringify({ title: 'Proposed' }) }
      : {}),
  });
}
it.each(['PATCH', 'DELETE'])(
  '%s 412 refreshes one complete revision and does not retry the write',
  async (method) => {
    const write = method === 'PATCH' ? fixture.patch : fixture.remove;
    write.mockRejectedValue(new Error('google_precondition_failed'));
    fixture.get.mockResolvedValue({
      id: 'event',
      etag: '"new"',
      summary: 'Remote',
      description: 'Changed notes',
      start: { date: '2026-11-08' },
      end: { date: '2026-11-10' },
    });
    const response = await (method === 'PATCH' ? PATCH : DELETE)(
      request(method),
      { params: { id: 'row' } },
    );
    expect(response.status).toBe(409);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ ifMatch: '"previous"' }),
    );
    expect(data.tables.calendar_events[0]).toMatchObject({
      title: 'Remote',
      description: 'Changed notes',
      start_at: '2026-11-07T16:00:00.000Z',
      end_at: '2026-11-09T16:00:00.000Z',
      raw: { etag: '"new"' },
    });
  },
);
it('a missing or stale reviewed revision cannot authorize a provider write', async () => {
  expect(
    (await PATCH(request('PATCH', '"stale"'), { params: { id: 'row' } }))
      .status,
  ).toBe(409);
  expect(fixture.patch).not.toHaveBeenCalled();
});
it('an instance ETag cannot authorize a series write', async () => {
  data.tables.calendar_events[0].raw.recurringEventId = 'master';
  const req = new Request(
    'http://fixture.test/api/calendar/google/event/row?scope=series',
    { method: 'DELETE', headers: { 'If-Match': '"previous"' } },
  );
  expect((await DELETE(req, { params: { id: 'row' } })).status).toBe(409);
  expect(fixture.remove).not.toHaveBeenCalled();
});
