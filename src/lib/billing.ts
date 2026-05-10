import Stripe from "stripe";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * Round Z (billing): Stripe + plan-tier helpers.
 *
 * - getStripe(): cached Stripe SDK instance (server-side only).
 * - getUserPlan(userId): 'free' | 'pro'. Sources from public.user_plans
 *   so the same row Stripe webhook writes to drives gates immediately.
 * - isPro(userId): convenience boolean.
 *
 * Webhook signature verification uses Stripe's official helper
 * (stripe.webhooks.constructEvent) — we just expose the env var name
 * that holds the signing secret.
 */

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  _stripe = new Stripe(key, {
    apiVersion: "2024-12-18.acacia",
  });
  return _stripe;
}

export const STRIPE_WEBHOOK_SECRET_ENV = "STRIPE_WEBHOOK_SECRET";
export const STRIPE_PRICE_ID_PRO_ENV = "STRIPE_PRICE_ID_PRO_MONTHLY";

export type Plan = "free" | "pro" | "team";

/**
 * Resolve the user's effective plan from the Postgres view.
 * Uses service-role so this can be called from server routes that
 * gate AI features without going through user RLS.
 *
 * Returns 'free' when the user has no Stripe subscription row, or
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
  return plan === "pro" || plan === "team";
}

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
  plan: "pro" | "team";
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
} {
  return {
    user_id: userId,
    stripe_customer_id:
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    // Single Pro tier today. Future: read sub.items.data[0].price.lookup_key.
    plan: "pro",
    status: sub.status,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
  };
}
