import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ics/[token]/calendar.ics
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
    .select("user_id")
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
  const { data: tasks, error: taskErr } = await admin
    .from("tasks")
    .select("id, title, notes, start_at, due_at, is_all_day, is_completed, rrule, updated_at, created_at, estimated_minutes")
    .eq("user_id", pref.user_id)
    .is("parent_id", null)
    .or(
      `and(start_at.gte.${minIso},start_at.lte.${maxIso}),and(due_at.gte.${minIso},due_at.lte.${maxIso})`
    )
    .limit(2000);
  if (taskErr) {
    return NextResponse.json({ error: taskErr.message }, { status: 500 });
  }

  const ics = buildIcs(tasks ?? []);

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

// ---------------------------------------------------------------------
// iCalendar serializer
//
// We deliberately keep this dependency-free — the format is small and
// well-specified, and pulling in `ical-generator` would add ~30KB to
// the lambda for no real win.
// ---------------------------------------------------------------------

type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  start_at: string | null;
  due_at: string | null;
  is_all_day: boolean;
  is_completed: boolean;
  rrule: string | null;
  updated_at: string;
  created_at: string;
  estimated_minutes: number | null;
};

function buildIcs(tasks: TaskRow[]): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//First Light//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push("X-WR-CALNAME:First Light");
  lines.push("X-WR-CALDESC:Tasks and meetings from First Light");
  // Pacific/Auckland is just a placeholder; events use UTC zulu times
  // so the calendar app translates to local time on display.
  lines.push("X-PUBLISHED-TTL:PT15M");

  const stamp = formatUtc(new Date());

  for (const task of tasks) {
    const anchor = task.start_at ?? task.due_at;
    if (!anchor) continue;
    const start = new Date(anchor);
    if (isNaN(start.getTime())) continue;

    // End time: prefer explicit due_at when it's after start_at; else
    // derive from estimated_minutes; else 30 min default. For all-day
    // events we use date-only DTSTART/DTEND with DTEND = next day.
    let end: Date;
    if (
      task.start_at &&
      task.due_at &&
      new Date(task.due_at) > new Date(task.start_at)
    ) {
      end = new Date(task.due_at);
    } else {
      const minutes = task.estimated_minutes && task.estimated_minutes > 0
        ? task.estimated_minutes
        : 30;
      end = new Date(start.getTime() + minutes * 60 * 1000);
    }

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${task.id}@firstlight.to`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`CREATED:${formatUtc(new Date(task.created_at))}`);
    lines.push(`LAST-MODIFIED:${formatUtc(new Date(task.updated_at))}`);

    if (task.is_all_day) {
      // RFC 5545 §3.6.1: VALUE=DATE for all-day, DTEND is exclusive
      // (next day).
      const startDate = formatDate(start);
      const endDate = formatDate(addDays(end, end > start ? 0 : 1));
      lines.push(`DTSTART;VALUE=DATE:${startDate}`);
      lines.push(`DTEND;VALUE=DATE:${endDate}`);
    } else {
      lines.push(`DTSTART:${formatUtc(start)}`);
      lines.push(`DTEND:${formatUtc(end)}`);
    }

    lines.push(`SUMMARY:${escapeText(task.title || "(untitled)")}`);
    if (task.notes && task.notes.trim()) {
      lines.push(`DESCRIPTION:${escapeText(task.notes)}`);
    }
    if (task.rrule) {
      // Pass the rrule through verbatim — date-fns / RRule library
      // already emits RFC-compliant strings.
      const trimmed = task.rrule.trim().replace(/^RRULE:/i, "");
      lines.push(`RRULE:${trimmed}`);
    }
    lines.push(`STATUS:${task.is_completed ? "CONFIRMED" : "CONFIRMED"}`);
    if (task.is_completed) {
      // Strikethrough hint for clients that respect it.
      lines.push("X-FL-COMPLETED:1");
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // RFC 5545 mandates CRLF line endings.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function escapeText(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

// RFC 5545 §3.1: lines longer than 75 octets must be folded with CRLF
// + space at column 76.
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + (i === 0 ? 75 : 74));
    parts.push((i === 0 ? "" : " ") + chunk);
    i += i === 0 ? 75 : 74;
  }
  return parts.join("\r\n");
}
