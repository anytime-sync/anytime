import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { syncUserCalendar, type SyncResult } from "@/lib/calendar-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron: every 5 minutes (vercel.json). Iterates every connected user
 * and runs an incremental sync. Vercel Cron sends GET with
 * `Authorization: Bearer ${CRON_SECRET}`; POST works too for manual
 * curl testing.
 *
 * Per-user errors don't fail the whole run — we collect a per-user
 * status array and return it so the response is debuggable when one
 * user's refresh token has been revoked while everyone else syncs
 * fine.
 */
export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
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

  const { data: conns, error } = await supabase
    .from("user_calendar_connections")
    .select("user_id")
    .eq("provider", "google");
  if (error) {
    console.error("[cron calendar-sync] fetch", error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  const rows = (conns ?? []) as Array<{ user_id: string }>;

  const syncs: SyncResult[] = [];
  for (const r of rows) {
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
  }

  return NextResponse.json({ ok: true, syncs });
}
