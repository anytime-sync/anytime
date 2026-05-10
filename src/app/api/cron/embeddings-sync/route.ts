import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  snippetForComment,
  snippetForNote,
  snippetForTask,
  syncEmbedding,
} from "@/lib/embeddings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron: every 15 min. Sweep notes/tasks/task_comments updated since
 * the last tick and (re)embed any whose content_hash changed.
 *
 * "Last tick" = max(updated_at) on search_embeddings minus a 1h buffer
 * (so we never miss an update due to clock skew). Per-user we look 24h
 * back unconditionally on the first sync.
 *
 * This deliberately doesn't try to be perfect — fire-and-forget from
 * the write path catches the live case; this cron is the safety net
 * that re-converges if a write missed (deploy in flight, network blip).
 */
export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supaUrl) {
    return NextResponse.json({ error: "supabase_misconfigured" }, { status: 500 });
  }

  const supabase = createSupabaseClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Default: last 24h. Override with ?since=<ISO> to backfill old content
  // (e.g. ?since=2020-01-01 sweeps everything ever created).
  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam
    ? new Date(sinceParam).toISOString()
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  // Notes
  const { data: notes } = await supabase
    .from("notes")
    .select("id, user_id, title, body")
    .gte("updated_at", since)
    .limit(500);
  for (const n of notes ?? []) {
    try {
      const r = await syncEmbedding({
        supabase,
        userId: n.user_id,
        sourceType: "note",
        sourceId: n.id,
        content: snippetForNote(n),
      });
      r.skipped ? skipped++ : processed++;
    } catch (e) {
      console.error("[embeddings-sync] note", n.id, e);
      failed++;
    }
  }

  // Tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, user_id, title, notes")
    .gte("updated_at", since)
    .limit(500);
  for (const t of tasks ?? []) {
    try {
      const r = await syncEmbedding({
        supabase,
        userId: t.user_id,
        sourceType: "task",
        sourceId: t.id,
        content: snippetForTask(t),
      });
      r.skipped ? skipped++ : processed++;
    } catch (e) {
      console.error("[embeddings-sync] task", t.id, e);
      failed++;
    }
  }

  // Comments
  const { data: comments } = await supabase
    .from("task_comments")
    .select("id, user_id, body")
    .gte("created_at", since)
    .limit(500);
  for (const c of comments ?? []) {
    try {
      const r = await syncEmbedding({
        supabase,
        userId: c.user_id,
        sourceType: "comment",
        sourceId: c.id,
        content: snippetForComment(c),
      });
      r.skipped ? skipped++ : processed++;
    } catch (e) {
      console.error("[embeddings-sync] comment", c.id, e);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, processed, skipped, failed });
}
