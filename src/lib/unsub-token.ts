/**
 * One-click unsubscribe tokens for reminder emails.
 *
 * Format: <base64url(userId)>.<base64url(hmacSha256(userId, secret))>
 *
 * Reuses CRON_SECRET as the signing key — that secret is already required
 * in production, server-only, and rotating it correctly invalidates every
 * outstanding unsubscribe link (which is the right behavior on rotation).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf as any)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function getSecret(): string {
  const s = process.env.CRON_SECRET;
  if (!s) throw new Error("CRON_SECRET not set");
  return s;
}

export function makeUnsubToken(userId: string): string {
  const sig = createHmac("sha256", getSecret()).update(userId).digest();
  return `${b64url(userId)}.${b64url(sig)}`;
}

/** Validate and return the user_id, or null on any tampering. */
export function verifyUnsubToken(token: string): string | null {
  const [idPart, sigPart] = token.split(".");
  if (!idPart || !sigPart) return null;
  let userId: string;
  let provided: Buffer;
  try {
    userId = fromB64url(idPart).toString("utf-8");
    provided = fromB64url(sigPart);
  } catch {
    return null;
  }
  let expected: Buffer;
  try {
    expected = createHmac("sha256", getSecret()).update(userId).digest();
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? userId : null;
}
