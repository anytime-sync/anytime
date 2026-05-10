import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getStripe, STRIPE_PRICE_ID_PRO_ENV } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Round Z (billing): POST /api/billing/checkout
 *
 * Creates a Stripe Checkout session for the user and returns the URL
 * the client should redirect to. The session is "subscription" mode
 * pinned to the single Pro monthly price (env: STRIPE_PRICE_ID_PRO_MONTHLY).
 *
 * If the user already has a Stripe customer row in our subscriptions
 * table, we reuse that customer id so they don't get a duplicate
 * customer record on a second purchase attempt.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const priceId = process.env[STRIPE_PRICE_ID_PRO_ENV];
  if (!priceId) {
    return NextResponse.json(
      { error: "billing_not_configured", missing: STRIPE_PRICE_ID_PRO_ENV },
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

  // Reuse existing Stripe customer if we have one; otherwise let
  // Checkout create one and the webhook will record it.
  const { data: existing } = await service
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const existingCustomerId = (existing as { stripe_customer_id?: string } | null)
    ?.stripe_customer_id;

  // Where to send the user after success / cancel.
  const url = new URL(req.url);
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;

  const stripe = getStripe();
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/app/settings?billing=success`,
      cancel_url: `${origin}/app/settings?billing=cancel`,
      // Stash user id on the customer so the webhook can map back even
      // if subscription metadata is missing (defense in depth).
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : {
            customer_email: user.email ?? undefined,
            customer_creation: "always",
          }),
      // Subscription-level metadata — webhook reads this on .created.
      subscription_data: {
        metadata: { user_id: user.id },
      },
      // Allow promo codes for early-access launches.
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
