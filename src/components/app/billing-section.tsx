"use client";

import { Sparkles, ExternalLink, Check } from "lucide-react";
import {
  useUserPlan,
  useStartCheckout,
  useOpenBillingPortal,
} from "@/hooks/use-billing";
import { useProPrice, usePlusPrice } from "@/hooks/use-pricing";
import { format } from "date-fns";

/**
 * Settings → Billing section.
 *
 * Shows the user's current plan and gives them an action:
 *   - Free → "Upgrade to Plus" or "Upgrade to Pro" (kicks off LS Checkout).
 *   - Plus → "Upgrade to Pro" + "Manage billing".
 *   - Pro/VIP/Team → "Manage billing" (opens LS Customer Portal).
 *
 * The source of truth is the user_plans view, written by the webhook.
 */
export function BillingSection() {
  const planQ = useUserPlan();
  const checkoutPlus = useStartCheckout("plus");
  const checkoutPro = useStartCheckout("pro");
  const portal = useOpenBillingPortal();
  const { data: proPrice, isLoading: proLoading } = useProPrice();
  const { data: plusPrice, isLoading: plusLoading } = usePlusPrice();

  if (planQ.isLoading) {
    return (
      <section className="border border-border rounded-md p-4">
        <p className="text-sm text-muted-fg">Loading billing…</p>
      </section>
    );
  }
  const data = planQ.data!;
  const isPlus = data.plan === "plus";
  const isPro = data.plan === "pro" || data.plan === "vip" || data.plan === "team";

  return (
    <section className="border border-border rounded-md p-4">
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <h3 className="font-display text-xl">Billing</h3>
        <span className="text-xs text-muted-fg uppercase tracking-wider">
          {isPro ? "Pro" : isPlus ? "Plus" : "Free"}
        </span>
      </div>

      {isPro ? (
        <>
          <p className="text-sm text-fg leading-relaxed mb-1">
            You&apos;re on First Light Pro. All AI surfaces, unlimited Daily
            Editions, and bi-directional Google Calendar sync are enabled.
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
      ) : isPlus ? (
        <>
          <p className="text-sm text-fg leading-relaxed mb-1">
            You&apos;re on First Light Plus. Unlimited Daily Editions and two-way
            Google Calendar sync are enabled.
          </p>
          {data.currentPeriodEnd && (
            <p className="text-xs text-muted-fg mt-2">
              {data.cancelAtPeriodEnd
                ? `Cancels on ${format(new Date(data.currentPeriodEnd), "MMM d, yyyy")}.`
                : `Renews on ${format(new Date(data.currentPeriodEnd), "MMM d, yyyy")}.`}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => checkoutPro.mutate()}
              disabled={checkoutPro.isPending}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-fg text-bg hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="size-3.5" />
              {checkoutPro.isPending
                ? "Starting…"
                : proLoading
                ? "Upgrade to Pro"
                : `Upgrade to Pro — ${proPrice?.formatted ?? "$9 / month"}`}
            </button>
            <button
              onClick={() => portal.mutate()}
              disabled={portal.isPending}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-50"
            >
              <ExternalLink className="size-3.5" />
              {portal.isPending ? "Opening…" : "Manage billing"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-fg leading-relaxed mb-3">
            You&apos;re on Free. Upgrade for unlimited AI briefings, calendar sync,
            and the full co-pilot suite.
          </p>
          <ul className="text-sm text-muted-fg space-y-1 mb-4 leading-relaxed">
            <li className="inline-flex items-center gap-2">
              <Check className="size-3.5 text-fg" />
              Plus: unlimited Daily Editions + two-way Calendar sync
            </li>
            <li className="inline-flex items-center gap-2">
              <Check className="size-3.5 text-fg" />
              Pro: everything in Plus + AI co-pilot, voice/snapshot, weekly review
            </li>
          </ul>
          <div className="flex items-center gap-2">
            <button
              onClick={() => checkoutPlus.mutate()}
              disabled={checkoutPlus.isPending}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-50"
            >
              {checkoutPlus.isPending
                ? "Starting…"
                : plusLoading
                ? "Upgrade to Plus"
                : `Upgrade to Plus — ${plusPrice?.formattedPerMonth ?? "$3 / month"}`}
            </button>
            <button
              onClick={() => checkoutPro.mutate()}
              disabled={checkoutPro.isPending}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-fg text-bg hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="size-3.5" />
              {checkoutPro.isPending
                ? "Starting…"
                : proLoading
                ? "Upgrade to Pro"
                : `Upgrade to Pro — ${proPrice?.formatted ?? "$9 / month"}`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
