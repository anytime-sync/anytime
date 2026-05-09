import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/calendar/google/disconnect
 *
 * Removes the user's Google Calendar connection AND all of their
 * cached events. We don't bother revoking the refresh token at
 * Google's end — the user can do that from their Google account
 * settings if they want to be thorough. Removing the row here means
 * the cron stops syncing for them and the UI flips back to "Connect".
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
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
  const service = createServiceClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Delete events first so a partial failure doesn't leave orphaned
  // rows pointing at a connection we removed.
  const { error: evErr } = await service
    .from("calendar_events")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "google");
  if (evErr) {
    return NextResponse.json({ error: evErr.message }, { status: 400 });
  }

  const { error: connErr } = await service
    .from("user_calendar_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "google");
  if (connErr) {
    return NextResponse.json({ error: connErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
