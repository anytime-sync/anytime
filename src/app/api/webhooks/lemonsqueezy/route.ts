import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  verifyWebhookSignature,
  lsSubscriptionToRow,
} from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/lemonsqueezy
 *
 * Lemon Squeezy → server. Verifies the HMAC signature, then upserts
 * subscription state into public.subscriptions.
 *
 * Handled events:
 *   - subscription_created   → upsert subscription row
 *   - subscription_updated   → upsert subscription row
 *   - subscription_cancelled → update status to canceled
 *   - subscription_expired   → delete row (user reverts to free)
 *   - subscription_resumed   → upsert with active status
 *   - subscription_paused    → upsert with paused status
 *
 * Required env:
 *   - LEMONSQUEEZY_WEBHOOK_SECRET
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - NEXT_PUBLIC_SUPABASE_URL
 */
export async function POST(req: Request) {
  const signature = req.headers.get("x-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const raw = await req.text();

  try {
    const valid = verifyWebhookSignature(raw, signature);
    if (!valid) {
      console.error("[ls webhook] signature verification failed");
      return NextResponse.json({ error: "bad_signature" }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sig_error";
    console.error("[ls webhook] sig error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const payload = JSON.parse(raw);
  const eventName: string = payload.meta?.event_name;
  const customData = payload.meta?.custom_data;
  const sub = payload.data;

  if (!eventName || !sub) {
    return NextResponse.json({ ok: true, skipped: "no_event" });
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    return NextResponse.json(
      { error: "supabase_misconfigured" },
      { status: 500 }
    );
  }
  const service = createServiceClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Resolve user_id from custom_data (set at checkout) or existing row
    let userId: string | null = customData?.user_id ?? null;

    if (!userId) {
      // Fallback: look up by LS customer ID
      const lsCustomerId = String(sub.attributes?.customer_id);
      if (lsCustomerId) {
        const { data: prior } = await service
          .from("subscriptions")
          .select("user_id")
          .eq("ls_customer_id", lsCustomerId)
          .maybeSingle();
        userId = (prior as { user_id?: string } | null)?.user_id ?? null;
      }
    }

    if (!userId) {
      console.warn("[ls webhook]", eventName, "no user_id for sub", sub.id);
      return NextResponse.json({ ok: true, skipped: "no_user_id" });
    }

    switch (eventName) {
      case "subscription_created":
      case "subscription_updated":
      case "subscription_resumed": {
        const row = lsSubscriptionToRow(userId, sub);
        const { error } = await service
          .from("subscriptions")
          .upsert(row, { onConflict: "user_id" });
        if (error) {
          console.error("[ls webhook] upsert failed", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        break;
      }
      case "subscription_cancelled":
      case "subscription_paused": {
        const row = lsSubscriptionToRow(userId, sub);
        const { error } = await service
          .from("subscriptions")
          .upsert(row, { onConflict: "user_id" });
        if (error) {
          console.error("[ls webhook] cancel/pause upsert failed", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        break;
      }
      case "subscription_expired": {
        // Subscription fully expired → remove row, user reverts to free
        await service
          .from("subscriptions")
          .delete()
          .eq("ls_subscription_id", String(sub.id));
        break;
      }
      default:
        // Accept but don't act on other events
        break;
    }
  } catch (e) {
    console.error("[ls webhook] handler error", e);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
