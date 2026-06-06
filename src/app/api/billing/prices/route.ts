import { NextResponse } from "next/server";
import { loadPrices, formatPrice } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 60; // shorter cache since admin can change prices

/**
 * GET /api/billing/prices
 *
 * Returns pricing info for both Plus and Pro plans.
 * Reads from admin-editable service_prices table, falls back to env vars.
 */
export async function GET() {
  const { plusCents, proCents, currency, source } = await loadPrices();

  const plusFormatted = formatPrice(plusCents, currency);
  const proFormatted = formatPrice(proCents, currency);

  return NextResponse.json({
    plus: {
      priceId: process.env.LEMONSQUEEZY_VARIANT_ID_PLUS ?? null,
      amount: plusCents,
      currency,
      interval: "month",
      formatted: plusFormatted,
      formattedPerMonth: `${plusFormatted} / month`,
      source,
    },
    pro: {
      priceId: process.env.LEMONSQUEEZY_VARIANT_ID_PRO ?? null,
      amount: proCents,
      currency,
      interval: "month",
      formatted: proFormatted,
      formattedPerMonth: `${proFormatted} / month`,
      source,
    },
  });
}

