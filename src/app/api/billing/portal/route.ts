import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Round Z (billing): POST /api/billing/portal
 *
 * Opens the Stripe Customer Portal for an existing subscriber so they
 * can update payment method, change plan, or cancel. Returns the URL
 * the client should redirect to.
 *
 * Requires the user to already have a stripe_customer_id (i.e. they
 * went through Checkout once). If not, returns 400 — the UI should
 * show "Upgrade" instead of "Manage" in that case.
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
