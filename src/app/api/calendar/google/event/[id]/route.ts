import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "@/lib/calendar-token";
import {
  deleteCalendarEvent,
  patchCalendarEvent,
  type GoogleCalendarEventInput,
} from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/calendar/google/event/[id]
 *   body: { title?, start_at?, end_at?, location?, description? }
 *   - looks up the calendar_events row (must belong to current user)
 *   - patches the event on Google (PATCH /events/{external_id})
 *   - mirrors the change locally so the UI reflects it instantly
 *
 * DELETE /api/calendar/google/event/[id]
 *   - DELETEs the event on Google
 *   - removes the local calendar_events row
 *
 * Round F v3 — lets users edit Google-sourced events from First Light.
 * Companion to Round F v2 which pushes First Light tasks to Google.
 */

type CalendarEventRow = {
  id: string;
  user_id: string;
  provider: string;
  external_id: string;
  calendar_id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  start_at: string | null;
  end_at: string | null;
  is_all_day: boolean | null;
};

export async function PATCH(
  req: Request,
  ctx: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let patch: {
    title?: string;
    start_at?: string;
    end_at?: string;
    location?: string;
    description?: string;
  };
  try {
    patch = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  // Look up the row, scoped to current user.
  const { data: rowRaw, error: lookupErr } = await supabase
    .from("calendar_events")
    .select(
      "id, user_id, provider, external_id, calendar_id, title, description, location, start_at, end_at, is_all_day"
    )
    .eq("id", ctx.params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  const row = rowRaw as CalendarEventRow | null;
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (row.provider !== "google") {
    return NextResponse.json(
      { error: "unsupported_provider" },
      { status: 400 }
    );
  }

  // Get a valid access token. We need a service-role supabase client because
  // calendar-token reads/writes user_calendar_connections (refresh_token rotation).
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

  // Build the Google-side patch. Only include fields the caller actually sent
  // — Google's PATCH preserves anything we don't include (vs PUT which would
  // wipe attendees, recurrence rules, etc.).
  const isAllDay = Boolean(row.is_all_day);
  const googlePatch: Partial<GoogleCalendarEventInput> = {};
  if (typeof patch.title === "string") googlePatch.summary = patch.title;
  if (typeof patch.description === "string")
    googlePatch.description = patch.description;
  if (typeof patch.location === "string") googlePatch.location = patch.location;
  if (typeof patch.start_at === "string") {
    googlePatch.start = isAllDay
      ? { date: patch.start_at.slice(0, 10) }
      : { dateTime: patch.start_at };
  }
  if (typeof patch.end_at === "string") {
    googlePatch.end = isAllDay
      ? { date: patch.end_at.slice(0, 10) }
      : { dateTime: patch.end_at };
  }
  if (Object.keys(googlePatch).length === 0) {
    return NextResponse.json({ error: "nothing_to_patch" }, { status: 400 });
  }

  try {
    await patchCalendarEvent({
      accessToken,
      calendarId: row.calendar_id,
      eventId: row.external_id,
      patch: googlePatch,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "google_patch_failed";
    console.error("[google-event PATCH]", msg, e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Mirror locally so the UI sees the change before the next cron tick.
  const localUpdate: Record<string, unknown> = {
    fetched_at: new Date().toISOString(),
  };
  if (typeof patch.title === "string") localUpdate.title = patch.title;
  if (typeof patch.description === "string")
    localUpdate.description = patch.description;
  if (typeof patch.location === "string") localUpdate.location = patch.location;
  if (typeof patch.start_at === "string") localUpdate.start_at = patch.start_at;
  if (typeof patch.end_at === "string") localUpdate.end_at = patch.end_at;

  const { data: updated, error: updErr } = await service
    .from("calendar_events")
    .update(localUpdate)
    .eq("id", row.id)
    .select()
    .single();
  if (updErr) {
    // Google succeeded, our mirror failed. Don't bubble — next cron tick will
    // re-pull and reconcile. Just log.
    console.error("[google-event PATCH] mirror failed", updErr);
  }

  return NextResponse.json({ event: updated ?? null, ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: rowRaw, error: lookupErr } = await supabase
    .from("calendar_events")
    .select("id, user_id, provider, external_id, calendar_id")
    .eq("id", ctx.params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  const row = rowRaw as
    | (Pick<CalendarEventRow, "id" | "user_id" | "provider"> & {
        external_id: string;
        calendar_id: string;
      })
    | null;
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (row.provider !== "google") {
    return NextResponse.json(
      { error: "unsupported_provider" },
      { status: 400 }
    );
  }

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

  try {
    await deleteCalendarEvent({
      accessToken,
      calendarId: row.calendar_id,
      eventId: row.external_id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "google_delete_failed";
    console.error("[google-event DELETE]", msg, e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Drop the local row.
  await service.from("calendar_events").delete().eq("id", row.id);

  return NextResponse.json({ ok: true });
}
