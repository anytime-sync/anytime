import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { syncUserCalendar, type SyncResult } from "@/lib/calendar-sync";
import {
  drainCalendarDeletions,
  pushPendingTasksForUser,
} from "@/lib/calendar-write";
import { getValidAccessToken } from "@/lib/calendar-token";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron: every 5 min. Three passes:
 *
 *   1. Drain pending_calendar_deletions (Round F v2) — issue DELETE
 *      to Google for any task that was deleted since the last tick.
 *      One pass before per-user work because deletions are global.
 *   2. Per user, READ pass — pull events from Google → calendar_events.
 *   3. Per user, WRITE pass — find tasks needing push/patch + push them.
 *
 * Per-user errors don't fail the whole run.
 */
export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!isAuthorizedCron(auth)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supaUrl) {
    return NextResponse.json(
      { error: "supabase_misconfigured" },
      { status: 500 }
    );
  }

  const supabase = createSupabaseClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Pass 1: drain deletions queue (uses its own per-user token refresh).
  const drainOut = await drainCalendarDeletions({ supabase });

  // Pass 2 + 3: per-user read + write.
  const { data: conns, error } = await supabase
    .from("user_calendar_connections")
    .select("user_id, primary_calendar_id")
    .eq("provider", "google");
  if (error) {
    console.error("[cron calendar-sync] fetch", error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  const rows = (conns ?? []) as Array<{
    user_id: string;
    primary_calendar_id: string | null;
  }>;

  const syncs: SyncResult[] = [];
  const pushes: Array<{
    user_id: string;
    created: number;
    patched: number;
    failed: number;
  }> = [];

  for (const r of rows) {
    // Read pass.
    try {
      const out = await syncUserCalendar({ supabase, userId: r.user_id });
      syncs.push(out);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "sync_failed";
      syncs.push({
        user_id: r.user_id,
        status: "error",
        count: 0,
        error: msg,
      });
    }

    // Write pass — only if we have a primary calendar id and an access token.
    if (!r.primary_calendar_id) continue;
    let accessToken: string | null = null;
    try {
      accessToken = await getValidAccessToken({
        supabase,
        userId: r.user_id,
      });
    } catch {
      continue;
    }
    if (!accessToken) continue;

    try {
      const pushOut = await pushPendingTasksForUser({
        supabase,
        userId: r.user_id,
        primaryCalendarId: r.primary_calendar_id,
        accessToken,
      });
      pushes.push({ user_id: r.user_id, ...pushOut });
    } catch (e) {
      console.error("[cron calendar-sync] push pass failed", r.user_id, e);
      pushes.push({
        user_id: r.user_id,
        created: 0,
        patched: 0,
        failed: -1,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    drain: drainOut,
    syncs,
    pushes,
  });
}
