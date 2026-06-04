"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Reads pricing from /api/billing/prices (which reads from service_prices DB table).
 * Cache for 5 minutes client-side; the route also has revalidate=60.
 */
export type PlanPrice = {
  priceId: string | null;
  amount: number | null;
  currency: string;
  interval: string;
  formatted: string;
  formattedPerMonth: string;
  source: "db" | "env" | "lemonsqueezy" | "stripe" | "fallback" | "fallback-error";
};

export function useProPrice() {
  return useQuery<PlanPrice>({
    queryKey: ["pricing", "pro"],
    queryFn: async () => {
      const res = await fetch("/api/billing/prices", { cache: "default" });
      if (!res.ok) throw new Error("pricing_fetch_failed");
      const j = await res.json();
      return j.pro as PlanPrice;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlusPrice() {
  return useQuery<PlanPrice>({
    queryKey: ["pricing", "plus"],
    queryFn: async () => {
      const res = await fetch("/api/billing/prices", { cache: "default" });
      if (!res.ok) throw new Error("pricing_fetch_failed");
      const j = await res.json();
      return j.plus as PlanPrice;
    },
    staleTime: 5 * 60 * 1000,
  });
}
