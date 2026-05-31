/**
 * GET    /api/v1/tasks/{id}     read a single task
 * PATCH  /api/v1/tasks/{id}     update title/notes/due/priority/status
 * DELETE /api/v1/tasks/{id}     hard-delete (soft-archive: pass status=archived to PATCH)
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../../_lib/auth";

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await requireApiAuth(req, "read");
  if (!ctx.ok) return ctx.response;

  const { data, error } = await ctx.supabase
    .from("tasks")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return jsonError(500, "db_error", error.message);
  if (!data) return jsonError(404, "not_found", "Task not found.");
  return jsonOk({ data });
}

interface PatchBody {
  title?: string;
  due_at?: string | null;
  start_at?: string | null;
  priority?: "low" | "med" | "high" | null;
  notes?: string | null;
  status?: "open" | "done" | "archived";
  project_id?: string | null;
}

const ALLOWED: (keyof PatchBody)[] = [
  "title",
  "due_at",
  "start_at",
  "priority",
  "notes",
  "status",
  "project_id",
];

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requireApiAuth(req, "write");
  if (!ctx.ok) return ctx.response;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (k in body) patch[k] = (body as Record<string, unknown>)[k];
  }
  if (Object.keys(patch).length === 0) {
    return jsonError(400, "no_fields", "At least one updatable field is required.");
  }
  if (patch.status === "done") patch.completed_at = new Date().toISOString();
  if (patch.status === "open") patch.completed_at = null;

  const { data, error } = await ctx.supabase
    .from("tasks")
    .update(patch)
    .eq("user_id", ctx.userId)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return jsonError(500, "db_error", error.message);
  if (!data) return jsonError(404, "not_found", "Task not found.");
  return jsonOk({ data });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await requireApiAuth(req, "write");
  if (!ctx.ok) return ctx.response;

  const { error } = await ctx.supabase
    .from("tasks")
    .delete()
    .eq("user_id", ctx.userId)
    .eq("id", params.id);
  if (error) return jsonError(500, "db_error", error.message);
  return jsonOk({ deleted: true });
}

