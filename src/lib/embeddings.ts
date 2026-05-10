/**
 * embeddings.ts — keep search_embeddings in sync with notes/tasks/comments.
 *
 * Strategy: content-hash idempotency. We embed only when the hash changed
 * since last embedding. Cron-driven: every 15 min sweep all three source
 * tables and (re)embed anything stale.
 *
 * Used by:
 *   - /api/cron/embeddings-sync (periodic sweep)
 *   - /api/notes (fire-and-forget after write — instant indexing for
 *     the user who just authored)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { embedBatch } from "./voyage";

export type SourceType = "task" | "note" | "comment";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Build the snippet that will be embedded for a row. Concatenate the
 * meaningful text fields in priority order, capped to ~8k chars.
 */
export function snippetForTask(t: {
  title?: string | null;
  notes?: string | null;
}): string {
  return [t.title, t.notes].filter(Boolean).join("\n\n").slice(0, 8000);
}

export function snippetForNote(n: {
  title?: string | null;
  body?: string | null;
}): string {
  return [n.title, n.body].filter(Boolean).join("\n\n").slice(0, 8000);
}

export function snippetForComment(c: { body?: string | null }): string {
  return (c.body ?? "").slice(0, 8000);
}

/**
 * Embed (or re-embed) a single source row. Cheap idempotency: skip
 * if content_hash matches the existing embedding row.
 */
export async function syncEmbedding({
  supabase,
  userId,
  sourceType,
  sourceId,
  content,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  userId: string;
  sourceType: SourceType;
  sourceId: string;
  content: string;
}): Promise<{ skipped: boolean }> {
  const trimmed = content.trim();
  if (!trimmed) {
    // Empty content: drop any existing embedding for this row.
    await supabase
      .from("search_embeddings")
      .delete()
      .eq("user_id", userId)
      .eq("source_type", sourceType)
      .eq("source_id", sourceId);
    return { skipped: true };
  }

  const hash = sha256(trimmed);

  const { data: existing } = await supabase
    .from("search_embeddings")
    .select("id, content_hash")
    .eq("user_id", userId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (existing && existing.content_hash === hash) {
    return { skipped: true };
  }

  const [embedding] = await embedBatch([trimmed], { inputType: "document" });

  await supabase
    .from("search_embeddings")
    .upsert(
      {
        user_id: userId,
        source_type: sourceType,
        source_id: sourceId,
        content: trimmed.slice(0, 1000), // Preview snippet, not full content
        embedding,
        model: "voyage-3",
        content_hash: hash,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,source_type,source_id" }
    );

  return { skipped: false };
}
