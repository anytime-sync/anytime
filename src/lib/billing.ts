/**
 * First Light — Lemon Squeezy billing integration.
 *
 * Lemon Squeezy is merchant-of-record: handles payments, tax, invoices.
 * We just need to:
 *   1. Create checkout sessions (redirect user to LS hosted checkout)
 *   2. Handle webhooks (subscription lifecycle → upsert our DB)
 *   3. Create customer portal sessions (redirect to LS hosted portal)
 *   4. Look up the user's plan from our subscriptions table
 *
 * Environment variables:
 *   - LEMONSQUEEZY_API_KEY          — API key from LS dashboard
 *   - LEMONSQUEEZY_STORE_ID         — your store ID
 *   - LEMONSQUEEZY_WEBHOOK_SECRET   — webhook signing secret
 *   - LEMONSQUEEZY_VARIANT_ID_PRO   — variant ID for Pro monthly plan
 *   - LEMONSQUEEZY_VARIANT_ID_PLUS  — variant ID for Plus monthly plan (optional)
 */

import { createClient as createServiceClient } from "@supabase/supabase-js";
import crypto from "crypto";

// ─── Lemon Squeezy API helpers ──────────────────────────────────────────────

const LS_API_BASE = "https://api.lemonsqueezy.com/v1";

function lsHeaders(): HeadersInit {
  const key = process.env.LEMONSQUEEZY_API_KEY;
  if (!key) throw new Error("LEMONSQUEEZY_API_KEY not set");
  return {
    Authorization: `Bearer ${key}`,
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
  };
}

async function lsFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${LS_API_BASE}${path}`, {
    ...init,
    headers: { ...lsHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LS API ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

// ─── Checkout ───────────────────────────────────────────────────────────────

export interface CreateCheckoutOptions {
  userId: string;
  userEmail?: string;
  variantId?: string;
  successUrl: string;
  cancelUrl?: string;
}

/**
 * Create a Lemon Squeezy checkout session URL.
 * Uses the LS API to create a checkout and returns the hosted URL.
 */
export async function createCheckout(
  opts: CreateCheckoutOptions
): Promise<string> {
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  if (!storeId) throw new Error("LEMONSQUEEZY_STORE_ID not set");

  const variantId =
    opts.variantId ?? process.env.LEMONSQUEEZY_VARIANT_ID_PRO;
  if (!variantId) throw new Error("LEMONSQUEEZY_VARIANT_ID_PRO not set");

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: opts.userEmail ?? undefined,
          custom: {
            user_id: opts.userId,
          },
        },
        checkout_options: {
          embed: false,
          media: false,
          button_color: "#000000",
        },
        product_options: {
          redirect_url: opts.successUrl,
          enabled_variants: [parseInt(variantId, 10)],
        },
      },
      relationships: {
        store: {
          data: { type: "stores", id: storeId },
        },
        variant: {
          data: { type: "variants", id: variantId },
        },
      },
    },
  };

  const data = await lsFetch("/checkouts", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const url = data?.data?.attributes?.url;
  if (!url) throw new Error("No checkout URL returned from LS");
  return url;
}

// ─── Customer Portal ────────────────────────────────────────────────────────

/**
 * Get the customer portal URL for an existing LS customer.
 * LS provides a customer_portal_url on each subscription.
 */
export async function getCustomerPortalUrl(
  lsCustomerId: string
): Promise<string> {
  const data = await lsFetch(`/customers/${lsCustomerId}`);
  const urls = data?.data?.attributes?.urls;
  const portalUrl =
    urls?.customer_portal ??
    urls?.update_payment_method ??
    null;
  if (!portalUrl) {
    throw new Error("No customer portal URL available");
  }
  return portalUrl;
}

// ─── Webhook verification ───────────────────────────────────────────────────

/**
 * Verify the Lemon Squeezy webhook signature.
 * LS uses HMAC-SHA256 with the raw body and the webhook secret.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) throw new Error("LEMONSQUEEZY_WEBHOOK_SECRET not set");

  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(rawBody).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

// ─── Subscription → DB row mapping ─────────────────────────────────────────

export type Plan = "free" | "pro" | "team";

export interface SubscriptionRow {
  user_id: string;
  ls_customer_id: string;
  ls_subscription_id: string;
  plan: "pro" | "team";
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  variant_id: string | null;
}

/**
 * Map a Lemon Squeezy webhook subscription object into our subscriptions
 * table shape. The webhook payload shape is documented at:
 * https://docs.lemonsqueezy.com/api/subscriptions
 */
export function lsSubscriptionToRow(
  userId: string,
  sub: {
    id: string;
    attributes: {
      customer_id: number;
      status: string;
      variant_id: number;
      renews_at: string | null;
      ends_at: string | null;
      cancelled: boolean;
    };
  }
): SubscriptionRow {
  const attrs = sub.attributes;
  return {
    user_id: userId,
    ls_customer_id: String(attrs.customer_id),
    ls_subscription_id: String(sub.id),
    plan: "pro", // Single Pro tier today
    status: mapLsStatus(attrs.status),
    current_period_end: attrs.renews_at ?? attrs.ends_at ?? null,
    cancel_at_period_end: attrs.cancelled ?? false,
    variant_id: String(attrs.variant_id),
  };
}

/**
 * Map LS subscription statuses to our internal status values.
 * LS statuses: on_trial, active, paused, past_due, unpaid, cancelled, expired
 */
function mapLsStatus(lsStatus: string): string {
  const map: Record<string, string> = {
    on_trial: "trialing",
    active: "active",
    paused: "paused",
    past_due: "past_due",
    unpaid: "unpaid",
    cancelled: "canceled",
    expired: "incomplete_expired",
  };
  return map[lsStatus] ?? lsStatus;
}

// ─── Plan resolution ────────────────────────────────────────────────────────

/**
 * Resolve the user's effective plan from the Postgres view.
 * Uses service-role so this can be called from server routes that
 * gate AI features without going through user RLS.
 *
 * Returns 'free' when the user has no subscription row, or when
 * the row's status is canceled/unpaid/expired.
 */
export async function getUserPlan(userId: string): Promise<Plan> {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) return "free";
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

// ─── Env var names (for config checks) ──────────────────────────────────────

export const LS_API_KEY_ENV = "LEMONSQUEEZY_API_KEY";
export const LS_WEBHOOK_SECRET_ENV = "LEMONSQUEEZY_WEBHOOK_SECRET";
export const LS_STORE_ID_ENV = "LEMONSQUEEZY_STORE_ID";
export const LS_VARIANT_ID_PRO_ENV = "LEMONSQUEEZY_VARIANT_ID_PRO";
