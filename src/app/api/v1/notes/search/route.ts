import { validDate } from "@/lib/day-window";
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
  const limit = Math.max(1, Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 100));
  const since = searchParams.get("since");

  if (!q) {
    return jsonError(400, "missing_query", "`q` is required.");
  }

  if (since && !validDate(since)) return jsonError(400, "invalid_since", "Use YYYY-MM-DD.");

  // ---- Semantic path (Voyage embeddings) ---------------------------------
  // If the query is short / ambiguous, fall through to ILIKE.
  let embedding: number[] | null = null;
  if (q.length >= 3) {
    try {
      embedding = await embedOne(q, { inputType: "query" });
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
    const { data: hits, error } = await ctx.supabase.rpc("semantic_search", {
      query_embedding: embedding, match_count: 100,
      match_user_id: ctx.userId, match_threshold: 0.3,
    });
    if (!error && hits) {
      const noteHits = (hits as Array<{ source_type: string; source_id: string; score: number }>).filter(h => h.source_type === "note");
      if (noteHits.length) {
        let query = ctx.supabase.from("notes").select("id,title,body,updated_at").eq("user_id", ctx.userId).in("id", noteHits.map(h => h.source_id));
        if (since) query = query.gte("updated_at", since);
        const result = await query;
        if (!result.error) {
          const scores = new Map(noteHits.map(h => [h.source_id, h.score]));
          rows = (result.data ?? []).map(r => ({ ...r, score: scores.get(r.id) ?? 0 })).sort((a,b) => b.score - a.score).slice(0,limit);
        }
      }
    }
  }
  if (!rows.length) {
    // Separate parameterized filters keep punctuation out of PostgREST's OR grammar.
    const pattern = '%' + q.replace(/[\\%_]/g, char => '\\' + char) + '%';
    const responses = await Promise.all(['title', 'body'].map(column => {
      let query = ctx.supabase.from("notes").select("id,title,body,updated_at").eq("user_id", ctx.userId).ilike(column, pattern).order("updated_at", { ascending: false }).limit(limit);
      if (since) query = query.gte("updated_at", since);
      return query;
    }));
    if (responses.some(r => r.error)) return jsonError(500, "search_error", "Unable to search notes.");
    rows = Array.from(new Map(responses.flatMap(r => r.data ?? []).map(r => [r.id, r])).values()).sort((a,b) => b.updated_at.localeCompare(a.updated_at)).slice(0,limit);
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

