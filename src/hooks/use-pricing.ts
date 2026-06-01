"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Reads pricing from /api/billing/prices.
 * Cache for an hour client-side; the route also has revalidate=3600.
 */
export type PlanPrice = {
  priceId: string | null;
  amount: number | null;
  currency: string;
  interval: string;
  formatted: string;
  formattedPerMonth: string;
  source: "stripe" | "lemonsqueezy" | "fallback" | "fallback-error";
};

/** @deprecated Use usePrices() instead for both Plus and Pro */
export function useProPrice() {
  const { data, ...rest } = usePrices();
  return { data: data?.pro, ...rest };
}

export function usePrices() {
  return useQuery<{ plus: PlanPrice; pro: PlanPrice }>({
    queryKey: ["pricing", "all"],
    queryFn: async () => {
      const res = await fetch("/api/billing/prices", { cache: "default" });
      if (!res.ok) throw new Error("pricing_fetch_failed");
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
  });
}
