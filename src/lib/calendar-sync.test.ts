import { beforeEach, expect, it, vi } from 'vitest';
import { syncUserCalendar } from './calendar-sync';

const mocks = vi.hoisted(() => ({ list: vi.fn(), token: vi.fn() }));
vi.mock('./google-calendar', () => ({ listCalendarEvents: mocks.list }));
vi.mock('./calendar-token', () => ({ getValidAccessToken: mocks.token }));
vi.mock('./calendar-write', () => ({ isOurOwnEventTag: (tags?: Record<string, string>) => !!tags?.firstlightTaskId }));

function db(syncToken: string | null = null, updateError: string | null = null) {
  const updates: Record<string, unknown>[] = [];
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const chain = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: 'user', primary_calendar_id: 'primary', sync_token: syncToken }, error: null }),
    update: vi.fn((value) => { updates.push(value); return chain; }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error: updateError ? { message: updateError } : null }).then(resolve),
    upsert,
  };
  return { supabase: { from: vi.fn(() => chain) } as any, updates, upsert };
}

beforeEach(() => { vi.clearAllMocks(); mocks.token.mockResolvedValue('test-token'); });

it('restarts an expired incremental token with a bounded full-sync window', async () => {
  const client = db('expired');
  mocks.list.mockRejectedValueOnce(new Error('google_sync_token_expired'))
    .mockResolvedValueOnce({ items: [], nextSyncToken: 'fresh' });
  expect((await syncUserCalendar({ supabase: client.supabase, userId: 'user' })).status).toBe('ok');
  expect(mocks.list.mock.calls[1][0]).toMatchObject({ syncToken: null, pageToken: undefined });
  expect(Date.parse(mocks.list.mock.calls[1][0].timeMax) - Date.parse(mocks.list.mock.calls[1][0].timeMin)).toBe(120 * 86400000);
  expect(client.updates.at(-1)?.sync_token).toBe('fresh');
});

it('does not mark a truncated page sequence as successfully synced', async () => {
  const client = db();
  mocks.list.mockResolvedValue({ items: [], nextPageToken: 'more' });
  expect(await syncUserCalendar({ supabase: client.supabase, userId: 'user' })).toMatchObject({ status: 'error', error: 'calendar_sync_page_limit' });
  expect(mocks.list).toHaveBeenCalledTimes(25);
  expect(client.updates).toHaveLength(0);
});

it('propagates checkpoint persistence failures instead of reporting success', async () => {
  const client = db(null, 'checkpoint failed');
  mocks.list.mockResolvedValue({ items: [], nextSyncToken: 'fresh' });
  expect(await syncUserCalendar({ supabase: client.supabase, userId: 'user' })).toMatchObject({ status: 'error', error: 'checkpoint failed' });
});

it('upserts external events by stable identity and excludes task echoes', async () => {
  const client = db();
  mocks.list.mockResolvedValue({ items: [
    { id: 'external', summary: 'Lesson', start: { dateTime: '2026-10-17T09:30:00+08:00' }, end: { dateTime: '2026-10-17T12:30:00+08:00' } },
    { id: 'echo', extendedProperties: { private: { firstlightTaskId: 'task' } } },
  ], nextSyncToken: 'fresh' });
  for (let i = 0; i < 2; i++) expect((await syncUserCalendar({ supabase: client.supabase, userId: 'user' })).count).toBe(1);
  expect(client.upsert.mock.calls[0][0]).toHaveLength(1);
  expect(client.upsert.mock.calls[0][1]).toEqual({ onConflict: 'user_id,provider,external_id' });
  expect(client.upsert.mock.calls[1][0][0].external_id).toBe('external');
});
