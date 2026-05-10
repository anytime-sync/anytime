import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Cache for an hour at the edge — pricing changes rarely and the page calls
// this on every render. If you bump pricing in Stripe, redeploy or wait.
export const revalidate = 3600;

/**
 * GET /api/billing/prices
 *
 * Returns the canonical price for the Pro plan, looked up from Stripe by id.
 * Falls back to NEXT_PUBLIC_PRO_PRICE_FALLBACK env var if Stripe is not
 * configured (useful for /pricing rendering in preview deploys).
 */
export async function GET() {
  const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
  const fallback = process.env.NEXT_PUBLIC_PRO_PRICE_FALLBACK ?? "$9";

  if (!priceId || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({
      pro: {
        priceId: null,
        amount: null,
        currency: "usd",
        interval: "month",
        formatted: fallback,
        formattedPerMonth: `${fallback} / month`,
        source: "fallback",
      },
    });
  }

  try {
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceId);
    const amount = price.unit_amount ?? 0;
    const currency = (price.currency ?? "usd").toLowerCase();
    const interval = price.recurring?.interval ?? "month";

    const major = amount / 100;
    const isWhole = Number.isInteger(major);
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: isWhole ? 0 : 2,
    }).format(major);

    return NextResponse.json({
      pro: {
        priceId: price.id,
        amount,
        currency,
        interval,
        formatted,
        formattedPerMonth: `${formatted} / ${interval}`,
        source: "stripe",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[billing/prices]", msg);
    return NextResponse.json({
      pro: {
        priceId: null,
        amount: null,
        currency: "usd",
        interval: "month",
        formatted: fallback,
        formattedPerMonth: `${fallback} / month`,
        source: "fallback-error",
      },
    });
  }
}
