import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * First Light — billing helpers.
 *
 * Provider-agnostic plan resolution. The payment provider (Lemon Squeezy,
 * formerly Stripe) writes to public.subscriptions via its webhook; this
 * module reads from the public.user_plans view to gate features.
 *
 * - getUserPlan(userId): resolves the effective plan.
 * - isPro(userId): convenience — true for pro, vip, or team.
 * - isPlusOrAbove(userId): true for plus, pro, vip, or team.
 */

// Re-export the canonical Plan type from plans.ts — single source of truth.
export type { Plan } from "@/lib/plans";
import type { Plan } from "@/lib/plans";

/**
 * Resolve the user's effective plan from the Postgres view.
 * Uses service-role so this can be called from server routes that
 * gate AI features without going through user RLS.
 *
 * Returns 'free' when the user has no subscription row, or
 * when the row's status is canceled/unpaid/incomplete_expired.
 */
export async function getUserPlan(userId: string): Promise<Plan> {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) return "free"; // misconfigured → fail closed
  const sb = createServiceClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await sb
    .from("user_plans")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  const plan = (data as { plan?: Plan } | null)?.plan ?? "free";
  return plan;
}

export async function isPro(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  return plan === "pro" || plan === "vip" || plan === "team";
}

export async function isPlusOrAbove(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  return plan === "plus" || plan === "pro" || plan === "vip" || plan === "team";
}

// ─── Stripe (legacy, keep for reference until Lemon Squeezy is live) ────────

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  _stripe = new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
  });
  return _stripe;
}

export const STRIPE_WEBHOOK_SECRET_ENV = "STRIPE_WEBHOOK_SECRET";
export const STRIPE_PRICE_ID_PRO_ENV = "STRIPE_PRICE_ID_PRO_MONTHLY";

/**
 * Map a Stripe subscription object into our subscriptions table shape.
 * Used by the webhook on subscription.created / .updated.
 */
export function subscriptionToRow(
  userId: string,
  sub: Stripe.Subscription
): {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan: Plan;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
} {
  return {
    user_id: userId,
    stripe_customer_id:
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    // TODO: Map Stripe price ID → plan tier when Plus pricing is added
    plan: "pro",
    status: sub.status,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
  };
}
