import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { parseLinks } from "@/lib/notes";
import { snippetForNote, syncEmbedding } from "@/lib/embeddings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/notes              → list current user's notes (newest first)
 *   ?archived=1 → include archived
 *   ?project=<uuid> → filter to a project
 *   ?task=<uuid> → filter to a task
 *
 * POST /api/notes              → create a note
 *   { title?, body, project_id?, task_id?, group_id? }
 *
 * Embedding: we fire-and-forget syncEmbedding after the write so the
 * note becomes searchable within a second of creation. Service-role
 * client used for the embedding write because the embedding lib runs
 * server-side and bypasses RLS for the upsert.
 */
export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("archived") === "1";
  const projectId = url.searchParams.get("project");
  const taskId = url.searchParams.get("task");

  let q = supabase
    .from("notes")
    .select(
      "id, title, body, project_id, task_id, group_id, links_to, pinned, archived, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);

  if (!includeArchived) q = q.eq("archived", false);
  if (projectId) q = q.eq("project_id", projectId);
  if (taskId) q = q.eq("task_id", taskId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    title?: string;
    body?: string;
    project_id?: string;
    task_id?: string;
    group_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const noteBody = body.body ?? "";
  const links = parseLinks(noteBody);

  const { data: created, error } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      title: body.title ?? null,
      body: noteBody,
      project_id: body.project_id ?? null,
      task_id: body.task_id ?? null,
      group_id: body.group_id ?? null,
      links_to: links,
    })
    .select()
    .single();
  if (error || !created) {
    return NextResponse.json(
      { error: error?.message ?? "insert_failed" },
      { status: 500 }
    );
  }

  // Fire-and-forget embedding refresh. Use service-role client so the
  // embedding lib's upsert isn't gated by RLS.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (serviceKey && supaUrl) {
    const service = createServiceClient(supaUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    void syncEmbedding({
      supabase: service,
      userId: user.id,
      sourceType: "note",
      sourceId: created.id,
      content: snippetForNote(created),
    }).catch((e) => console.error("[notes POST] embed", e));
  }

  return NextResponse.json({ note: created }, { status: 201 });
}
