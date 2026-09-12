import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signXRequest, verifyX, X_KEYS, type XCredentials } from "./x-connection";

export const PROMOTION_HOURS = { oqua: [8, 13, 18], firstsight: [10, 15, 20], firstlight: [12, 17, 22] } as const;
export type Brand = keyof typeof PROMOTION_HOURS;
const hosts: Record<Brand, string[]> = { oqua: ["oqua.com", "www.oqua.com"], firstsight: ["firstsight.to"], firstlight: ["firstlight.to"] };
export function validatePromotion(brand: string, body: string) {
  if (!(brand in hosts) || !body.trim()) return false;
  const links = body.match(/https?:\/\/[^\s]+/g) ?? [];
  if (links.length !== 1) return false;
  try {
    const url = new URL(links[0]);
    if (url.protocol !== "https:" || !hosts[brand as Brand].includes(url.hostname) || url.username || url.password) return false;
  } catch { return false; }
  // Conservative X weighted count: URLs count as 23; non-ASCII codepoints as 2.
  // Overcounts some emoji/combining sequences rather than letting an oversized post through.
  const text = body.replace(links[0], "");
  const weight = [...text].reduce((n, c) => n + (c.codePointAt(0)! <= 0x7f ? 1 : 2), 23);
  return weight <= 280;
}
export function promotionHash(body: string) { return createHash("sha256").update(body.trim().replace(/\s+/g, " ").toLowerCase()).digest("hex"); }

export async function sendPromotion(keys: XCredentials, body: string, fetcher: typeof fetch = fetch) {
  const url = "https://api.x.com/2/tweets";
  try {
    const response = await fetcher(url, { method: "POST", headers: { Authorization: signXRequest("POST", url, keys), "Content-Type": "application/json" }, body: JSON.stringify({ text: body }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return { status: response.status >= 500 ? "uncertain" : "failed", error: `x_http_${response.status}`, pause: [401, 402, 403, 429].includes(response.status) };
    const data = await response.json();
    if (!/^\d+$/.test(data?.data?.id ?? "")) return { status: "uncertain", error: "missing_post_receipt", pause: true };
    return { status: "posted", url: `https://x.com/AaronCheng69226/status/${data.data.id}`, error: null, pause: false };
  } catch { return { status: "uncertain", error: "response_unknown_do_not_retry", pause: true }; }
}

/** A single server-side sender. Claim before I/O; ambiguous responses are never replayed. */
export async function dispatchPromotion(db: SupabaseClient, now = new Date()) {
  const stamp = now.toISOString();
  const lease = new Date(now.getTime() + 60_000).toISOString();
  const { data: lock, error: lockError } = await db.from("x_promotion_control").update({ lease_until: lease, last_tick_at: stamp }).eq("id", 1).eq("enabled", true).lt("lease_until", stamp).select("id").maybeSingle();
  if (lockError) return { state: "store_unavailable" };
  if (!lock) return { state: "paused_or_busy" };
  try {
    // Expired posts are skipped, not dumped onto the account after downtime.
    const { error: expiryError } = await db.from("x_promotion_queue").update({ status: "skipped", error: "missed_window" }).eq("status", "queued").lt("expires_at", stamp);
    if (expiryError) return { state: "store_unavailable" };
    const { data: row, error } = await db.from("x_promotion_queue").select("id,brand,body,status,scheduled_at").eq("status", "queued").lte("scheduled_at", stamp).gte("expires_at", stamp).order("scheduled_at").limit(1).maybeSingle();
    if (error) return { state: "store_unavailable" };
    if (!row) return { state: "nothing_due" };
    if (!validatePromotion(row.brand, row.body)) {
      await db.from("x_promotion_queue").update({ status: "failed", error: "invalid_copy_or_brand_link" }).eq("id", row.id).eq("status", "queued");
      return { state: "invalid_copy", id: row.id };
    }
    const { data: credentials, error: keyError } = await db.from("ops_secrets").select("key,value").in("key", [...X_KEYS]);
    const keys = Object.fromEntries((credentials ?? []).map(r => [r.key, r.value])) as XCredentials;
    if (keyError || X_KEYS.some(k => !keys[k]?.trim())) return { state: "credentials_unavailable" };
    const identity = await verifyX(keys);
    if (identity.state !== "connected") {
      await db.from("x_promotion_control").update({ enabled: false, pause_reason: identity.state }).eq("id", 1);
      return { state: identity.state };
    }
    const { data: claimed, error: claimError } = await db.from("x_promotion_queue").update({ status: "sending", attempted_at: stamp }).eq("id", row.id).eq("status", "queued").select("id").maybeSingle();
    if (claimError || !claimed) return { state: "claim_not_acquired" };
    const result = await sendPromotion(keys, row.body);
    const { error: receiptError } = await db.from("x_promotion_queue").update({ status: result.status, result_url: result.url ?? null, error: result.error, posted_at: result.status === "posted" ? new Date().toISOString() : null }).eq("id", row.id).eq("status", "sending");
    if (result.pause || result.status === "uncertain" || receiptError) {
      await db.from("x_promotion_control").update({ enabled: false, pause_reason: receiptError ? "receipt_save_failed_check_x" : result.error }).eq("id", 1);
    }
    return { state: receiptError ? "receipt_save_failed_check_x" : result.status, id: row.id, url: result.url ?? null, error: result.error };
  } finally {
    // A stale invocation cannot unlock another invocation's lease.
    await db.from("x_promotion_control").update({ lease_until: "1970-01-01T00:00:00Z" }).eq("id", 1).eq("lease_until", lease);
  }
}
