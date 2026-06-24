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
import { rrulestr } from "rrule";

type Params = { params: { id: string } };

/** Compute the next occurrence date after `from` given an rrule string. */
function nextOccurrence(rrule: string, from: Date): Date | null {
  try {
    const dtstart = from
      .toISOString()
      .replace(/[-:]|\.(\d{3})/g, (_m, ms) => (ms ? "" : ""));
    const rule = rrulestr(`DTSTART:${dtstart}\nRRULE:${rrule}`);
    return rule.after(from, false) ?? null;
  } catch {
    return null;
  }
}

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
    const from = new Date(task.due_at);
    const next = nextOccurrence(task.rrule as string, from);

    if (next) {
      // 1. Insert a historical "done" clone for this occurrence (no rrule,
      //    so it won't recur — it's just the audit record).
      await ctx.supabase.from("tasks").insert({
        user_id: ctx.userId,
        project_id: task.project_id,
        title: task.title,
        notes: task.notes,
        priority: task.priority,
        due_at: task.due_at,
        start_at: task.start_at,
        is_all_day: task.is_all_day,
        status: "done",
        is_completed: true,
        completed_at: now,
        position: 0,
        // rrule intentionally omitted — clone is a one-off record
      });

      // 2. Slide the live task forward to next occurrence, preserving duration.
      const patch: Record<string, unknown> = {
        due_at: next.toISOString(),
        status: "open",
        is_completed: false,
        completed_at: null,
      };
      if (task.start_at && task.due_at) {
        const delta = next.getTime() - from.getTime();
        patch.start_at = new Date(
          new Date(task.start_at as string).getTime() + delta
        ).toISOString();
      }

      const { data: advanced, error: advanceError } = await ctx.supabase
        .from("tasks")
        .update(patch)
        .eq("user_id", ctx.userId)
        .eq("id", params.id)
        .select("*")
        .single();

      if (advanceError) return jsonError(500, "db_error", advanceError.message);
      return jsonOk({ data: advanced, recurring: true, next: next.toISOString() });
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

