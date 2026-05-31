/**
 * GET /api/v1/notes/search?q=...&limit=...&since=YYYY-MM-DD
 *
 * Hybrid search across notes:
 *   - Semantic via your Voyage embeddings (matches the in-app /notes search)
 *   - Falls back to ILIKE on title+body for empty / very-short queries
 *
 * Returns: { results: [{ id, title, snippet, score, updated_at, linked_task_ids }] }
 */

import { NextRequest } from "next/server";
import { requireApiAuth, jsonError, jsonOk } from "../../_lib/auth";

// If you have a typed helper for the Voyage call (e.g. embedOne), import it.
// Adjust this path to match your codebase.
import { embedOne } from "@/lib/voyage";

export async function GET(req: NextRequest) {
  const ctx = await requireApiAuth(req, "read");
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 100);
  const since = searchParams.get("since");

  if (!q) {
    return jsonError(400, "missing_query", "`q` is required.");
  }

  // ---- Semantic path (Voyage embeddings) ---------------------------------
  // If the query is short / ambiguous, fall through to ILIKE.
  let embedding: number[] | null = null;
  if (q.length >= 3) {
    try {
      embedding = await embedOne(q);
    } catch {
      embedding = null;
    }
  }

  let rows: Array<{
    id: string;
    title: string;
    body: string;
    updated_at: string;
    score?: number;
  }> = [];

  if (embedding) {
    // Assumes you exposed a SQL function `match_notes(query_embedding vector, match_count int, p_user uuid)`
    // returning (id, title, body, updated_at, score). If your function signature differs,
    // adjust this call. (You already wired Voyage embeddings end-to-end.)
    const { data, error } = await ctx.supabase.rpc("match_notes", {
      query_embedding: embedding,
      match_count: limit,
      p_user: ctx.userId,
    });
    if (error) return jsonError(500, "search_error", error.message);
    rows = (data ?? []) as typeof rows;
  } else {
    // ILIKE fallback
    let qb = ctx.supabase
      .from("notes")
      .select("id,title,body,updated_at")
      .eq("user_id", ctx.userId)
      .or(`title.ilike.%${q}%,body.ilike.%${q}%`)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (since) qb = qb.gte("updated_at", since);
    const { data, error } = await qb;
    if (error) return jsonError(500, "search_error", error.message);
    rows = (data ?? []) as typeof rows;
  }

  // Fetch linked task ids in one shot (small; bounded by `limit`)
  let linkedMap = new Map<string, string[]>();
  if (rows.length > 0) {
    const noteIds = rows.map((r) => r.id);
    const { data: links } = await ctx.supabase
      .from("note_task_links")
      .select("note_id,task_id")
      .in("note_id", noteIds);
    for (const link of links ?? []) {
      const arr = linkedMap.get(link.note_id) ?? [];
      arr.push(link.task_id);
      linkedMap.set(link.note_id, arr);
    }
  }

  const results = rows.map((r) => ({
    id: r.id,
    title: r.title,
    snippet: r.body ? r.body.slice(0, 220) : "",
    score: r.score ?? null,
    updated_at: r.updated_at,
    linked_task_ids: linkedMap.get(r.id) ?? [],
  }));

  return jsonOk({ q, count: results.length, results });
}

