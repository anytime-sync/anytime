/**
 * DELETE /api/v1/tasks/{id}/tags/{tagId}  — remove a tag from a task
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../../../../_lib/auth";

type Params = { params: { id: string; tagId: string } };

export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await requireApiAuth(req, "write");
  if (!ctx.ok) return ctx.response;

  // Verify task belongs to user
  const { data: task } = await ctx.supabase
    .from("tasks")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!task) return jsonError(404, "not_found", "Task not found.");

  const { error } = await ctx.supabase
    .from("task_tags")
    .delete()
    .eq("task_id", params.id)
    .eq("tag_id", params.tagId);

  if (error) return jsonError(500, "db_error", error.message);
  return jsonOk({ removed: true });
}

