import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * GET /api/billing/prices
 *
 * Returns pricing info for display on /pricing and in-app upgrade prompts.
 * With Lemon Squeezy, prices are configured in the LS dashboard and we
 * just return the known values from env vars.
 */
export async function GET() {
  const proPriceAmount = process.env.LEMONSQUEEZY_PRO_PRICE_CENTS
    ? parseInt(process.env.LEMONSQUEEZY_PRO_PRICE_CENTS, 10)
    : 900; // default $9
  const currency = process.env.LEMONSQUEEZY_CURRENCY ?? "usd";

  const major = proPriceAmount / 100;
  const isWhole = Number.isInteger(major);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(major);

  return NextResponse.json({
    pro: {
      priceId: process.env.LEMONSQUEEZY_VARIANT_ID_PRO ?? null,
      amount: proPriceAmount,
      currency,
      interval: "month",
      formatted,
      formattedPerMonth: `${formatted} / month`,
      source: "lemonsqueezy",
    },
  });
}
