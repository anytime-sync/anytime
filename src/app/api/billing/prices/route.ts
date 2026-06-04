import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 60; // shorter cache since admin can change prices

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
 * Reads pricing from service_prices DB table first, falls back to env vars.
 */
async function loadPrices(): Promise<{
  plusCents: number;
  proCents: number;
  currency: string;
  source: "db" | "env";
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    try {
      const sb = createServiceClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await sb
        .from("service_prices")
        .select("plus_cents,pro_cents,currency")
        .eq("id", "singleton")
        .single();
      if (!error && data) {
        return {
          plusCents: data.plus_cents,
          proCents: data.pro_cents,
          currency: data.currency,
          source: "db",
        };
      }
    } catch {
      // fall through to env vars
    }
  }
  return {
    plusCents: parseInt(process.env.LEMONSQUEEZY_PLUS_PRICE_CENTS ?? "300", 10),
    proCents: parseInt(process.env.LEMONSQUEEZY_PRO_PRICE_CENTS ?? "900", 10),
    currency: process.env.LEMONSQUEEZY_CURRENCY ?? "usd",
    source: "env",
  };
}

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
