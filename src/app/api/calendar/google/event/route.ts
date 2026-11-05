import { googleEventDates, toCalendarEventRow } from "@/lib/calendar-event-dates";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "@/lib/calendar-token";
import {
  createCalendarEvent,
  type GoogleCalendarEventInput,
} from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Round F v4.7: POST /api/calendar/google/event
 *
 * Creates a new event on the user's primary Google Calendar from a
 * minimal payload, then mirrors the row into local calendar_events so
 * the UI shows it instantly without waiting for the next cron tick.
 *
 * Body:
 *   { title: string,
 *     start_at: ISO string,
 *     end_at?: ISO string,        (defaults to start + 1h for timed,
 *                                   or start day +1 for all-day)
 *     is_all_day?: boolean,
 *     description?: string,
 *     location?: string }
 *
 * Companion routes (existing):
 *   GET/PATCH/DELETE /api/calendar/google/event/[id]
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    title?: string;
    start_at?: string;
    start_date?: string;
    end_date?: string;
    end_at?: string;
    is_all_day?: boolean;
    description?: string;
    location?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }
  if (!body.start_at && !body.start_date) {
    return NextResponse.json({ error: "start_at_required" }, { status: 400 });
  }

  // Look up the user's primary calendar id from their connection row.
  const { data: conn } = await supabase
    .from("user_calendar_connections")
    .select("primary_calendar_id")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle();
  const calendarId = (conn as { primary_calendar_id?: string } | null)?.primary_calendar_id;
  if (!calendarId) {
    return NextResponse.json(
      { error: "no_calendar_connection" },
      { status: 400 }
    );
  }

  // Service-role client + a fresh access token (auto-refreshes if expired).
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supaUrl) {
    return NextResponse.json(
      { error: "supabase_misconfigured" },
      { status: 500 }
    );
  }
  const service = createServiceClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let accessToken: string | null;
  try {
    accessToken = await getValidAccessToken({
      supabase: service,
      userId: user.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "token_refresh_failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  if (!accessToken) {
    return NextResponse.json({ error: "no_access_token" }, { status: 401 });
  }

  const { data: prefs, error: prefsError } = await supabase.from('user_preferences').select('timezone').eq('user_id', user.id).maybeSingle();
  if (prefsError) return NextResponse.json({ error: 'account_timezone_unavailable' }, { status: 500 });
  const timezone = prefs?.timezone || 'UTC';
  let eventInput: GoogleCalendarEventInput;
  try { eventInput = { summary: title, description: body.description || undefined, location: body.location || undefined, ...googleEventDates(body, timezone) }; }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }

  let created;
  try {
    created = await createCalendarEvent({
      accessToken,
      calendarId,
      event: eventInput,
      // No attendees on quick-create, so silent.
      sendUpdates: "none",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "google_create_failed";
    console.error("[google-event POST]", msg, e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const { error: insertErr } = await service.from('calendar_events').upsert(
    toCalendarEventRow({ userId: user.id, calendarId, ev: created, timezone }),
    { onConflict: 'user_id,provider,external_id' }
  );
  if (insertErr) {
    console.error("[google-event POST] mirror failed", insertErr);
    // Don't fail the request — the event IS in Google; cron will re-sync.
  }

  return NextResponse.json({ ok: true, event_id: created.id, mirror_pending: !!insertErr });
}
