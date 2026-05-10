/**
 * calendar-sync.ts — Google Calendar read pass.
 *
 * Round F v2 change: skip events that carry our own
 * extendedProperties.private.firstlightTaskId tag — those came from
 * tasks we pushed via the write pass, so we already have them locally.
 * Without this filter we'd duplicate-store them in calendar_events
 * AND the UI would show both the task and a phantom "calendar event"
 * for the same thing.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "./calendar-token";
import {
  listCalendarEvents,
  type GoogleCalendarEvent,
} from "./google-calendar";
import { isOurOwnEventTag } from "./calendar-write";

export type SyncResult = {
  user_id: string;
  status: "ok" | "skipped" | "error";
  count: number;
  error?: string;
};

const BOOTSTRAP_PAST_MS = 30 * 24 * 60 * 60 * 1000;
const BOOTSTRAP_FUTURE_MS = 90 * 24 * 60 * 60 * 1000;

type ConnectionRow = {
  user_id: string;
  primary_calendar_id: string | null;
  sync_token: string | null;
};

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
  const MAX_PAGES = 25;

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

    // Round F v2: filter out events we created ourselves. They came from
    // tasks already in our DB — we don't want them duplicated as
    // calendar_events rows.
    const externalItems = resp.items.filter(
      (ev) => !isOurOwnEventTag(ev.extendedProperties?.private)
    );

    if (externalItems.length > 0) {
      const rows = externalItems.map((ev) =>
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
