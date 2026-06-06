/**
 * GET    /api/v1/tasks/{id}/tags          — list tags on a task
 * POST   /api/v1/tasks/{id}/tags          — add tag(s) to a task { tag_ids: string[] }
 * DELETE /api/v1/tasks/{id}/tags/{tagId}  — remove a tag from a task
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../../../_lib/auth";

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await requireApiAuth(req, "read");
  if (!ctx.ok) return ctx.response;

  // Verify task belongs to user
  const { data: task } = await ctx.supabase
    .from("tasks")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!task) return jsonError(404, "not_found", "Task not found.");

  const { data, error } = await ctx.supabase
    .from("task_tags")
    .select("tag_id, tags(id, name, color)")
    .eq("task_id", params.id);

  if (error) return jsonError(500, "db_error", error.message);

  const tags = (data ?? []).map((tt: any) => tt.tags).filter(Boolean);
  return jsonOk({ data: tags });
}

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireApiAuth(req, "write");
  if (!ctx.ok) return ctx.response;

  let body: { tag_ids?: string[] };
  try {
    body = (await req.json()) as { tag_ids?: string[] };
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON.");
  }

  if (!body.tag_ids || !Array.isArray(body.tag_ids) || body.tag_ids.length === 0) {
    return jsonError(400, "missing_tag_ids", "tag_ids array is required.");
  }

  // Verify task belongs to user
  const { data: task } = await ctx.supabase
    .from("tasks")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!task) return jsonError(404, "not_found", "Task not found.");

  // Upsert task_tags (ignore conflicts)
  const rows = body.tag_ids.map((tag_id) => ({ task_id: params.id, tag_id }));
  const { error } = await ctx.supabase
    .from("task_tags")
    .upsert(rows, { onConflict: "task_id,tag_id", ignoreDuplicates: true });

  if (error) return jsonError(500, "db_error", error.message);

  // Return updated tags list
  const { data: updated } = await ctx.supabase
    .from("task_tags")
    .select("tag_id, tags(id, name, color)")
    .eq("task_id", params.id);

  const tags = (updated ?? []).map((tt: any) => tt.tags).filter(Boolean);
  return jsonOk({ data: tags });
}

