import { buildIcs, type IcsTaskRow } from "@/lib/ical-feed";
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ics/[token].ics
 *
 * Public iCalendar (RFC 5545) feed for the user owning `token`. Apple
 * Calendar / Google Calendar / Outlook etc. subscribe to this URL and
 * poll it on their own schedule (typically 15 min – 24 hr).
 *
 * Auth: the token IS the auth. Anyone holding the URL can read the
 * user's task titles, dates, and notes. Users can rotate or disable
 * the token from /app/settings — when they do, the next subscriber
 * fetch returns 404 and the calendar app stops showing events.
 *
 * Why a service-role client: the public Supabase anon role can't
 * read user_preferences across users (RLS scopes it to auth.uid()).
 * The token is unguessable (32 bytes of CSPRNG → base64url), so a
 * direct lookup-by-token from the service role is safe.
 */
export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const token = params.token?.replace(/\.ics$/, "").trim();
  if (!token || token.length < 32) {
    return new NextResponse("not found", { status: 404 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supaUrl) {
    return NextResponse.json({ error: "supabase_misconfigured" }, { status: 500 });
  }
  const admin = createSupabaseClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Look up the user by token.
  const { data: pref, error: prefErr } = await admin
    .from("user_preferences")
    .select("user_id, timezone")
    .eq("ics_feed_token", token)
    .maybeSingle();
  if (prefErr || !pref) {
    return new NextResponse("not found", { status: 404 });
  }

  // Fetch tasks for this user that have a start_at or due_at. We pull
  // a wide window (-365d → +365d) so the calendar app sees a year of
  // history and a year of plan; recurring events are expanded by the
  // calendar app itself once we emit RRULE: lines.
  const now = new Date();
  const minIso = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const maxIso = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
  // Page deterministically: Supabase's default row cap must not silently
  // remove events from large calendars. Keep old active recurrence masters.
  const tasks: IcsTaskRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin
      .from("tasks")
      .select("id, title, notes, start_at, due_at, is_all_day, is_completed, status, rrule, updated_at, created_at, estimated_minutes")
      .eq("user_id", pref.user_id)
      .is("parent_id", null)
      .eq("is_completed", false)
      .neq("status", "done")
      .neq("status", "archived")
      .or(`and(start_at.gte.${minIso},start_at.lte.${maxIso}),and(due_at.gte.${minIso},due_at.lte.${maxIso}),rrule.not.is.null`)
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) return NextResponse.json({ error: "calendar_fetch_failed" }, { status: 500 });
    tasks.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const ics = buildIcs(tasks, pref.timezone || "UTC", now);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="firstlight.ics"',
      // Apple Calendar respects Cache-Control + ETag for conditional
      // refresh; we just hint at a 10-minute soft TTL.
      "Cache-Control": "private, max-age=600, must-revalidate",
    },
  });
}
