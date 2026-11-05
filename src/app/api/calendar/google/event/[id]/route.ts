import { googleEventDates, toCalendarEventRow } from "@/lib/calendar-event-dates";
import type { GoogleCalendarEvent } from "@/lib/google-calendar";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "@/lib/calendar-token";
import {
  deleteCalendarEvent,
  getCalendarEvent,
  patchCalendarEvent,
  type GoogleCalendarEventInput,
} from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/calendar/google/event/[id]?scope=instance|series
 *   body: { title?, start_at?, end_at?, location?, description?, attendees? }
 *   - looks up the calendar_events row (must belong to current user)
 *   - patches the event on Google (PATCH /events/{external_id})
 *   - mirrors the change locally so the UI reflects it instantly
 *
 *   Round F v4 additions:
 *     - ?scope=series → if the event is a recurring instance, look up its
 *       master event id (raw.recurringEventId) and PATCH that instead, so
 *       the change applies to the entire series. Default: instance.
 *     - attendees?: string[] (just emails) → replaces the attendees list.
 *       Server expands to {email}[] for Google.
 *
 * DELETE /api/calendar/google/event/[id]?scope=instance|series
 *   - DELETEs the event (or master, if scope=series) on Google
 *   - removes the local calendar_events row(s)
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
  raw: Record<string, unknown> | null;
};

export async function PATCH(
  req: Request,
  ctx: { params: { id: string } }
) {
  const { user, error: authErr } = await getAuthedUser();
  if (authErr) return authErr;

  let patch: {
    title?: string;
    start_date?: string;
    end_date?: string;
    start_at?: string;
    end_at?: string;
    location?: string;
    description?: string;
    attendees?: string[];
  };
  try {
    patch = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") ?? "instance") as
    | "instance"
    | "series";

  // Look up the row, scoped to current user.
  const supabase = createClient();
  const { data: rowRaw, error: lookupErr } = await supabase
    .from("calendar_events")
    .select(
      "id, user_id, provider, external_id, calendar_id, title, description, location, start_at, end_at, is_all_day, raw"
    )
    .eq("id", ctx.params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  const row = rowRaw as CalendarEventRow | null;
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.provider !== "google") {
    return NextResponse.json(
      { error: "unsupported_provider" },
      { status: 400 }
    );
  }

  const { service, accessToken, error: tokenErr } = await getServiceAndToken(
    user.id
  );
  if (tokenErr) return tokenErr;

  // Round F v4: if scope=series, target the master event id instead of
  // this single instance. Master id is in raw.recurringEventId.
  let targetEventId = row.external_id;
  let targetIsSeries = false;
  if (scope === "series") {
    const recurringEventId = (row.raw as { recurringEventId?: string } | null)
      ?.recurringEventId;
    if (recurringEventId) {
      targetEventId = recurringEventId;
      targetIsSeries = true;
    }
    // If no recurringEventId, this isn't part of a series — silently fall
    // through and patch the single event (which IS the master).
  }

  const expectedEtag = req.headers.get('If-Match');
  if (!expectedEtag || expectedEtag !== row.raw?.etag || targetIsSeries) return NextResponse.json({ error: targetIsSeries ? 'Series editing needs a reviewed master baseline; edit the series in Google Calendar.' : 'Event revision changed. Reload and review before saving.' }, { status: 409 });
  const { data: prefs, error: prefsError } = await supabase.from('user_preferences').select('timezone').eq('user_id', user.id).maybeSingle();
  if (prefsError) return NextResponse.json({ error: 'account_timezone_unavailable' }, { status: 500 });
  const timezone = prefs?.timezone || 'UTC';
  // Build the Google-side patch. Only include fields the caller actually sent
  // — Google's PATCH preserves anything we don't include (vs PUT which would
  // wipe attendees, recurrence rules, etc.).
  const isAllDay = Boolean(row.is_all_day);
  const googlePatch: Partial<GoogleCalendarEventInput> = {};
  if (typeof patch.title === "string") googlePatch.summary = patch.title;
  if (typeof patch.description === "string")
    googlePatch.description = patch.description;
  if (typeof patch.location === "string") googlePatch.location = patch.location;
  if (patch.start_at || patch.end_at || patch.start_date || patch.end_date) {
    const raw = row.raw as GoogleCalendarEvent | null;
    try { Object.assign(googlePatch, googleEventDates({ is_all_day: isAllDay,
      start_at: patch.start_at || row.start_at || undefined, end_at: patch.end_at || row.end_at || undefined,
      start_date: patch.start_date ?? (patch.start_at ? undefined : raw?.start?.date ?? undefined),
      end_date: patch.end_date ?? (patch.end_at ? undefined : raw?.end?.date ?? undefined),
    }, timezone)); } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  }
  if (Array.isArray(patch.attendees)) {
    googlePatch.attendees = patch.attendees
      .filter((e) => typeof e === "string" && e.includes("@"))
      .map((email) => ({ email }));
  }
  if (Object.keys(googlePatch).length === 0) {
    return NextResponse.json({ error: "nothing_to_patch" }, { status: 400 });
  }

  let patched: GoogleCalendarEvent;
  try {
    patched = await patchCalendarEvent({
      accessToken,
      calendarId: row.calendar_id,
      eventId: targetEventId,
      patch: googlePatch,
      ifMatch: expectedEtag,
      // For series edits we want attendees notified; for time/title-only
      // tweaks too. Default behavior in lib is "all".
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "google_patch_failed";
    console.error("[google-event PATCH]", msg, e);
    if (msg === 'google_precondition_failed') {
      try {
        const latest = await getCalendarEvent({ accessToken, calendarId: row.calendar_id, eventId: targetEventId });
        if (!targetIsSeries) await service.from('calendar_events').update(toCalendarEventRow({ userId: user.id, calendarId: row.calendar_id, ev: latest, timezone })).eq('id', row.id).eq('user_id', user.id);
      } catch { /* Keep the existing baseline if the refresh fails. */ }
      return NextResponse.json({ error: 'Google changed this event. Reload and review before retrying.', conflict: true }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Mirror locally so the UI sees the change before the next cron tick.
  // For series edits, the master row may not exist locally (we sync only
  // singleEvents=true expansions) — only mirror when patching the row we
  // looked up.
  if (!targetIsSeries) {
    const { error: updErr } = await service.from('calendar_events')
      .update(toCalendarEventRow({ userId: user.id, calendarId: row.calendar_id, ev: patched!, timezone }))
      .eq('id', row.id).eq('user_id', user.id);
    if (updErr) return NextResponse.json({ ok: true, mirror_pending: true });
  } else {
    // Series edit: invalidate the sync_token so the next cron tick does a
    // fresh full-window pull and picks up all expanded instance changes.
    await service
      .from("user_calendar_connections")
      .update({ sync_token: null })
      .eq("user_id", user.id)
      .eq("provider", "google");
  }

  return NextResponse.json({
    ok: true,
    scope,
    targetEventId,
    targetIsSeries,
  });
}

export async function DELETE(
  req: Request,
  ctx: { params: { id: string } }
) {
  const { user, error: authErr } = await getAuthedUser();
  if (authErr) return authErr;

  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") ?? "instance") as
    | "instance"
    | "series";

  const supabase = createClient();
  const { data: rowRaw, error: lookupErr } = await supabase
    .from("calendar_events")
    .select(
      "id, user_id, provider, external_id, calendar_id, title, description, location, start_at, end_at, is_all_day, raw"
    )
    .eq("id", ctx.params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  const row = rowRaw as CalendarEventRow | null;
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.provider !== "google") {
    return NextResponse.json(
      { error: "unsupported_provider" },
      { status: 400 }
    );
  }

  const { service, accessToken, error: tokenErr } = await getServiceAndToken(
    user.id
  );
  if (tokenErr) return tokenErr;

  let targetEventId = row.external_id;
  let targetIsSeries = false;
  if (scope === "series") {
    const recurringEventId = (row.raw as { recurringEventId?: string } | null)
      ?.recurringEventId;
    if (recurringEventId) {
      targetEventId = recurringEventId;
      targetIsSeries = true;
    }
  }

  const expectedEtag = req.headers.get('If-Match');
  if (!expectedEtag || expectedEtag !== row.raw?.etag || targetIsSeries) return NextResponse.json({ error: targetIsSeries ? 'Series deletion needs a reviewed master baseline; edit the series in Google Calendar.' : 'Event revision changed. Reload and review before deleting.' }, { status: 409 });
  const { data: prefs, error: prefsError } = await supabase.from('user_preferences').select('timezone').eq('user_id', user.id).maybeSingle();
  if (prefsError) return NextResponse.json({ error: 'account_timezone_unavailable' }, { status: 500 });
  const timezone = prefs?.timezone || 'UTC';
  try {
    await deleteCalendarEvent({
      accessToken,
      calendarId: row.calendar_id,
      eventId: targetEventId,
      ifMatch: expectedEtag,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "google_delete_failed";
    console.error("[google-event DELETE]", msg, e);
    if (msg === 'google_precondition_failed') {
      try {
        const latest = await getCalendarEvent({ accessToken, calendarId: row.calendar_id, eventId: targetEventId });
        if (!targetIsSeries) await service.from('calendar_events').update(toCalendarEventRow({ userId: user.id, calendarId: row.calendar_id, ev: latest, timezone })).eq('id', row.id).eq('user_id', user.id);
      } catch { /* Keep the existing baseline if the refresh fails. */ }
      return NextResponse.json({ error: 'Google changed this event. Reload and review before retrying.', conflict: true }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (targetIsSeries) {
    // Drop every cached row that points to the same master.
    await service
      .from("calendar_events")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "google")
      .or(
        `external_id.eq.${targetEventId},raw->>recurringEventId.eq.${targetEventId}`
      );
    // And invalidate sync_token for a fresh re-pull.
    await service
      .from("user_calendar_connections")
      .update({ sync_token: null })
      .eq("user_id", user.id)
      .eq("provider", "google");
  } else {
    await service.from("calendar_events").delete().eq("id", row.id);
  }

  return NextResponse.json({ ok: true, scope, targetEventId, targetIsSeries });
}

/* ------------------------------------------------------------------ */
/* GET /api/calendar/google/event/[id] — acknowledged local revision */
/* ------------------------------------------------------------------ */

/** Return one consistent cached revision for review and conditional editing. */
export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  const { user, error: authErr } = await getAuthedUser();
  if (authErr) return authErr;

  const supabase = createClient();
  const { data: rowRaw, error: lookupErr } = await supabase
    .from("calendar_events")
    .select(
      "id, user_id, provider, external_id, calendar_id, title, description, location, start_at, end_at, is_all_day, raw, html_link"
    )
    .eq("id", ctx.params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  if (!rowRaw) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ event: rowRaw });
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------- */

async function getAuthedUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    } as const;
  }
  return { user, error: null } as const;
}

async function getServiceAndToken(userId: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supaUrl) {
    return {
      service: null as never,
      accessToken: null as never,
      error: NextResponse.json(
        { error: "supabase_misconfigured" },
        { status: 500 }
      ),
    } as const;
  }
  const service = createServiceClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let accessToken: string | null;
  try {
    accessToken = await getValidAccessToken({ supabase: service, userId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "token_refresh_failed";
    return {
      service,
      accessToken: null as never,
      error: NextResponse.json({ error: msg }, { status: 502 }),
    } as const;
  }
  if (!accessToken) {
    return {
      service,
      accessToken: null as never,
      error: NextResponse.json({ error: "no_access_token" }, { status: 401 }),
    } as const;
  }
  return { service, accessToken, error: null } as const;
}
