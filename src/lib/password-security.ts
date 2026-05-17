"use client";

/**
 * Client-side password security checks.
 *
 * Replicates what Supabase Pro's "Prevent use of leaked passwords" toggle
 * does, but free: we SHA-1 the password in the browser, send only the first
 * 5 hex chars to HaveIBeenPwned's k-anonymity range API, and look for our
 * password's suffix in the response. The full password never leaves the
 * device. See https://haveibeenpwned.com/API/v3#PwnedPasswords for the
 * range-search protocol.
 *
 * Fail-open by design: if the API or crypto call throws (offline, CORS,
 * etc.), we let signup proceed. The check is a hardening, not a hard gate.
 */

async function sha1Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.crypto?.subtle) return false;
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!res.ok) return false;
    const text = await res.text();
    for (const line of text.split("\n")) {
      const [s] = line.trim().split(":");
      if (s === suffix) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export type PasswordStrengthResult = { ok: true } | { ok: false; reason: string };

/**
 * Local strength check that runs before the breach lookup. Cheap, no
 * network call, gives the user immediate feedback. Rules are deliberately
 * minimal so we don't over-burden a calm productivity sign-up flow.
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  if (password.length < 10) {
    return { ok: false, reason: "Please use a password with at least 10 characters." };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { ok: false, reason: "Please include at least one letter." };
  }
  if (!/\d/.test(password)) {
    return { ok: false, reason: "Please include at least one number." };
  }
  return { ok: true };
}
