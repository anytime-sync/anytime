import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  verifyWebhookSignature,
  lsEventToRow,
  mapLsStatus,
} from "@/lib/lemonsqueezy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/lemonsqueezy
 *
 * Lemon Squeezy → server. Verifies HMAC signature, then upserts
 * subscription state into public.subscriptions.
 *
 * Handled events:
 *   - subscription_created
 *   - subscription_updated  (plan change, cancel, payment status, etc.)
 *   - subscription_cancelled (maps to status = canceled in our DB)
 *   - subscription_expired  (subscription ended → delete row)
 *
 * Required env:
 *   - LEMONSQUEEZY_WEBHOOK_SECRET
 *   - LEMONSQUEEZY_PLUS_VARIANT_ID
 *   - LEMONSQUEEZY_PRO_VARIANT_ID
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - NEXT_PUBLIC_SUPABASE_URL
 */
export async function POST(req: Request) {
  const signature = req.headers.get("x-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  // Verify webhook signature
  let valid: boolean;
  try {
    valid = await verifyWebhookSignature(rawBody, signature);
  } catch (e) {
    console.error("[ls webhook] verification error", e);
    return NextResponse.json({ error: "verification_error" }, { status: 500 });
  }
  if (!valid) {
    console.error("[ls webhook] invalid signature");
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const eventName: string = event.meta?.event_name ?? "";
  const customData = event.meta?.custom_data ?? {};
  const userId: string | undefined = customData.user_id;

  if (!userId) {
    console.error("[ls webhook] no user_id in custom_data", eventName);
    // Return 200 so LS doesn't retry — we can't process without a user_id
    return NextResponse.json({ error: "no_user_id" }, { status: 200 });
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
    const sub = event.data;

    switch (eventName) {
      case "subscription_created":
      case "subscription_updated": {
        const row = lsEventToRow(userId, sub);
        // Upsert — use user_id as the conflict key
        const { error } = await service
          .from("subscriptions")
          .upsert(
            {
              user_id: row.user_id,
              // Store LS IDs in the stripe_* columns for now to avoid
              // a schema migration. The columns are just text fields.
              stripe_customer_id: row.ls_customer_id,
              stripe_subscription_id: row.ls_subscription_id,
              plan: row.plan,
              status: row.status,
              current_period_end: row.current_period_end,
              cancel_at_period_end: row.cancel_at_period_end,
            },
            { onConflict: "user_id" }
          );
        if (error) {
          console.error("[ls webhook] upsert error", error);
          return NextResponse.json({ error: "db_error" }, { status: 500 });
        }
        console.log(
          `[ls webhook] ${eventName}: user=${userId} plan=${row.plan} status=${row.status}`
        );
        break;
      }

      case "subscription_cancelled": {
        // LS sends this when the user cancels. The sub stays active until
        // period end, then LS sends subscription_expired.
        // Update status and set cancel_at_period_end = true.
        const row = lsEventToRow(userId, sub);
        const { error } = await service
          .from("subscriptions")
          .update({
            status: row.status,
            cancel_at_period_end: true,
            current_period_end: row.current_period_end,
          })
          .eq("user_id", userId);
        if (error) {
          console.error("[ls webhook] cancel update error", error);
        }
        console.log(`[ls webhook] subscription_cancelled: user=${userId}`);
        break;
      }

      case "subscription_expired": {
        // Subscription fully ended — remove the row so user_plans returns 'free'.
        const { error } = await service
          .from("subscriptions")
          .delete()
          .eq("user_id", userId);
        if (error) {
          console.error("[ls webhook] delete error", error);
        }
        console.log(`[ls webhook] subscription_expired: user=${userId} → free`);
        break;
      }

      default:
        console.log(`[ls webhook] unhandled event: ${eventName}`);
    }
  } catch (e) {
    console.error("[ls webhook] processing error", e);
    return NextResponse.json({ error: "processing_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
