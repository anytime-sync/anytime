import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyMentions } from "@/lib/mentions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tasks/[id]/comments
 *
 * Returns the comments on a task, oldest-first, joined to the author's
 * profile so the UI can render avatar + name without a second round
 * trip. RLS handles visibility — same policy as the parent task.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("task_comments")
    .select(
      "id, task_id, author_id, body, created_at, updated_at, author:profiles!author_id ( id, full_name, email, avatar_url )"
    )
    .eq("task_id", params.id)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ rows: data ?? [] });
}

/**
 * POST /api/tasks/[id]/comments
 * Body: { body: string }
 *
 * Inserts a new comment as the current user. RLS gates inserts to
 * task readers. After a successful insert we run the @-mention parser
 * (best-effort) and may write app_notifications rows. The new comment
 * is returned with its author profile joined so the optimistic update
 * in the client doesn't need a second fetch.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { body?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const body =
    typeof payload.body === "string" ? payload.body.trim() : "";
  if (!body) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }
  if (body.length > 4000) {
    return NextResponse.json({ error: "body_too_long" }, { status: 400 });
  }

  const { data: inserted, error } = await supabase
    .from("task_comments")
    .insert({ task_id: params.id, author_id: user.id, body })
    .select(
      "id, task_id, author_id, body, created_at, updated_at, author:profiles!author_id ( id, full_name, email, avatar_url )"
    )
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Best-effort @mention notifications. We need the task's owner /
  // share group to verify recipient access. RLS lets the comment
  // author read the task, so this select is safe.
  try {
    const { data: task } = await supabase
      .from("tasks")
      .select("id, user_id, title, share_group_id, assignee_id")
      .eq("id", params.id)
      .maybeSingle();
    if (task) {
      await notifyMentions({
        supabase,
        comment: {
          id: inserted.id,
          task_id: inserted.task_id,
          author_id: inserted.author_id,
          body: inserted.body,
        },
        task,
      });
    }
  } catch {
    /* swallow — mentions are non-blocking */
  }

  return NextResponse.json({ row: inserted });
}
