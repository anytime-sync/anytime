import { completedTaskOccurrence, nextTaskRecurrence } from "@/lib/task-recurrence";
/**
 * POST /api/v1/tasks/{id}/complete
 *   Mark a task complete. Convenience over PATCH { status: "done" } so that
 *   MCP tools can map 1:1 to a single verb (`complete_task`).
 *
 *   For recurring tasks (rrule set): instead of permanently completing the
 *   task, advance due_at/start_at to the next occurrence and insert a
 *   historical "done" clone of the current occurrence so streaks/retros
 *   still count it. This mirrors the client-side useToggleTask logic.
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../../../_lib/auth";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireApiAuth(req, "write");
  if (!ctx.ok) return ctx.response;

  // Fetch current task first so we can inspect rrule.
  const { data: task, error: fetchError } = await ctx.supabase
    .from("tasks")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("id", params.id)
    .single();

  if (fetchError) return jsonError(500, "db_error", fetchError.message);
  if (!task) return jsonError(404, "not_found", "Task not found.");

  const now = new Date().toISOString();

  // --- Recurring task: advance to next occurrence ---
  if (task.rrule && task.due_at) {
    const { data: prefs, error: prefsError } = await ctx.supabase.from('user_preferences').select('timezone').eq('user_id', ctx.userId).maybeSingle();
    if (prefsError) return jsonError(500, 'db_error', prefsError.message);
    const recurrence = nextTaskRecurrence(task, prefs?.timezone ?? 'UTC');

    if (recurrence) {
      // 1. Insert a historical "done" clone for this occurrence (no rrule,
      //    so it won't recur — it's just the audit record).
      await ctx.supabase.from("tasks").insert(completedTaskOccurrence(task, ctx.userId, now));

      // 2. Slide the live task forward to next occurrence, preserving duration.
      const patch: Record<string, unknown> = {
        ...recurrence.patch,
        status: "open",
        is_completed: false,
        completed_at: null,
      };

      const { data: advanced, error: advanceError } = await ctx.supabase
        .from("tasks")
        .update(patch)
        .eq("user_id", ctx.userId)
        .eq("id", params.id)
        .select("*")
        .single();

      if (advanceError) return jsonError(500, "db_error", advanceError.message);
      return jsonOk({ data: advanced, recurring: true, next: recurrence.next.toISOString() });
    }
    // No next occurrence (UNTIL/COUNT exhausted) — fall through to permanent done.
  }

  // --- Non-recurring (or exhausted recurring): mark permanently done ---
  const { data, error } = await ctx.supabase
    .from("tasks")
    .update({ status: "done", is_completed: true, completed_at: now })
    .eq("user_id", ctx.userId)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return jsonError(500, "db_error", error.message);
  if (!data) return jsonError(404, "not_found", "Task not found.");
  return jsonOk({ data });
}
