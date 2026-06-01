/**
 * First Light — Lemon Squeezy billing integration.
 *
 * Replaces Stripe for markets where Stripe isn't available (e.g. Taiwan).
 * Lemon Squeezy handles payments, subscriptions, and tax as merchant of record.
 *
 * Required env vars:
 *   - LEMONSQUEEZY_API_KEY          — API key from LS dashboard
 *   - LEMONSQUEEZY_STORE_ID         — Your store ID
 *   - LEMONSQUEEZY_WEBHOOK_SECRET   — Webhook signing secret
 *   - LEMONSQUEEZY_PLUS_VARIANT_ID  — Variant ID for Plus ($3/mo)
 *   - LEMONSQUEEZY_PRO_VARIANT_ID   — Variant ID for Pro ($9/mo)
 *
 * How it works:
 *   1. User clicks "Upgrade" → we create a LS checkout via API
 *   2. LS handles the payment page (hosted checkout)
 *   3. LS sends webhook events → we upsert into public.subscriptions
 *   4. getUserPlan() reads from user_plans view (same as Stripe path)
 */

import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Plan } from "@/lib/plans";

// ─── Config ─────────────────────────────────────────────────────────────────

const LS_API_BASE = "https://api.lemonsqueezy.com/v1";

function getApiKey(): string {
  const key = process.env.LEMONSQUEEZY_API_KEY;
  if (!key) throw new Error("LEMONSQUEEZY_API_KEY not set");
  return key;
}

function getStoreId(): string {
  const id = process.env.LEMONSQUEEZY_STORE_ID;
  if (!id) throw new Error("LEMONSQUEEZY_STORE_ID not set");
  return id;
}

/** Map our plan tiers to Lemon Squeezy variant IDs. */
export function getVariantId(plan: "plus" | "pro"): string {
  const envKey =
    plan === "plus"
      ? "LEMONSQUEEZY_PLUS_VARIANT_ID"
      : "LEMONSQUEEZY_PRO_VARIANT_ID";
  const id = process.env[envKey];
  if (!id) throw new Error(`${envKey} not set`);
  return id;
}

// ─── API helpers ────────────────────────────────────────────────────────────

async function lsApi(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${LS_API_BASE}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${getApiKey()}`,
      ...(options.headers ?? {}),
    },
  });
}

// ─── Checkout ───────────────────────────────────────────────────────────────

export interface CreateCheckoutParams {
  variantId: string;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl?: string;
}

/**
 * Create a Lemon Squeezy checkout session.
 * Returns the checkout URL to redirect the user to.
 */
export async function createCheckout(
  params: CreateCheckoutParams
): Promise<string> {
  const res = await lsApi("/checkouts", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_options: {
            embed: false,
            media: false,
            button_color: "#000000",
          },
          checkout_data: {
            email: params.userEmail,
            custom: {
              user_id: params.userId,
            },
          },
          product_options: {
            redirect_url: params.successUrl,
            receipt_button_text: "Go to First Light",
            receipt_link_url: params.successUrl,
          },
        },
        relationships: {
          store: {
            data: { type: "stores", id: getStoreId() },
          },
          variant: {
            data: { type: "variants", id: params.variantId },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[lemonsqueezy/checkout]", res.status, err);
    throw new Error(`Lemon Squeezy checkout failed: ${res.status}`);
  }

  const json = await res.json();
  const checkoutUrl = json.data?.attributes?.url;
  if (!checkoutUrl) {
    throw new Error("No checkout URL returned from Lemon Squeezy");
  }
  return checkoutUrl;
}

// ─── Webhook verification ───────────────────────────────────────────────────

/**
 * Verify a Lemon Squeezy webhook signature.
 * Uses HMAC-SHA256 with the webhook secret.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string
): Promise<boolean> {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) throw new Error("LEMONSQUEEZY_WEBHOOK_SECRET not set");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === signature;
}

// ─── Webhook event → subscription row ───────────────────────────────────────

/**
 * Map a Lemon Squeezy variant ID to our plan tier.
 */
export function variantToPlan(variantId: string): Plan {
  const plusId = process.env.LEMONSQUEEZY_PLUS_VARIANT_ID;
  const proId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID;
  if (variantId === plusId) return "plus";
  if (variantId === proId) return "pro";
  // Default to pro for unknown variants (safe fallback)
  console.warn(`[lemonsqueezy] Unknown variant ${variantId}, defaulting to pro`);
  return "pro";
}

/**
 * Map Lemon Squeezy subscription status → our status enum.
 * LS statuses: on_trial, active, paused, past_due, unpaid, cancelled, expired
 */
export function mapLsStatus(
  lsStatus: string
): string {
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

export interface LsSubscriptionRow {
  user_id: string;
  ls_customer_id: string;
  ls_subscription_id: string;
  plan: Plan;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

/**
 * Extract a subscription row from a Lemon Squeezy webhook event.
 */
export function lsEventToRow(
  userId: string,
  sub: {
    id: string;
    attributes: {
      customer_id: number;
      variant_id: number;
      status: string;
      renews_at: string | null;
      ends_at: string | null;
      cancelled: boolean;
    };
  }
): LsSubscriptionRow {
  return {
    user_id: userId,
    ls_customer_id: String(sub.attributes.customer_id),
    ls_subscription_id: String(sub.id),
    plan: variantToPlan(String(sub.attributes.variant_id)),
    status: mapLsStatus(sub.attributes.status),
    current_period_end: sub.attributes.renews_at ?? sub.attributes.ends_at,
    cancel_at_period_end: sub.attributes.cancelled,
  };
}

// ─── Customer portal ────────────────────────────────────────────────────────

/**
 * Get the customer portal URL for a Lemon Squeezy customer.
 * Allows users to manage their subscription (cancel, update payment, etc.)
 */
export async function getCustomerPortalUrl(
  customerId: string
): Promise<string> {
  const res = await lsApi(`/customers/${customerId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch customer: ${res.status}`);
  }
  const json = await res.json();
  const portalUrl = json.data?.attributes?.urls?.customer_portal;
  if (!portalUrl) {
    throw new Error("No customer portal URL available");
  }
  return portalUrl;
}
