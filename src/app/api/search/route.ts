import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embedOne } from "@/lib/voyage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=...&k=10&threshold=0.3
 *   → semantic search across the user's tasks + notes + comments
 *
 * Strategy:
 *   1. Embed the query with voyage-3 (input_type=query).
 *   2. Call semantic_search() RPC, scoped to the current user.
 *   3. Hydrate the source rows so the UI can render titles/links.
 *
 * Performance: HNSW index on search_embeddings makes step 2 sub-10ms
 * even with thousands of rows. Step 1 (Voyage call) is the bottleneck
 * at ~150ms.
 */
export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const k = Math.min(50, Math.max(1, Number(url.searchParams.get("k") ?? "10")));
  const threshold = Math.min(
    1,
    Math.max(0, Number(url.searchParams.get("threshold") ?? "0.3"))
  );
  if (!q) return NextResponse.json({ results: [] });

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedOne(q, { inputType: "query" });
  } catch (e) {
    console.error("[search] embed failed", e);
    return NextResponse.json({ error: "embed_failed" }, { status: 500 });
  }

  const { data: hits, error } = await supabase.rpc("semantic_search", {
    query_embedding: queryEmbedding,
    match_user_id: user.id,
    match_count: k,
    match_threshold: threshold,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Hydrate: bulk-fetch source rows by type+id so the UI can render
  // titles, links, etc.
  const taskIds = (hits ?? []).filter((h: { source_type: string }) => h.source_type === "task").map((h: { source_id: string }) => h.source_id);
  const noteIds = (hits ?? []).filter((h: { source_type: string }) => h.source_type === "note").map((h: { source_id: string }) => h.source_id);
  const commentIds = (hits ?? []).filter((h: { source_type: string }) => h.source_type === "comment").map((h: { source_id: string }) => h.source_id);

  const [tasksRes, notesRes, commentsRes] = await Promise.all([
    taskIds.length
      ? supabase.from("tasks").select("id, title, project_id").in("id", taskIds)
      : Promise.resolve({ data: [] }),
    noteIds.length
      ? supabase.from("notes").select("id, title, project_id, task_id").in("id", noteIds)
      : Promise.resolve({ data: [] }),
    commentIds.length
      ? supabase.from("task_comments").select("id, body, task_id").in("id", commentIds)
      : Promise.resolve({ data: [] }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taskMap = new Map<string, any>((tasksRes.data ?? []).map((t: { id: string }) => [t.id, t]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noteMap = new Map<string, any>((notesRes.data ?? []).map((n: { id: string }) => [n.id, n]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commentMap = new Map<string, any>((commentsRes.data ?? []).map((c: { id: string }) => [c.id, c]));

  const results = (hits ?? []).map((h: { source_type: string; source_id: string; content: string; score: number }) => ({
    type: h.source_type,
    id: h.source_id,
    snippet: h.content,
    score: h.score,
    source:
      h.source_type === "task"
        ? taskMap.get(h.source_id) ?? null
        : h.source_type === "note"
        ? noteMap.get(h.source_id) ?? null
        : commentMap.get(h.source_id) ?? null,
  }));

  return NextResponse.json({ results });
}
