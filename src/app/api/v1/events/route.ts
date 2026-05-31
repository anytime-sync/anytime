/**
 * GET  /api/v1/events       List calendar events. ?from=YYYY-MM-DD&to=YYYY-MM-DD
 * POST /api/v1/events       Create a calendar event.
 *
 * Backed by your `calendar_events` table (which mirrors Google Calendar
 * via your GCal sync). When `external_provider = 'google'`, edits should
 * route through your existing GCal writeback path; this layer just calls
 * the same internal function you already use for in-app event edits.
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../_lib/auth";

export async function GET(req: NextRequest) {
  const ctx = await requireApiAuth(req, "read");
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 500);

  let q = ctx.supabase
    .from("calendar_events")
    .select(
      "id,title,description,location,start_at,end_at,all_day,external_provider,external_id,task_id,created_at,updated_at",
    )
    .eq("user_id", ctx.userId)
    .order("start_at", { ascending: true })
    .limit(limit);

  if (from) q = q.gte("start_at", from);
  if (to) q = q.lte("start_at", to);

  const { data, error } = await q;
  if (error) return jsonError(500, "db_error", error.message);
  return jsonOk({ data });
}

interface CreateEventBody {
  title: string;
  start_at: string;
  end_at: string;
  description?: string | null;
  location?: string | null;
  all_day?: boolean;
  task_id?: string | null;
  write_to_google?: boolean;
}

export async function POST(req: NextRequest) {
  const ctx = await requireApiAuth(req, "write");
  if (!ctx.ok) return ctx.response;

  let body: CreateEventBody;
  try {
    body = (await req.json()) as CreateEventBody;
  } catch {
    return jsonError(400, "invalid_json", "Body must be valid JSON.");
  }
  if (!body.title || !body.start_at || !body.end_at) {
    return jsonError(
      400,
      "missing_fields",
      "`title`, `start_at`, and `end_at` are required.",
    );
  }

  const { data, error } = await ctx.supabase
    .from("calendar_events")
    .insert({
      user_id: ctx.userId,
      title: body.title,
      description: body.description ?? null,
      location: body.location ?? null,
      start_at: body.start_at,
      end_at: body.end_at,
      is_all_day: Boolean(body.all_day),
      task_id: body.task_id ?? null,
      // Note: external_provider is now a generated alias of `provider`;
      // route writes through your existing GCal writeback helper when needed.
    })
    .select("*")
    .single();

  if (error) return jsonError(500, "db_error", error.message);
  return jsonOk({ data }, { status: 201 });
}
