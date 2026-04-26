"use client";

/**
 * Client-side helpers for browser web push subscription.
 * Requires a registered service worker (we register one in
 * components/app/sw-register.tsx).
 */

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function pushSupported(): Promise<boolean> {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!(await pushSupported())) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return await reg.pushManager.getSubscription();
}

export async function subscribePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!(await pushSupported())) return { ok: false, reason: "unsupported" };

  const perm = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };

  // Make sure SW is registered.
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    try {
      reg = await navigator.serviceWorker.register("/sw.js");
    } catch {
      return { ok: false, reason: "sw_register_failed" };
    }
  }

  // Fetch the VAPID public key from the server.
  const r = await fetch("/api/push/vapid-public-key");
  if (!r.ok) return { ok: false, reason: "vapid_unavailable" };
  const { publicKey } = await r.json();
  if (!publicKey) return { ok: false, reason: "vapid_unavailable" };

  // Subscribe (or reuse existing).
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  // Persist to our backend.
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) return { ok: false, reason: "persist_failed" };
  return { ok: true };
}

export async function unsubscribePush(): Promise<boolean> {
  const sub = await getCurrentSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  return true;
}
