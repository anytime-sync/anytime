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
  if (!body.start_at) {
    return NextResponse.json({ error: "start_at_required" }, { status: 400 });
  }

  // Look up the user's primary calendar id from their connection row.
  const { data: conn } = await supabase
    .from("user_calendar_connections")
    .select("calendar_id")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle();
  const calendarId = (conn as { calendar_id?: string } | null)?.calendar_id;
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

  // Compute end_at if caller didn't supply it.
  const allDay = !!body.is_all_day;
  const startIso = body.start_at;
  const endIso =
    body.end_at ??
    (allDay
      ? new Date(
          new Date(startIso.slice(0, 10) + "T00:00:00").getTime() + 86400000
        ).toISOString()
      : new Date(new Date(startIso).getTime() + 60 * 60_000).toISOString());

  // Build the Google-shaped input. All-day events use {date}, timed
  // events use {dateTime}. Google does the rest.
  const eventInput: GoogleCalendarEventInput = {
    summary: title,
    description: body.description || undefined,
    location: body.location || undefined,
    start: allDay ? { date: startIso.slice(0, 10) } : { dateTime: startIso },
    end: allDay ? { date: endIso.slice(0, 10) } : { dateTime: endIso },
  };

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

  // Mirror locally so the UI shows the new event immediately. The cron
  // sweep will reconcile any drift (e.g. attendee responses) later.
  const localStart = allDay
    ? new Date(startIso.slice(0, 10) + "T00:00:00").toISOString()
    : startIso;
  const localEnd = allDay
    ? new Date(endIso.slice(0, 10) + "T23:59:59").toISOString()
    : endIso;

  const { error: insertErr } = await service.from("calendar_events").upsert(
    {
      user_id: user.id,
      provider: "google",
      external_id: created.id,
      calendar_id: calendarId,
      title: created.summary ?? title,
      description: body.description ?? null,
      location: body.location ?? null,
      start_at: localStart,
      end_at: localEnd,
      is_all_day: allDay,
      status: "confirmed",
      html_link: created.htmlLink ?? null,
      attendees_count: 0,
      raw: created as unknown as Record<string, unknown>,
      fetched_at: new Date().toISOString(),
      cancelled: false,
    },
    { onConflict: "user_id,provider,external_id" }
  );
  if (insertErr) {
    console.error("[google-event POST] mirror failed", insertErr);
    // Don't fail the request — the event IS in Google; cron will re-sync.
  }

  return NextResponse.json({ ok: true, event_id: created.id });
}
