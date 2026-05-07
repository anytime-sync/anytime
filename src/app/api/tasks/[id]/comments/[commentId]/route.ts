import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/tasks/[id]/comments/[commentId]
 * Body: { body: string }
 *
 * Edit a comment body. RLS restricts updates to the original author,
 * so we don't enforce author_id here — the database does.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; commentId: string } }
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

  const { data, error } = await supabase
    .from("task_comments")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", params.commentId)
    .eq("task_id", params.id)
    .select(
      "id, task_id, author_id, body, created_at, updated_at, author:profiles!author_id ( id, full_name, email, avatar_url )"
    )
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ row: data });
}

/**
 * DELETE /api/tasks/[id]/comments/[commentId]
 *
 * Remove a comment. RLS restricts deletes to the original author.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; commentId: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("task_comments")
    .delete()
    .eq("id", params.commentId)
    .eq("task_id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
