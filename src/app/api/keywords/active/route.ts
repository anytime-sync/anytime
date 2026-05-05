import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/keywords/active?locale=xx
 *
 * Returns the enabled priority phrases for a locale. Used by the
 * client-side quick-add parser to extend its built-in keyword list with
 * admin-curated phrases. Authenticated users only &mdash; the data is
 * harmless on its own (it&rsquo;s the admin&rsquo;s editorial choices) but
 * we don&rsquo;t expose it to anonymous traffic.
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
    .from("site_priority_keywords")
    .select("phrase, priority, quadrant")
    .eq("locale", locale)
    .eq("enabled", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(
    { phrases: data ?? [] },
    {
      // Soft-cache: clients can keep these for ~5min, the server keeps
      // an edge cache for 60s. Re-classify changes propagate quickly.
      headers: {
        "cache-control":
          "private, max-age=300, stale-while-revalidate=60",
      },
    }
  );
}
