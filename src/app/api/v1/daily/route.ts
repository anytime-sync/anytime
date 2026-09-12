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

import { calendarDate, dayWindow, dailyTaskFilter } from "@/lib/day-window";
import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../_lib/auth";

export async function GET(req: NextRequest) {
  const ctx = await requireApiAuth(req, "read");
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(req.url);
  const tz = searchParams.get("tz") ?? "UTC";
  let date: string, start: string, nextStart: string;
  try {
    date = searchParams.get("date") ?? calendarDate(new Date(), tz);
    const window = dayWindow(date, tz);
    start = window.start.toISOString();
    nextStart = window.nextStart.toISOString();
  } catch {
    return jsonError(400, "invalid_date", "Use a valid YYYY-MM-DD date and IANA timezone.");
  }

  // ---------- Tasks due today / overdue / scheduled today -----------------
  const tasksReq = ctx.supabase
    .from("tasks")
    .select("id,title,status,priority,due_at,start_at,project_id")
    .eq("user_id", ctx.userId)
    .in("status", ["open"])
    .or(dailyTaskFilter(start, nextStart))
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
    .lt("start_at", nextStart)
    .or(`end_at.gt.${start},and(end_at.is.null,start_at.gte.${start})`)
    .order("start_at", { ascending: true });

  const completionsReq = ctx.supabase
    .from("tasks")
    .select("id,title,completed_at")
    .eq("user_id", ctx.userId)
    .eq("status", "done")
    .gte("completed_at", start)
    .lt("completed_at", nextStart);

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
    tz,
    tasks: tasks.data ?? [],
    events: events.data ?? [],
    overdue_count: overdue.count ?? 0,
    completed_today: completions.data ?? [],
    active_goals: goals.data ?? [],
  });
}

