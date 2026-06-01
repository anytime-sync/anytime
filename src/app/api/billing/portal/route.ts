import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/billing";
import { getCustomerPortalUrl } from "@/lib/lemonsqueezy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/billing/portal
 *
 * Opens the customer portal (Lemon Squeezy or Stripe) so the user can
 * manage their subscription. Returns the URL to redirect to.
 *
 * Provider selection:
 *   - If LEMONSQUEEZY_API_KEY is set → use Lemon Squeezy customer portal
 *   - Else → use Stripe Customer Portal
 */
export async function POST(req: Request) {
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
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const customerId = (row as { stripe_customer_id?: string } | null)
    ?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "no_customer" }, { status: 400 });
  }

  const url = new URL(req.url);
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;

  // ─── Lemon Squeezy path ─────────────────────────────────────────────────
  if (process.env.LEMONSQUEEZY_API_KEY) {
    try {
      const portalUrl = await getCustomerPortalUrl(customerId);
      return NextResponse.json({ url: portalUrl });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ls_portal_failed";
      console.error("[billing/portal] Lemon Squeezy error:", msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // ─── Stripe fallback ────────────────────────────────────────────────────
  const stripe = getStripe();
  let portal;
  try {
    portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app/settings`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "stripe_portal_failed";
    console.error("[billing/portal]", msg, e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  return NextResponse.json({ url: portal.url });
}
