import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withDefaults, type LandingConfig } from "@/lib/landing-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 60;

/**
 * GET /api/landing-config
 *
 * Public endpoint. Returns the merged landing config (defaults + DB overrides)
 * so /pricing and /app/features render with the latest copy without a deploy.
 */
export async function GET() {
  try {
    const sb = createClient();
    const { data } = await sb
      .from("landing_config")
      .select("config")
      .eq("id", 1)
      .maybeSingle();
    const merged = withDefaults((data?.config as LandingConfig | null) ?? null);
    return NextResponse.json({ config: merged });
  } catch (e) {
    // On error, return defaults so the pages still work.
    console.warn("[landing-config GET] falling back to defaults:", e);
    return NextResponse.json({ config: withDefaults(null) });
  }
}
