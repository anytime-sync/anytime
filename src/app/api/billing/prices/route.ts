import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3600;

function formatPrice(cents: number, currency: string): string {
  const major = cents / 100;
  const isWhole = Number.isInteger(major);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(major);
}

/**
 * GET /api/billing/prices
 *
 * Returns pricing info for both Plus and Pro plans.
 */
export async function GET() {
  const currency = process.env.LEMONSQUEEZY_CURRENCY ?? "usd";

  const plusCents = parseInt(
    process.env.LEMONSQUEEZY_PLUS_PRICE_CENTS ?? "500",
    10
  );
  const proCents = parseInt(
    process.env.LEMONSQUEEZY_PRO_PRICE_CENTS ?? "900",
    10
  );

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
      source: "lemonsqueezy",
    },
    pro: {
      priceId: process.env.LEMONSQUEEZY_VARIANT_ID_PRO ?? null,
      amount: proCents,
      currency,
      interval: "month",
      formatted: proFormatted,
      formattedPerMonth: `${proFormatted} / month`,
      source: "lemonsqueezy",
    },
  });
}
