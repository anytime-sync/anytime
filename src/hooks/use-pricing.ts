"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Reads pricing from /api/billing/prices (which calls Stripe).
 * Cache for an hour client-side; the route also has revalidate=3600.
 */
export type ProPrice = {
  priceId: string | null;
  amount: number | null;
  currency: string;
  interval: string;
  formatted: string;
  formattedPerMonth: string;
  source: "stripe" | "fallback" | "fallback-error";
};

export function useProPrice() {
  return useQuery<ProPrice>({
    queryKey: ["pricing", "pro"],
    queryFn: async () => {
      const res = await fetch("/api/billing/prices", { cache: "default" });
      if (!res.ok) throw new Error("pricing_fetch_failed");
      const j = await res.json();
      return j.pro as ProPrice;
    },
    staleTime: 60 * 60 * 1000,
  });
}
