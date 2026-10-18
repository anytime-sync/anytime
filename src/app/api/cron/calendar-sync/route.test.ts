import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ client: vi.fn(), sync: vi.fn(), drain: vi.fn(), push: vi.fn(), token: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.client }));
vi.mock('@/lib/calendar-sync', () => ({ syncUserCalendar: mocks.sync }));
vi.mock('@/lib/calendar-write', () => ({ drainCalendarDeletions: mocks.drain, pushPendingTasksForUser: mocks.push }));
vi.mock('@/lib/calendar-token', () => ({ getValidAccessToken: mocks.token }));
import { GET } from './route';

let connections: Array<{user_id: string; primary_calendar_id: string | null}>;
let queryError: object | null;
const request = () => GET(new Request('https://fixture.invalid/api/cron/calendar-sync', {headers: {authorization: 'Bearer fixture-cron'}}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CRON_SECRET', 'fixture-cron');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture-service');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.invalid');
  vi.stubGlobal('fetch', () => { throw new Error('Live network forbidden'); });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  connections = []; queryError = null;
  mocks.client.mockReturnValue({from: vi.fn((table: string) => {
    expect(table).toBe('user_calendar_connections');
    return {select: vi.fn(() => ({eq: vi.fn(async (key, value) => {
      expect([key, value]).toEqual(['provider', 'google']);
      return {data: connections, error: queryError};
    })}))};
  })});
  mocks.drain.mockResolvedValue({deleted: 0, failed: 0});
  mocks.sync.mockImplementation(async ({userId}) => ({user_id: userId, status: 'ok', count: 1}));
  mocks.token.mockResolvedValue('fixture-access');
  mocks.push.mockResolvedValue({created: 0, patched: 0, failed: 0});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('drains once, preserves per-user failures and continues to the next account', async () => {
  connections = [{user_id: 'broken', primary_calendar_id: 'primary'}, {user_id: 'healthy', primary_calendar_id: 'primary'}];
  mocks.sync.mockRejectedValueOnce(new Error('fixture-read-failure'));
  mocks.push.mockRejectedValueOnce(new Error('fixture-write-failure'));
  const response = await request();
  // HTTP 200/ok alone is not a healthy-run signal: inspect every result.
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    ok: true, syncs: [{user_id: 'broken', status: 'error'}, {user_id: 'healthy', status: 'ok'}],
    pushes: [{user_id: 'broken', failed: -1}, {user_id: 'healthy', failed: 0}],
  });
  expect(mocks.drain).toHaveBeenCalledOnce();
  expect(mocks.drain.mock.invocationCallOrder[0]).toBeLessThan(mocks.sync.mock.invocationCallOrder[0]);
  expect(mocks.sync.mock.calls.map(([args]) => args.userId)).toEqual(['broken', 'healthy']);
});

it('continues reads without exporting for missing calendars or unavailable tokens', async () => {
  connections = ['no-calendar', 'no-token', 'token-error', 'healthy'].map(user_id => ({user_id, primary_calendar_id: user_id === 'no-calendar' ? null : 'primary'}));
  mocks.token.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('fixture-token-failure'));
  await request();
  expect(mocks.sync).toHaveBeenCalledTimes(4);
  expect(mocks.push).toHaveBeenCalledOnce();
  expect(mocks.push.mock.calls[0][0]).toMatchObject({userId: 'healthy'});
});

it('fails the connection query without claiming per-user progress', async () => {
  queryError = {message: 'fixture-query-failure'};
  const response = await request();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({error: 'fetch_failed'});
  expect(mocks.sync).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
});
