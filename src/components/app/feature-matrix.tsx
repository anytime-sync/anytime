"use client";

import { Check, Lock } from "lucide-react";
import {
  FEATURES,
  CATEGORY_LABELS,
  featuresByCategory,
  planSatisfies,
  type FeatureCategory,
  type Plan,
} from "@/lib/plans";

/**
 * Three-column Free vs Plus vs Pro feature matrix, shared by /pricing and
 * /app/features.
 *
 * For each feature row we look at its effective minPlan and ask
 * planSatisfies(column, minPlan) — that way the matrix stays correct even
 * if the admin reshuffles which features belong in which tier via the
 * /admin/feature-flags override panel.
 *
 * Free-tier soft-limits (e.g. "1 / day" for Daily Edition) are rendered
 * next to the Free column's check.
 *
 * Pass currentPlan to highlight the user's active column header.
 */
export function FeatureMatrix({
  currentPlan,
}: {
  currentPlan?: Plan;
}) {
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

  return (
    <div className="space-y-10">
      {cats.map((cat) => (
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
              {groups[cat].map((f) => (
                <li
                  key={f.id}
                  className="grid grid-cols-[1fr_72px_72px_72px] items-center px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{f.label}</p>
                    <p className="text-xs text-muted-fg mt-0.5">
                      {f.description}
                    </p>
                  </div>
                  {cols.map((c) => {
                    const included = planSatisfies(c.plan, f.minPlan);
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
      ))}
      <p className="text-xs text-muted-fg">
        {FEATURES.length} features in total.{" "}
        <span className="opacity-80">
          A lock icon means the feature isn't included in that tier; a number
          next to a check means there's a free-tier soft cap (e.g. one a day).
        </span>
      </p>
    </div>
  );
}
