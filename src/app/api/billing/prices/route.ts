import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * GET /api/billing/prices
 *
 * Returns pricing for Plus and Pro plans.
 * Sources from Lemon Squeezy (preferred) or Stripe (fallback).
 * Falls back to hardcoded values if neither is configured.
 */
export async function GET() {
  const isLs = !!process.env.LEMONSQUEEZY_API_KEY;
  const isStripe = !!process.env.STRIPE_SECRET_KEY;

  // ─── Hardcoded fallback (always available) ──────────────────────────────
  const fallback = {
    plus: {
      priceId: null,
      amount: 300,
      currency: "usd",
      interval: "month",
      formatted: "$3",
      formattedPerMonth: "$3 / month",
      source: "fallback" as const,
    },
    pro: {
      priceId: null,
      amount: 900,
      currency: "usd",
      interval: "month",
      formatted: "$9",
      formattedPerMonth: "$9 / month",
      source: "fallback" as const,
    },
  };

  // ─── Lemon Squeezy path ─────────────────────────────────────────────────
  if (isLs) {
    // LS doesn't have a simple "get price by variant" API like Stripe.
    // Prices are set in the LS dashboard. We return our known prices.
    // When LS is configured, we trust the env vars are correct.
    return NextResponse.json({
      plus: {
        ...fallback.plus,
        priceId: process.env.LEMONSQUEEZY_PLUS_VARIANT_ID ?? null,
        source: "lemonsqueezy",
      },
      pro: {
        ...fallback.pro,
        priceId: process.env.LEMONSQUEEZY_PRO_VARIANT_ID ?? null,
        source: "lemonsqueezy",
      },
    });
  }

  // ─── Stripe path ────────────────────────────────────────────────────────
  if (isStripe) {
    const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
    if (!priceId) {
      return NextResponse.json(fallback);
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
        plus: fallback.plus, // Stripe doesn't have Plus pricing yet
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
      console.error("[billing/prices]", e);
      return NextResponse.json(fallback);
    }
  }

  // ─── No provider configured ─────────────────────────────────────────────
  return NextResponse.json(fallback);
}
