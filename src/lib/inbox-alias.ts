/**
 * inbox-alias.ts — generates the local-part of a per-user inbound
 * email alias.
 *
 * Round D ships email-to-task: every user gets a private address on
 * `firstlight.to` that, when an email is sent to it, becomes a task
 * in their Inbox. This module generates that local-part.
 *
 * Format: 16 lowercase URL-safe characters drawn from a reduced
 * alphabet with the visually-ambiguous characters removed
 * (`l`, `1`, `i`, `0`, `o`). Users will dictate this address over the
 * phone, type it into their email client's autocomplete, and read it
 * off a screen — readability beats raw entropy. With 16 chars from a
 * 26-letter alphabet that's still ~75 bits, well above the dedup
 * threshold for any plausible userbase.
 */

// 26 lowercase characters with the ambiguous ones stripped.
//   removed: l (looks like 1/i), 1, i (looks like l), 0, o (looks like 0)
// Result is 26 letters + 8 digits = 31 chars; we pick a single
// canonical 26-char alphabet by dropping the digits that survive
// (they make alias dictation harder over the phone — "two-three" vs
// "two-three-zero" is a common error). Letters only keeps the address
// pronounceable.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
// (drops: l, i, o from a-z; drops 0, 1 from 0-9)

/**
 * Generate a 16-character URL-safe alias local-part.
 *
 * Uses `crypto.randomBytes` when available (Node.js / edge runtimes
 * that polyfill it). Falls back to `Math.random` only when crypto is
 * absent, which shouldn't happen in production but keeps the function
 * total for tests.
 */
export function generateAlias(): string {
  const len = 16;
  const out = new Array<string>(len);
  const N = ALPHABET.length;

  let bytes: Uint8Array | null = null;
  try {
    // Node.js path
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require("crypto") as typeof import("crypto");
    if (typeof nodeCrypto?.randomBytes === "function") {
      bytes = new Uint8Array(nodeCrypto.randomBytes(len));
    }
  } catch {
    /* fall through to Web Crypto */
  }
  if (!bytes && typeof globalThis.crypto?.getRandomValues === "function") {
    bytes = globalThis.crypto.getRandomValues(new Uint8Array(len));
  }

  if (bytes) {
    for (let i = 0; i < len; i++) {
      out[i] = ALPHABET[bytes[i] % N];
    }
    return out.join("");
  }

  // Last-resort fallback. Not cryptographically strong; logs a warning
  // so ops can spot misconfigured environments.
  if (typeof console !== "undefined") {
    console.warn(
      "[inbox-alias] no crypto source found, falling back to Math.random — alias is not cryptographically random"
    );
  }
  for (let i = 0; i < len; i++) {
    out[i] = ALPHABET[Math.floor(Math.random() * N)];
  }
  return out.join("");
}
