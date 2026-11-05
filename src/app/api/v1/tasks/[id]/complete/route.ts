import { completeTaskOccurrence } from "@/lib/task-completion";
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
  if (task.rrule) {
    const body = await req.json().catch(() => ({}));
    const revision = body.expected_updated_at ?? req.headers.get('If-Unmodified-Since');
    if (typeof revision !== 'string' || !Number.isFinite(Date.parse(revision))) return jsonError(428, 'revision_required', 'Recurring completion requires expected_updated_at from the task you viewed. Retry with the same revision.');
    const { data: prefs, error: prefsError } = await ctx.supabase.from('user_preferences').select('timezone').eq('user_id', ctx.userId).maybeSingle();
    if (prefsError) return jsonError(500, 'db_error', prefsError.message);
    try {
      const result = await completeTaskOccurrence(ctx.supabase, task, prefs?.timezone || 'UTC', revision);
      return jsonOk(result);
    } catch (error) { return jsonError(409, 'completion_not_saved', (error as Error).message); }
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
