"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Plan } from "@/lib/plans";

/**
 * Round Z (billing): client-side hooks.
 *
 * - useUserPlan(): returns the current plan ('free' | 'plus' | 'pro' | 'vip' | 'team').
 *   Reads from the RLS-gated user_plans view directly via supabase, so
 *   it stays in sync with whatever the Stripe webhook last wrote.
 *
 * - useStartCheckout(): mutation that POSTs /api/billing/checkout, then
 *   redirects window.location to the returned Stripe URL.
 *
 * - useOpenBillingPortal(): mutation that POSTs /api/billing/portal,
 *   then redirects to Stripe's hosted Customer Portal.
 */

export function useUserPlan() {
  return useQuery({
    queryKey: ["userPlan"],
    queryFn: async (): Promise<{
      plan: Plan;
      status: string | null;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
    }> => {
      const sb = createClient();
      const { data: u } = await sb.auth.getUser();
      if (!u.user) {
        return {
          plan: "free",
          status: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        };
      }
      const { data } = await sb
        .from("user_plans")
        .select("plan,status,current_period_end,cancel_at_period_end")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (!data) {
        return {
          plan: "free",
          status: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        };
      }
      return {
        plan: (data.plan ?? "free") as Plan,
        status: data.status ?? null,
        currentPeriodEnd: data.current_period_end ?? null,
        cancelAtPeriodEnd: !!data.cancel_at_period_end,
      };
    },
    staleTime: 60_000, // a minute is fine; webhook drives invalidation indirectly
  });
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `http_${res.status}`);
      }
      const j = (await res.json()) as { url?: string };
      if (!j.url) throw new Error("no_url");
      window.location.href = j.url;
    },
    onError: (e: Error) => {
      toast.error("Couldn't start checkout: " + e.message);
    },
  });
}

export function useOpenBillingPortal() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `http_${res.status}`);
      }
      const j = (await res.json()) as { url?: string };
      if (!j.url) throw new Error("no_url");
      window.location.href = j.url;
    },
    onError: (e: Error) => {
      toast.error("Couldn't open billing portal: " + e.message);
    },
  });
}
