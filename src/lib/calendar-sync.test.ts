import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), token: vi.fn() }));
vi.mock('./google-calendar', () => ({ listCalendarEvents: mocks.list }));
vi.mock('./calendar-token', () => ({ getValidAccessToken: mocks.token }));
import { syncUserCalendar } from './calendar-sync';
function database(bumpError: string | null = null) {
  const patches: Record<string, unknown>[] = [];
  const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { user_id: 'owner', primary_calendar_id: 'primary', sync_token: 'old' }, error: null }), update: (p: Record<string, unknown>) => { patches.push(p); return q; }, then: (resolve: any) => resolve({ error: bumpError ? { message: bumpError } : null }) };
  return { supabase: { from: () => q } as any, patches };
}
beforeEach(() => { vi.resetAllMocks(); mocks.token.mockResolvedValue('access'); });
it('expired sync tokens restart with a bounded bootstrap window', async () => {
  mocks.list.mockRejectedValueOnce(new Error('google_sync_token_expired')).mockResolvedValueOnce({ items: [], nextSyncToken: 'new' });
  const db = database();
  expect((await syncUserCalendar({ supabase: db.supabase, userId: 'owner' })).status).toBe('ok');
  expect(mocks.list.mock.calls[0][0].timeMin).toBeUndefined();
  const retry = mocks.list.mock.calls[1][0];
  expect(retry.syncToken).toBeNull();
  expect(Date.parse(retry.timeMax) - Date.parse(retry.timeMin)).toBe(120 * 86400000);
  expect(db.patches.at(-1)?.sync_token).toBe('new');
});
it('does not report a truncated paginated sync as successful or bump last_sync_at', async () => {
  mocks.list.mockResolvedValue({ items: [], nextPageToken: 'more' });
  const db = database();
  const result = await syncUserCalendar({ supabase: db.supabase, userId: 'owner' });
  expect(result.status).toBe('error'); expect(result.error).toBe('sync_page_limit_exceeded');
  expect(mocks.list).toHaveBeenCalledTimes(25); expect(db.patches).toEqual([]);
});
it('surfaces failed checkpoint persistence rather than claiming success', async () => {
  mocks.list.mockResolvedValue({ items: [], nextSyncToken: 'new' });
  const result = await syncUserCalendar({ supabase: database('write failed').supabase, userId: 'owner' });
  expect(result.status).toBe('error'); expect(result.error).toBe('write failed');
});
