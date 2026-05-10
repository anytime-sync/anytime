import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/notes/[id]/convert-to-task
 *
 * Creates a task with this note's title and body, then links them by setting
 * note.task_id = new task id. The note is preserved (not deleted), so the
 * user can keep both the note's writing surface and a task to act on.
 *
 * Body: optional { listId?: string, dueAt?: string }
 *
 * Response: { taskId: string }
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const noteId = params.id;
  if (!noteId) {
    return NextResponse.json({ error: "missing_note_id" }, { status: 400 });
  }

  let body: { listId?: string; dueAt?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }

  // 1) Read the note (RLS guarantees ownership).
  const { data: note, error: readErr } = await supabase
    .from("notes")
    .select("id, title, body, project_id, task_id")
    .eq("id", noteId)
    .maybeSingle();
  if (readErr || !note) {
    return NextResponse.json(
      { error: "note_not_found" },
      { status: 404 }
    );
  }
  if (note.task_id) {
    // Already linked — return the existing link instead of creating a duplicate.
    return NextResponse.json({ taskId: note.task_id, alreadyLinked: true });
  }

  // 2) Create the task. Inherit list id either from the request body or from
  //    the note's project_id (if present).
  const taskRow: Record<string, unknown> = {
    user_id: user.id,
    title: note.title || "Untitled",
    notes: note.body ?? null,
  };
  if (body.listId) {
    taskRow.list_id = body.listId;
  } else if (note.project_id) {
    taskRow.list_id = note.project_id;
  }
  if (body.dueAt) {
    taskRow.due_at = body.dueAt;
  }

  const { data: created, error: insErr } = await supabase
    .from("tasks")
    .insert(taskRow)
    .select("id")
    .single();
  if (insErr || !created) {
    console.error("[notes/convert-to-task] insert failed", insErr);
    return NextResponse.json(
      { error: insErr?.message ?? "insert_failed" },
      { status: 502 }
    );
  }

  // 3) Link the note to the new task.
  const { error: linkErr } = await supabase
    .from("notes")
    .update({ task_id: created.id })
    .eq("id", noteId);
  if (linkErr) {
    // Non-fatal — the task exists, the link just didn't take. Warn and continue.
    console.warn("[notes/convert-to-task] link failed", linkErr);
  }

  return NextResponse.json({ taskId: created.id });
}
