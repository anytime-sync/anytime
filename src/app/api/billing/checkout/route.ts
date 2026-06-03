import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckout } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/billing/checkout
 *
 * Creates a Lemon Squeezy checkout session and returns the hosted URL.
 * The client redirects to this URL for payment.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;

  try {
    const checkoutUrl = await createCheckout({
      userId: user.id,
      userEmail: user.email ?? undefined,
      successUrl: `${origin}/app/settings?billing=success`,
      cancelUrl: `${origin}/app/settings?billing=cancel`,
    });
    return NextResponse.json({ url: checkoutUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "checkout_failed";
    console.error("[billing/checkout]", msg, e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
