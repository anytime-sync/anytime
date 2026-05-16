"use client";

import { useQuery } from "@tanstack/react-query";
import { useUserPlan } from "@/hooks/use-billing";
import { getFeature, planSatisfies, type Plan } from "@/lib/plans";

/**
 * Round Z3: client-side feature gate.
 *
 * Hides UI surfaces (buttons, cards, nav links) that the current user
 * cannot use. Resolves the same way as the server-side canUseFeature:
 *
 *   1. If admin disabled the feature globally → not accessible.
 *   2. If admin set a per-plan boolean (enabled_<plan>) → use it.
 *   3. Else fall back to feature.minPlan (with admin override_plan).
 *
 * The server still gates at the API layer (checkAiBudget + isPro). This
 * hook is for hiding UI — it is not a security boundary.
 */

type FlagRow = {
  feature_id: string;
  override_plan: Plan | null;
  disabled: boolean;
  enabled_free: boolean | null;
  enabled_plus: boolean | null;
  enabled_pro: boolean | null;
  enabled_vip: boolean | null;
};

function useFlagRows() {
  return useQuery<FlagRow[]>({
    queryKey: ["feature-flags", "effective"],
    queryFn: async () => {
      const r = await fetch("/api/feature-flags/effective");
      if (!r.ok) return [];
      const j = await r.json();
      return (j.rows ?? []) as FlagRow[];
    },
    staleTime: 30_000,
    gcTime: 300_000,
  });
}

function pickPlanCol(flag: FlagRow, plan: Plan): boolean | null {
  if (plan === "free") return flag.enabled_free;
  if (plan === "plus") return flag.enabled_plus;
  if (plan === "pro") return flag.enabled_pro;
  if (plan === "vip") return flag.enabled_vip;
  // team inherits pro
  return flag.enabled_pro;
}

/**
 * Returns whether the current user can see/use this feature. Loading is
 * treated optimistically as "can use" so we don't flash an empty layout.
 */
export function useCanUseFeature(featureId: string): boolean {
  const planQ = useUserPlan();
  const flagsQ = useFlagRows();
  if (planQ.isLoading || flagsQ.isLoading) return true;
  const plan = (planQ.data?.plan ?? "free") as Plan;
  const flags = flagsQ.data ?? [];
  const flag = flags.find((r) => r.feature_id === featureId);
  if (flag?.disabled) return false;
  if (flag) {
    const explicit = pickPlanCol(flag, plan);
    if (explicit !== null && explicit !== undefined) return explicit;
  }
  const base = getFeature(featureId);
  if (!base) return false;
  const minPlan = flag?.override_plan ?? base.minPlan;
  return planSatisfies(plan, minPlan);
}
