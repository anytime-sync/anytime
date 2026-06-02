/**
 * POST   /api/v1/tasks/{id}/notes     link a note to this task
 * GET    /api/v1/tasks/{id}/notes     list notes linked to this task
 * DELETE /api/v1/tasks/{id}/notes     unlink a note (body: { note_id })
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../../../_lib/auth";

type Params = { params: { id: string } };

/* ---------- GET: list linked notes ---------- */
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireApiAuth(_req, "read");
  if (!auth.ok) return auth.response;
  const { supabase, userId } = auth;
  const taskId = params.id;

  // Verify the task belongs to this user
  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();

  if (taskErr || !task) return jsonError(404, "not_found", "Task not found");

  const { data, error } = await supabase
    .from("note_task_links")
    .select("note_id, notes(id, title, content, created_at, updated_at)")
    .eq("task_id", taskId);

  if (error) return jsonError(500, "db_error", error.message);
  return jsonOk(data ?? []);
}

/* ---------- POST: link a note ---------- */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireApiAuth(req, "write");
  if (!auth.ok) return auth.response;
  const { supabase, userId } = auth;
  const taskId = params.id;

  const body = await req.json().catch(() => null);
  if (!body?.note_id) return jsonError(400, "missing_field", "note_id is required");

  // Verify the task belongs to this user
  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();

  if (taskErr || !task) return jsonError(404, "not_found", "Task not found");

  // Verify the note belongs to this user
  const { data: note, error: noteErr } = await supabase
    .from("notes")
    .select("id")
    .eq("id", body.note_id)
    .eq("user_id", userId)
    .single();

  if (noteErr || !note) return jsonError(404, "not_found", "Note not found");

  const { data, error } = await supabase
    .from("note_task_links")
    .upsert({ task_id: taskId, note_id: body.note_id })
    .select()
    .single();

  if (error) return jsonError(500, "db_error", error.message);
  return jsonOk(data, { status: 201 });
}

/* ---------- DELETE: unlink a note ---------- */
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireApiAuth(req, "write");
  if (!auth.ok) return auth.response;
  const { supabase, userId } = auth;
  const taskId = params.id;

  const body = await req.json().catch(() => null);
  if (!body?.note_id) return jsonError(400, "missing_field", "note_id is required");

  // Verify the task belongs to this user
  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();

  if (taskErr || !task) return jsonError(404, "not_found", "Task not found");

  const { error } = await supabase
    .from("note_task_links")
    .delete()
    .eq("task_id", taskId)
    .eq("note_id", body.note_id);

  if (error) return jsonError(500, "db_error", error.message);
  return jsonOk({ deleted: true });
}
