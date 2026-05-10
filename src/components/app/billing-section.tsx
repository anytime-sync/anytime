"use client";

import { Sparkles, ExternalLink, Check } from "lucide-react";
import {
  useUserPlan,
  useStartCheckout,
  useOpenBillingPortal,
} from "@/hooks/use-billing";
import { format } from "date-fns";

/**
 * Round Z (billing): Settings → Billing section.
 *
 * Shows the user's current plan and gives them an action:
 *   - Free → "Upgrade to Pro" (kicks off Stripe Checkout).
 *   - Pro/Team → "Manage billing" (opens Stripe Customer Portal),
 *                plus a small note about renewal date / cancellation.
 *
 * The whole block is purely informational + two buttons; the source
 * of truth is the user_plans view, written by the Stripe webhook.
 */
export function BillingSection() {
  const planQ = useUserPlan();
  const checkout = useStartCheckout();
  const portal = useOpenBillingPortal();

  if (planQ.isLoading) {
    return (
      <section className="border border-border rounded-md p-4">
        <p className="text-sm text-muted-fg">Loading billing…</p>
      </section>
    );
  }
  const data = planQ.data!;
  const isPro = data.plan === "pro" || data.plan === "team";

  return (
    <section className="border border-border rounded-md p-4">
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <h3 className="font-display text-xl">Billing</h3>
        <span className="text-xs text-muted-fg uppercase tracking-wider">
          {isPro ? "Pro" : "Free"}
        </span>
      </div>

      {isPro ? (
        <>
          <p className="text-sm text-fg leading-relaxed mb-1">
            You're on First Light Pro. AI surfaces (Daily Edition, Plan-my-day,
            Plan-my-week, Reflection, Morning Co-pilot, Weekly Retro) are
            available without daily caps, and Google Calendar bi-directional
            sync is enabled.
          </p>
          {data.currentPeriodEnd && (
            <p className="text-xs text-muted-fg mt-2">
              {data.cancelAtPeriodEnd
                ? `Cancels on ${format(new Date(data.currentPeriodEnd), "MMM d, yyyy")}.`
                : `Renews on ${format(new Date(data.currentPeriodEnd), "MMM d, yyyy")}.`}
            </p>
          )}
          <button
            onClick={() => portal.mutate()}
            disabled={portal.isPending}
            className="mt-3 inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-50"
          >
            <ExternalLink className="size-3.5" />
            {portal.isPending ? "Opening…" : "Manage billing"}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-fg leading-relaxed mb-3">
            You're on Free. Upgrade to Pro to unlock unlimited AI briefings
            and Google Calendar bi-directional sync.
          </p>
          <ul className="text-sm text-muted-fg space-y-1 mb-4 leading-relaxed">
            <li className="inline-flex items-center gap-2">
              <Check className="size-3.5 text-fg" />
              Daily Edition, Morning Co-pilot, Reflection, Weekly Retro
            </li>
            <li className="inline-flex items-center gap-2">
              <Check className="size-3.5 text-fg" />
              Plan-my-day &amp; Plan-my-week (AI batch quadrant + priorities)
            </li>
            <li className="inline-flex items-center gap-2">
              <Check className="size-3.5 text-fg" />
              Google Calendar bi-directional sync (drag, edit, quick-add events)
            </li>
            <li className="inline-flex items-center gap-2">
              <Check className="size-3.5 text-fg" />
              Semantic search across tasks &amp; notes
            </li>
          </ul>
          <button
            onClick={() => checkout.mutate()}
            disabled={checkout.isPending}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-fg text-bg hover:opacity-90 disabled:opacity-50"
          >
            <Sparkles className="size-3.5" />
            {checkout.isPending ? "Starting…" : "Upgrade to Pro"}
          </button>
        </>
      )}
    </section>
  );
}
