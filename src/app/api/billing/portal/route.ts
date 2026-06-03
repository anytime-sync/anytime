import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCustomerPortalUrl } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/billing/portal
 *
 * Returns the Lemon Squeezy customer portal URL so the user can
 * manage their subscription (update payment, cancel, etc.).
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    return NextResponse.json(
      { error: "supabase_misconfigured" },
      { status: 500 }
    );
  }
  const service = createServiceClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: row } = await service
    .from("subscriptions")
    .select("ls_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const customerId = (row as { ls_customer_id?: string } | null)
    ?.ls_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "no_customer" }, { status: 400 });
  }

  try {
    const portalUrl = await getCustomerPortalUrl(customerId);
    return NextResponse.json({ url: portalUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "portal_failed";
    console.error("[billing/portal]", msg, e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
