/**
 * GET /api/v1/daily?date=YYYY-MM-DD&tz=America/Los_Angeles
 *
 * Returns the structured "today payload" — tasks, events, overdue count,
 * goals touched, focus blocks — in one shot. Designed so the MCP
 * `get_today` tool can answer "what's on my plate today" with a single
 * round-trip (and so OpenClaw can summarize it in its own voice).
 *
 * For the editorial First-Light-voice summary, use /api/v1/daily-edition.
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../_lib/auth";

export async function GET(req: NextRequest) {
  const ctx = await requireApiAuth(req, "read");
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  // Day boundaries (UTC; if you want tz-correct, pass the tz and use date-fns-tz)
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;

  // ---------- Tasks due today / overdue / scheduled today -----------------
  const tasksReq = ctx.supabase
    .from("tasks")
    .select("id,title,status,priority,due_at,start_at,project_id")
    .eq("user_id", ctx.userId)
    .in("status", ["open"])
    .or(`due_at.gte.${start},due_at.lte.${end},start_at.gte.${start},start_at.lte.${end}`)
    .order("priority", { ascending: false })
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  const overdueReq = ctx.supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .eq("status", "open")
    .lt("due_at", start);

  const eventsReq = ctx.supabase
    .from("calendar_events")
    .select("id,title,start_at,end_at,is_all_day,task_id,external_provider")
    .eq("user_id", ctx.userId)
    .gte("start_at", start)
    .lte("start_at", end)
    .order("start_at", { ascending: true });

  const completionsReq = ctx.supabase
    .from("tasks")
    .select("id,title,completed_at")
    .eq("user_id", ctx.userId)
    .eq("status", "done")
    .gte("completed_at", start)
    .lte("completed_at", end);

  const goalsReq = ctx.supabase
    .from("goals")
    .select("id,title,status,target_date")
    .eq("user_id", ctx.userId)
    .in("status", ["active"])
    .limit(20);

  const [tasks, overdue, events, completions, goals] = await Promise.all([
    tasksReq,
    overdueReq,
    eventsReq,
    completionsReq,
    goalsReq,
  ]);

  for (const r of [tasks, overdue, events, completions, goals]) {
    if (r.error) return jsonError(500, "db_error", r.error.message);
  }

  return jsonOk({
    date,
    tasks: tasks.data ?? [],
    events: events.data ?? [],
    overdue_count: overdue.count ?? 0,
    completed_today: completions.data ?? [],
    active_goals: goals.data ?? [],
  });
}

