/**
 * calendar-sync.ts — shared "sync this user's Google calendar into our
 * cache" routine. Used by both the cron loop and the on-demand
 * sync-now route so behavior stays identical.
 *
 * Flow:
 *   1. getValidAccessToken — refresh if needed.
 *   2. listCalendarEvents — incremental if we have a sync_token,
 *      otherwise bootstrap a 30d-back / 90d-forward window.
 *   3. Page through nextPageToken until exhausted.
 *   4. Upsert each event into calendar_events (UNIQUE on
 *      user_id+provider+external_id). Cancellations stay as rows with
 *      cancelled=true so the UI can hide them client-side.
 *   5. Persist nextSyncToken + last_sync_at on the connection row so
 *      the next tick is incremental.
 *
 * If Google returns 410 (sync token expired) we wipe the sync_token
 * and bootstrap from time bounds — handled inside listCalendarEvents
 * by raising "google_sync_token_expired", caught here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "./calendar-token";
import {
  listCalendarEvents,
  type GoogleCalendarEvent,
} from "./google-calendar";

export type SyncResult = {
  user_id: string;
  status: "ok" | "skipped" | "error";
  count: number;
  error?: string;
};

const BOOTSTRAP_PAST_MS = 30 * 24 * 60 * 60 * 1000; // 30d
const BOOTSTRAP_FUTURE_MS = 90 * 24 * 60 * 60 * 1000; // 90d

type ConnectionRow = {
  user_id: string;
  primary_calendar_id: string | null;
  sync_token: string | null;
};

/**
 * Sync a single user's primary calendar. Caller passes a service-role
 * supabase client — RLS would otherwise block writes from this code
 * path.
 */
export async function syncUserCalendar({
  supabase,
  userId,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  userId: string;
}): Promise<SyncResult> {
  const { data: connRaw, error: connErr } = await supabase
    .from("user_calendar_connections")
    .select("user_id, primary_calendar_id, sync_token")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (connErr) {
    return { user_id: userId, status: "error", count: 0, error: connErr.message };
  }
  const conn = connRaw as ConnectionRow | null;
  if (!conn) {
    return { user_id: userId, status: "skipped", count: 0, error: "not_connected" };
  }
  if (!conn.primary_calendar_id) {
    return {
      user_id: userId,
      status: "error",
      count: 0,
      error: "no_primary_calendar_id",
    };
  }

  let accessToken: string | null;
  try {
    accessToken = await getValidAccessToken({ supabase, userId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "token_refresh_failed";
    return { user_id: userId, status: "error", count: 0, error: msg };
  }
  if (!accessToken) {
    return {
      user_id: userId,
      status: "error",
      count: 0,
      error: "no_access_token",
    };
  }

  const calendarId = conn.primary_calendar_id;
  let syncToken: string | null = conn.sync_token;
  let pageToken: string | undefined = undefined;
  let nextSyncToken: string | undefined = undefined;
  let total = 0;
  let pages = 0;
  const MAX_PAGES = 25; // hard cap; 25*250 = 6250 events/page-cycle

  // Bootstrap window if we have no sync token.
  const now = Date.now();
  const timeMin = syncToken
    ? undefined
    : new Date(now - BOOTSTRAP_PAST_MS).toISOString();
  const timeMax = syncToken
    ? undefined
    : new Date(now + BOOTSTRAP_FUTURE_MS).toISOString();

  while (pages < MAX_PAGES) {
    let resp;
    try {
      resp = await listCalendarEvents({
        accessToken,
        calendarId,
        syncToken,
        timeMin,
        timeMax,
        pageToken,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "list_events_failed";
      // Sync token expired — wipe + retry once with bootstrap bounds.
      if (msg === "google_sync_token_expired" && syncToken) {
        syncToken = null;
        pageToken = undefined;
        await supabase
          .from("user_calendar_connections")
          .update({ sync_token: null })
          .eq("user_id", userId)
          .eq("provider", "google");
        continue;
      }
      return { user_id: userId, status: "error", count: total, error: msg };
    }
    pages++;

    if (resp.items.length > 0) {
      const rows = resp.items.map((ev) =>
        toCalendarEventRow({ userId, calendarId, ev })
      );
      const { error: upErr } = await supabase
        .from("calendar_events")
        .upsert(rows, { onConflict: "user_id,provider,external_id" });
      if (upErr) {
        return {
          user_id: userId,
          status: "error",
          count: total,
          error: upErr.message,
        };
      }
      total += rows.length;
    }

    if (resp.nextPageToken) {
      pageToken = resp.nextPageToken;
      continue;
    }
    nextSyncToken = resp.nextSyncToken;
    break;
  }

  // Persist sync_token (only set on the last page) + bump last_sync_at.
  const { error: bumpErr } = await supabase
    .from("user_calendar_connections")
    .update({
      ...(nextSyncToken ? { sync_token: nextSyncToken } : {}),
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "google");
  if (bumpErr) {
    console.error("[calendar-sync] bump failed", bumpErr);
  }

  return { user_id: userId, status: "ok", count: total };
}

/**
 * Map a Google Calendar API event into our `calendar_events` row
 * shape. Cancellations keep the row but flip `cancelled=true` so the
 * UI can hide them without us losing audit history.
 */
function toCalendarEventRow({
  userId,
  calendarId,
  ev,
}: {
  userId: string;
  calendarId: string;
  ev: GoogleCalendarEvent;
}) {
  const startAt = ev.start?.dateTime ?? ev.start?.date ?? null;
  const endAt = ev.end?.dateTime ?? ev.end?.date ?? null;
  const isAllDay = !ev.start?.dateTime;
  const status = ev.status ?? "confirmed";
  return {
    user_id: userId,
    provider: "google" as const,
    external_id: ev.id,
    calendar_id: calendarId,
    title: ev.summary ?? null,
    description: ev.description ?? null,
    location: ev.location ?? null,
    start_at: startAt,
    end_at: endAt,
    is_all_day: isAllDay,
    status,
    html_link: ev.htmlLink ?? null,
    organizer_email: ev.organizer?.email ?? null,
    attendees_count: ev.attendees?.length ?? 0,
    raw: ev as unknown as Record<string, unknown>,
    fetched_at: new Date().toISOString(),
    cancelled: status === "cancelled",
  };
}
