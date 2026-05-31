/**
 * GET /api/v1/goals
 *   List active (and optionally archived) goals with progress.
 *   ?status=active|paused|done|archived  ?limit=…
 *
 * (Goals are mostly read-only via the API in v1; create/edit happens in-app
 * because progress weighting + linked tasks need careful UX.)
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../_lib/auth";

export async function GET(req: NextRequest) {
  const ctx = await requireApiAuth(req, "read");
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "active";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);

  const { data, error } = await ctx.supabase
    .from("goals")
    .select(
      "id,title,description,status,target_date,progress_pct,linked_task_count,updated_at,created_at",
    )
    .eq("user_id", ctx.userId)
    .eq("status", status)
    .order("target_date", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) return jsonError(500, "db_error", error.message);
  return jsonOk({ data });
}

