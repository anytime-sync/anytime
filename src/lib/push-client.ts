"use client";

/**
 * push-client.ts — Round G client-side helper for Web Push.
 *
 * Flow:
 *   1. registerServiceWorker() — call once on app mount.
 *   2. requestPushPermission() — call from a user-gesture (button click).
 *   3. subscribePush() — does the W3C subscribe + POSTs to /api/push/subscribe.
 *
 * We never auto-prompt: that's Apple's #1 PWA rejection reason. Always
 * gated behind the <PushOptIn> banner, which only appears once a user
 * has shown intent (3+ tasks created).
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (e) {
    console.warn("[push-client] sw register failed", e);
  }
}

export async function pushPermissionState(): Promise<NotificationPermission> {
  if (typeof window === "undefined") return "default";
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  return Notification.requestPermission();
}

export async function subscribePush(): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn("[push-client] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set");
    return false;
  }
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;

  const reg = await navigator.serviceWorker.ready;
  // If we already have a subscription, just re-POST it (idempotent).
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch (e) {
      console.error("[push-client] subscribe failed", e);
      return false;
    }
  }
  const json = sub.toJSON() as {
    endpoint: string;
    keys?: { p256dh?: string; auth?: string };
  };
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
    }),
  });
  return res.ok;
}

export async function unsubscribePush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
  }
}

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
