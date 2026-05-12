import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public-ish endpoint: returns which feature_ids the admin has flipped OFF
 * via /admin (i.e. disabled=true). Consumers:
 *   - Sidebar: hides nav links whose feature is disabled.
 *   - Page guards (Today / Tomorrow / etc): redirect to /app/features if the
 *     viewer hits a URL for a disabled feature.
 *
 * Why service-role + no auth?
 *   - The disabled set is the same for every user (it's a global kill switch).
 *   - Reading it doesn't leak anything sensitive — the user already discovers
 *     it the moment they try to use the feature.
 *   - We need to bypass RLS because the feature_flags table is admin-write +
 *     restricted-read; service-role lets us hand the disabled set to every
 *     signed-in client without granting them table access.
 *
 * Cached at the edge for 30s to absorb traffic; admin PUT bumps that cache by
 * touching the table (the front-end TanStack query also has a 30s stale time).
 */
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ disabled: [] as string[] });
    }
    const svc = createServiceClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await svc
      .from("feature_flags")
      .select("feature_id")
      .eq("disabled", true);
    if (error) throw error;
    const disabled = (data ?? []).map(
      (r: { feature_id: string }) => r.feature_id,
    );
    return NextResponse.json(
      { disabled },
      {
        headers: {
          // Browsers can hold this for 30s; CDN can hold it too. The admin
          // panel's onSuccess invalidates the TanStack query, so the panel
          // itself stays in sync; other tabs/users converge in <=30s.
          "Cache-Control":
            "public, max-age=30, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    // Fail open: if we can't read the flags, behave as if nothing is disabled.
    // Better to over-show a link than to break the whole sidebar.
    return NextResponse.json(
      { disabled: [] as string[], error: msg },
      { status: 200 },
    );
  }
}
