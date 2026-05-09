import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/calendar/google/status
 *
 * Returns the lightweight "is the user connected?" payload that the
 * Settings page reads on mount + after every connect/disconnect.
 *
 * RLS-gated read — the user's own row only.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_calendar_connections")
    .select("account_email, last_sync_at")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({
      connected: false,
      account_email: null,
      last_sync_at: null,
    });
  }
  return NextResponse.json({
    connected: true,
    account_email: (data as { account_email: string | null }).account_email,
    last_sync_at: (data as { last_sync_at: string | null }).last_sync_at,
  });
}
