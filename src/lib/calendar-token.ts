/**
 * calendar-token.ts — owns the "give me a fresh access_token" path for
 * the Google Calendar integration.
 *
 * Reads `user_calendar_connections`, refreshes the access_token via
 * Google's token endpoint if it's about to expire, persists the new
 * token + expiry, and returns the bearer string callers should use.
 *
 * Service-role only. Callers (cron route, sync-now route) pass in
 * their already-instantiated service-role supabase client so this
 * file doesn't need to know how to construct one.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshAccessToken } from "./google-calendar";

/** Refresh if the token expires in less than this many ms. */
const REFRESH_BUFFER_MS = 60_000;

type ConnectionRow = {
  user_id: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: string | null;
};

/**
 * Returns a valid access token for the given user, or null if the user
 * isn't connected. Refreshes + persists if the cached one is stale.
 *
 * Throws on Google API errors so callers can surface them — we don't
 * want to silently return null and hide a refresh failure.
 */
export async function getValidAccessToken({
  supabase,
  userId,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  userId: string;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_calendar_connections")
    .select("user_id, refresh_token, access_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (error) {
    throw new Error(`calendar_token_fetch_failed: ${error.message}`);
  }
  const row = data as ConnectionRow | null;
  if (!row) return null;

  const now = Date.now();
  const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const stillFresh =
    !!row.access_token && expiresAtMs - now > REFRESH_BUFFER_MS;
  if (stillFresh && row.access_token) return row.access_token;

  if (!row.refresh_token) {
    // We don't have a refresh token — caller will need to re-connect.
    return null;
  }

  const refreshed = await refreshAccessToken(row.refresh_token);
  const newExpiresAt = new Date(
    Date.now() + refreshed.expires_in * 1000
  ).toISOString();

  const { error: upErr } = await supabase
    .from("user_calendar_connections")
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "google");
  if (upErr) {
    // Persisted refresh failed — still return the fresh token so the
    // current request succeeds, but log so we can investigate.
    console.error("[calendar-token] persist failed", upErr);
  }
  return refreshed.access_token;
}
