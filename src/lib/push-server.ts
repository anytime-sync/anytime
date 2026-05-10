/**
 * push-server.ts — server-side helper to send a Web Push notification
 * to one user (broadcast across all their subscriptions).
 *
 * Uses `web-push` (npm). Add to package.json:
 *   "web-push": "^3.6.7"
 *
 * Required env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
 *
 * Called by:
 *   - reminders cron (when a task's reminder_at fires)
 *   - daily-digest cron (morning brief)
 *   - manual /api/push/send (for testing)
 *
 * Side effect: prunes subscriptions that return 404/410 (browser
 * unsubscribed without telling us).
 */
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:noreply@firstlight.to";
  if (!pub || !priv) {
    throw new Error("VAPID keys not set");
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Click action URL. Defaults to /app/today. */
  url?: string;
  /** Notification tag — newer notifs with same tag replace older ones. */
  tag?: string;
};

export async function sendPushToUser({
  supabase,
  userId,
  payload,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  userId: string;
  payload: PushPayload;
}): Promise<{ sent: number; pruned: number; failed: number }> {
  configure();

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error || !subs) return { sent: 0, pruned: 0, failed: 0 };

  let sent = 0;
  let pruned = 0;
  let failed = 0;
  const json = JSON.stringify(payload);

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        json
      );
      sent++;
    } catch (e: unknown) {
      const err = e as { statusCode?: number };
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Browser unsubscribed. Drop it.
        await supabase.from("push_subscriptions").delete().eq("id", s.id);
        pruned++;
      } else {
        failed++;
      }
    }
  }

  return { sent, pruned, failed };
}
