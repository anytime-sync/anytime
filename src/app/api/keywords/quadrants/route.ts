import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/keywords/quadrants?locale=xx
 *
 * Returns the four (label, fg, bg, border) quadrant rows the admin
 * configured for this locale. Used by the Sift display in quick-add
 * and the full matrix page so the user's custom colors flow
 * through to the consumer-side UI.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") ?? "en";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("site_quadrant_config")
    .select("quadrant, label, fg_color, bg_color, border_color, bg_opacity, bg_blur")
    .eq("locale", locale);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(
    { rows: data ?? [] },
    {
      headers: {
        "cache-control": "private, max-age=300, stale-while-revalidate=60",
      },
    }
  );
}
