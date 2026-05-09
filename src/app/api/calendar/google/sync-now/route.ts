import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { syncUserCalendar } from "@/lib/calendar-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/calendar/google/sync-now
 *
 * On-demand sync triggered by the Settings page after a connect (and
 * by the user-facing "Sync now" button). Same logic as the cron, but
 * scoped to the requesting user only.
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

  const result = await syncUserCalendar({
    supabase: service,
    userId: user.id,
  });

  if (result.status === "error") {
    return NextResponse.json(
      { ok: false, error: result.error, count: result.count },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, count: result.count });
}
