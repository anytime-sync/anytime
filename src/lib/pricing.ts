import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * Server-side pricing loader.
 *
 * Reads from the service_prices DB table, falls back to env vars.
 * Used by:
 *   - /api/billing/prices (the canonical API route)
 *   - Server components that need prices at render time (JSON-LD, OG metadata)
 *   - Any server-side code that needs display prices
 *
 * DO NOT import this from client components — use useProPrice() / usePlusPrice()
 * hooks instead, which fetch from /api/billing/prices.
 */

export type ServerPrices = {
  plusCents: number;
  proCents: number;
  currency: string;
  source: "db" | "env";
};

export async function loadPrices(): Promise<ServerPrices> {
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
    plusCents: parseInt(process.env.LEMONSQUEEZY_PLUS_PRICE_CENTS ?? "500", 10),
    proCents: parseInt(process.env.LEMONSQUEEZY_PRO_PRICE_CENTS ?? "900", 10),
    currency: process.env.LEMONSQUEEZY_CURRENCY ?? "usd",
    source: "env",
  };
}

/**
 * Format cents to a human-readable price string.
 * e.g. 500 → "$5", 999 → "$9.99"
 */
export function formatPrice(cents: number, currency: string): string {
  const major = cents / 100;
  const isWhole = Number.isInteger(major);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(major);
}

/**
 * Format cents to a plain number string for JSON-LD.
 * e.g. 500 → "5.00", 999 → "9.99"
 */
export function formatPriceNumeric(cents: number): string {
  return (cents / 100).toFixed(2);
}

