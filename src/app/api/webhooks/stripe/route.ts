import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  getStripe,
  STRIPE_WEBHOOK_SECRET_ENV,
  subscriptionToRow,
} from "@/lib/billing";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Round Z (billing): POST /api/webhooks/stripe
 *
 * Stripe → server. Verifies the signature with the webhook secret,
 * then upserts subscription state into public.subscriptions.
 *
 * Handled events:
 *   - customer.subscription.created
 *   - customer.subscription.updated  (plan change, cancel-at-period-end flip,
 *                                     payment status change, etc.)
 *   - customer.subscription.deleted  (subscription ended → row deleted so
 *                                     the user_plans view returns 'free')
 *
 * The webhook is the *only* writer to subscriptions. The app reads via
 * RLS-gated select on user_plans.
 *
 * Required env:
 *   - STRIPE_SECRET_KEY
 *   - STRIPE_WEBHOOK_SECRET
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - NEXT_PUBLIC_SUPABASE_URL
 */
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }
  const secret = process.env[STRIPE_WEBHOOK_SECRET_ENV];
  if (!secret) {
    return NextResponse.json(
      { error: "webhook_not_configured" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const raw = await req.text(); // Stripe needs the raw bytes for signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "bad_signature";
    console.error("[stripe webhook] sig verify failed", msg);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    // Tell Stripe to retry — config is wrong on our end.
    return NextResponse.json(
      { error: "supabase_misconfigured" },
      { status: 500 }
    );
  }
  const service = createServiceClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // First-line defense against the "paid but stayed on Free" race:
        // checkout.session.completed reliably carries client_reference_id /
        // metadata.user_id, even when the subsequent subscription.created
        // arrives before Stripe has propagated its metadata.
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
          session.client_reference_id ??
          (session.metadata?.user_id as string | undefined) ??
          null;
        if (!userId || !session.subscription) {
          return NextResponse.json({ ok: true, skipped: "incomplete_session" });
        }
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        const row = subscriptionToRow(userId, sub);
        const { error } = await service
          .from("subscriptions")
          .upsert(row, { onConflict: "user_id" });
        if (error) {
          console.error("[stripe webhook] checkout upsert failed", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        // Find the user_id. Prefer subscription metadata.user_id (set at
        // Checkout time); fall back to looking up the customer's existing
        // row in our subscriptions table.
        let userId: string | null = sub.metadata?.user_id ?? null;
        if (!userId) {
          const customerId =
            typeof sub.customer === "string" ? sub.customer : sub.customer.id;
          const { data: prior } = await service
            .from("subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          userId = (prior as { user_id?: string } | null)?.user_id ?? null;
        }
        if (!userId) {
          console.warn(
            "[stripe webhook]",
            event.type,
            "no user_id resolvable for sub",
            sub.id
          );
          return NextResponse.json({ ok: true, skipped: "no_user_id" });
        }
        // Idempotency / out-of-order protection: skip if this event is older
        // than the existing row's last update. Protects against Stripe retries
        // delivering a stale subscription.updated after a newer one.
        if (event.type === "customer.subscription.updated") {
          const { data: existing } = await service
            .from("subscriptions")
            .select("updated_at")
            .eq("user_id", userId)
            .maybeSingle();
          const existingUpdatedAt = (existing as { updated_at?: string } | null)?.updated_at;
          if (existingUpdatedAt) {
            const existingMs = new Date(existingUpdatedAt).getTime();
            const eventMs = event.created * 1000;
            if (eventMs < existingMs) {
              return NextResponse.json({ ok: true, skipped: "stale_event" });
            }
          }
        }
        
        const row = subscriptionToRow(userId, sub);
        const { error } = await service
          .from("subscriptions")
          .upsert(row, { onConflict: "user_id" });
        if (error) {
          console.error("[stripe webhook] upsert failed", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        // Subscription is gone → drop the row so user_plans returns 'free'.
        await service
          .from("subscriptions")
          .delete()
          .eq("stripe_subscription_id", sub.id);
        break;
      }
      default:
        // Other events are accepted but not actioned (Stripe expects 2xx).
        break;
    }
  } catch (e) {
    console.error("[stripe webhook] handler error", e);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
