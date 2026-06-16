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

/**
 * Tier cascade rule: if a lower tier is enabled, higher tiers inherit the enabled status.
 * FREE -> PLUS -> PRO -> VIP
 */
function pickPlanCol(flag: FlagRow, plan: Plan): boolean | null {
  const free = flag.enabled_free;
  const plus = flag.enabled_plus;
  const pro = flag.enabled_pro;
  const vip = flag.enabled_vip;

  // Apply cascade: if lower tier is ON, higher tiers inherit
  if (plan === "free") return free;
  if (plan === "plus") {
    // If FREE is ON, PLUS inherits (unless explicitly OFF)
    if (free === true) return plus !== false ? true : false;
    return plus;
  }
  if (plan === "pro") {
    // If FREE is ON, PRO inherits; if PLUS is ON (and FREE off), PRO inherits
    if (free === true) return pro !== false ? true : false;
    if (plus === true) return pro !== false ? true : false;
    return pro;
  }
  if (plan === "vip") {
    // Cascade from FREE -> PLUS -> PRO -> VIP
    if (free === true) return vip !== false ? true : false;
    if (plus === true) return vip !== false ? true : false;
    if (pro === true) return vip !== false ? true : false;
    return vip;
  }
  // team inherits pro
  if (free === true) return pro !== false ? true : false;
  if (plus === true) return pro !== false ? true : false;
  return pro;
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
