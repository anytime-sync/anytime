"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Lock } from "lucide-react";
import {
  FEATURES,
  CATEGORY_LABELS,
  featuresByCategory,
  planSatisfies,
  type FeatureCategory,
  type Plan,
} from "@/lib/plans";

type FlagRow = {
  feature_id: string;
  override_plan: Plan | null;
  disabled: boolean;
  enabled_free: boolean | null;
  enabled_plus: boolean | null;
  enabled_pro: boolean | null;
  enabled_vip: boolean | null;
};

/**
 * Three-column Free vs Plus vs Pro feature matrix, shared by /pricing and
 * /app/features.
 *
 * Now fully synchronized with admin feature flags:
 *   1. Disabled features are hidden from the matrix.
 *   2. Per-plan explicit overrides (enabled_free/plus/pro/vip) are respected.
 *   3. override_plan shifts the minimum tier for a feature.
 *   4. Falls back to static plans.ts if the flags API is unavailable.
 *
 * Pass currentPlan to highlight the user's active column header.
 */
export function FeatureMatrix({
  currentPlan,
}: {
  currentPlan?: Plan;
}) {
  // Fetch admin flag overrides
  const flagsQ = useQuery<FlagRow[]>({
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

  const flagMap = new Map(
    (flagsQ.data ?? []).map((r) => [r.feature_id, r] as const)
  );

  const groups = featuresByCategory();
  const cats: FeatureCategory[] = [
    "tasks",
    "calendar",
    "ai",
    "review",
    "data",
    "platform",
  ];

  const cols: { plan: Plan; label: string }[] = [
    { plan: "free", label: "Free" },
    { plan: "plus", label: "Plus" },
    { plan: "pro", label: "Pro" },
  ];

  /**
   * Resolve whether a feature is included for a given plan column,
   * respecting admin overrides.
   */
  function isIncluded(featureId: string, columnPlan: Plan, staticMinPlan: Plan): boolean {
    const flag = flagMap.get(featureId);
    if (!flag) {
      // No override — use static minPlan from plans.ts
      return planSatisfies(columnPlan, staticMinPlan);
    }
    // Per-plan explicit override wins
    const explicit = pickPlanCol(flag, columnPlan);
    if (explicit !== null && explicit !== undefined) return explicit;
    // Fall back to override_plan or static minPlan
    const effectiveMinPlan = flag.override_plan ?? staticMinPlan;
    return planSatisfies(columnPlan, effectiveMinPlan);
  }

  /**
   * Check if admin disabled this feature globally.
   */
  function isDisabled(featureId: string): boolean {
    const flag = flagMap.get(featureId);
    return !!flag?.disabled;
  }

  return (
    <div className="space-y-10">
      {cats.map((cat) => {
        // Filter out admin-disabled features
        const visibleFeatures = groups[cat].filter((f) => !isDisabled(f.id));
        if (visibleFeatures.length === 0) return null;
        return (
          <section key={cat}>
            <h3 className="editorial-number text-[11px] mb-4">
              {CATEGORY_LABELS[cat]}
            </h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <header className="grid grid-cols-[1fr_72px_72px_72px] items-center bg-muted/30 px-4 py-3 text-xs uppercase tracking-wide text-muted-fg">
                <span>Feature</span>
                {cols.map((c) => (
                  <span
                    key={c.plan}
                    className={`text-center ${currentPlan === c.plan ? "text-fg font-semibold" : ""}`}
                  >
                    {c.label}
                  </span>
                ))}
              </header>
              <ul className="divide-y divide-border">
                {visibleFeatures.map((f) => (
                  <li
                    key={f.id}
                    className="grid grid-cols-[1fr_72px_72px_72px] items-center px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{f.label}{f.beta && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 uppercase tracking-wide">beta</span>}</p>
                      <p className="text-xs text-muted-fg mt-0.5">
                        {f.description}
                      </p>
                    </div>
                    {cols.map((c) => {
                      const included = isIncluded(f.id, c.plan, f.minPlan);
                      return (
                        <div key={c.plan} className="flex justify-center">
                          {included ? (
                            <span className="inline-flex items-center gap-1 text-xs">
                              <Check
                                className="size-4 text-accent"
                                aria-hidden
                              />
                              {c.plan === "free" && f.freeLimit ? (
                                <span className="text-muted-fg">
                                  {f.freeLimit}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <Lock
                              className="size-3.5 text-muted-fg/60"
                              aria-hidden
                            />
                          )}
                        </div>
                      );
                    })}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
      <p className="text-xs text-muted-fg">
        {FEATURES.filter((f) => !isDisabled(f.id)).length} features in total.{" "}
        <span className="opacity-80">
          A lock icon means the feature isn't included in that tier; a number
          next to a check means there's a free-tier soft cap (e.g. one a day).
        </span>
      </p>
    </div>
  );
}

function pickPlanCol(flag: FlagRow, plan: Plan): boolean | null {
  if (plan === "free") return flag.enabled_free;
  if (plan === "plus") return flag.enabled_plus;
  if (plan === "pro") return flag.enabled_pro;
  if (plan === "vip") return flag.enabled_vip;
  return flag.enabled_pro;
}
