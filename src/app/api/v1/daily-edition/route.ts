/**
 * GET /api/v1/daily-edition?date=YYYY-MM-DD
 *
 * Returns the editorial morning brief (the "First Light voice" summary),
 * if one was generated for the day. The MCP `get_daily_edition` tool
 * surfaces this so OpenClaw can quote First Light's own framing rather
 * than re-summarizing the raw data.
 *
 * If no edition exists for the requested date, returns 404. The client
 * is free to fall back to GET /api/v1/daily and summarize itself.
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../_lib/auth";

export async function GET(req: NextRequest) {
  const ctx = await requireApiAuth(req, "read");
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  // Adjust table/column names to match what your Daily Edition pipeline writes.
  const { data, error } = await ctx.supabase
    .from("daily_editions")
    .select("id,date,title,body,sections,generated_at")
    .eq("user_id", ctx.userId)
    .eq("date", date)
    .maybeSingle();

  if (error) return jsonError(500, "db_error", error.message);
  if (!data) return jsonError(404, "no_edition", `No Daily Edition for ${date}.`);
  return jsonOk({ data });
}

