"use client";

import { Check, Lock } from "lucide-react";
import {
  FEATURES,
  CATEGORY_LABELS,
  featuresByCategory,
  type FeatureCategory,
  type Plan,
} from "@/lib/plans";

/**
 * Two-column Free vs Pro feature matrix shared by /pricing and /app/features.
 *
 * Renders the FEATURES array grouped by category, with a checkmark for plans
 * that have access. Free-tier soft-limits (e.g. "1 / day") are rendered next
 * to the check on the Free column.
 *
 * Pass `currentPlan` to highlight the active plan column.
 */
export function FeatureMatrix({
  currentPlan,
}: {
  currentPlan?: Plan;
}) {
  const groups = featuresByCategory();
  const cats: FeatureCategory[] = ["tasks", "calendar", "ai", "review", "data", "platform"];

  return (
    <div className="space-y-10">
      {cats.map((cat) => (
        <section key={cat}>
          <h3 className="editorial-number text-[11px] mb-4">
            {CATEGORY_LABELS[cat]}
          </h3>
          <div className="border border-border rounded-xl overflow-hidden">
            <header
              className="grid grid-cols-[1fr_92px_92px] items-center bg-muted/30 px-4 py-3 text-xs uppercase tracking-wide text-muted-fg"
            >
              <span>Feature</span>
              <span
                className={`text-center ${
                  currentPlan === "free" ? "text-fg font-semibold" : ""
                }`}
              >
                Free
              </span>
              <span
                className={`text-center ${
                  currentPlan === "pro" ? "text-fg font-semibold" : ""
                }`}
              >
                Pro
              </span>
            </header>
            <ul className="divide-y divide-border">
              {groups[cat].map((f) => (
                <li
                  key={f.id}
                  className="grid grid-cols-[1fr_92px_92px] items-center px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{f.label}</p>
                    <p className="text-xs text-muted-fg mt-0.5">{f.description}</p>
                  </div>
                  <div className="flex justify-center">
                    {f.minPlan === "free" ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Check className="size-4 text-accent" aria-hidden />
                        {f.freeLimit ? (
                          <span className="text-muted-fg">{f.freeLimit}</span>
                        ) : null}
                      </span>
                    ) : (
                      <Lock className="size-3.5 text-muted-fg/60" aria-hidden />
                    )}
                  </div>
                  <div className="flex justify-center">
                    <Check className="size-4 text-accent" aria-hidden />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
      <p className="text-xs text-muted-fg">
        {FEATURES.length} features in total.{" "}
        <span className="opacity-80">
          A lock icon means the feature is Pro-only; a number next to a check
          means there's a free-tier limit.
        </span>
      </p>
    </div>
  );
}
