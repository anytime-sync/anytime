import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getStripe, STRIPE_PRICE_ID_PRO_ENV } from "@/lib/billing";
import { createCheckout, getVariantId } from "@/lib/lemonsqueezy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/billing/checkout
 *
 * Creates a checkout session and returns the URL to redirect to.
 *
 * Supports two providers:
 *   1. Lemon Squeezy (preferred — works in Taiwan and handles tax/MoR)
 *   2. Stripe (legacy fallback)
 *
 * Provider selection:
 *   - If LEMONSQUEEZY_API_KEY is set → use Lemon Squeezy
 *   - Else if STRIPE_SECRET_KEY is set → use Stripe
 *   - Else → 500 billing_not_configured
 *
 * Body (optional):
 *   { "plan": "plus" | "pro" }  — defaults to "pro"
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Parse requested plan from body
  let requestedPlan: "plus" | "pro" = "pro";
  try {
    const body = await req.json().catch(() => ({}));
    if (body.plan === "plus" || body.plan === "pro") {
      requestedPlan = body.plan;
    }
  } catch {
    // No body or invalid JSON — default to pro
  }

  const url = new URL(req.url);
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;

  // ─── Lemon Squeezy path ─────────────────────────────────────────────────
  if (process.env.LEMONSQUEEZY_API_KEY) {
    try {
      const variantId = getVariantId(requestedPlan);
      const checkoutUrl = await createCheckout({
        variantId,
        userId: user.id,
        userEmail: user.email ?? "",
        successUrl: `${origin}/app/settings?billing=success`,
        cancelUrl: `${origin}/app/settings?billing=cancel`,
      });
      return NextResponse.json({ url: checkoutUrl });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ls_checkout_failed";
      console.error("[billing/checkout] Lemon Squeezy error:", msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // ─── Stripe fallback ────────────────────────────────────────────────────
  const priceId = process.env[STRIPE_PRICE_ID_PRO_ENV];
  if (!priceId || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "billing_not_configured" },
      { status: 500 }
    );
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

  const { data: existing } = await service
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const existingCustomerId = (existing as { stripe_customer_id?: string } | null)
    ?.stripe_customer_id;

  const stripe = getStripe();
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/app/settings?billing=success`,
      cancel_url: `${origin}/app/settings?billing=cancel`,
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : {
            customer_email: user.email ?? undefined,
            customer_creation: "always",
          }),
      subscription_data: {
        metadata: { user_id: user.id },
      },
      allow_promotion_codes: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "stripe_checkout_failed";
    console.error("[billing/checkout]", msg, e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  if (!session.url) {
    return NextResponse.json({ error: "no_session_url" }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}
