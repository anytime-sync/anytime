/**
 * Personal Access Token (PAT) helpers for the First Light public API.
 *
 * Token format: `flp_live_<32 url-safe base64 chars>` (≈192 bits of entropy).
 * We persist only the SHA-256 hash; the raw token is shown to the user
 * exactly once at mint time and never reappears in the UI.
 *
 * Used by:
 *   - src/app/settings/api-tokens/page.tsx   (UI: mint, list, revoke)
 *   - src/app/api/v1/_lib/auth.ts            (validates Bearer tokens)
 */

import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TOKEN_PREFIX = "flp_live_";
export const TOKEN_PREFIX_LEN = 8; // first 8 chars of the *raw* token shown in UI
const TOKEN_BYTES = 24; // 24 random bytes → 32 base64url chars

export type Scope = "read" | "write";

export interface PatRecord {
  id: string;
  user_id: string;
  name: string;
  token_prefix: string;
  scopes: Scope[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/** Stable SHA-256 hex digest used as the storage key for a raw token. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** Generate a fresh raw token. Caller must show it to the user immediately
 *  and never persist anything but its hash + prefix. */
export function generateRawToken(): string {
  const random = randomBytes(TOKEN_BYTES).toString("base64url");
  return `${TOKEN_PREFIX}${random}`;
}

// ---------------------------------------------------------------------------
// Service-role Supabase client (only on the server)
// ---------------------------------------------------------------------------

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error(
      "PAT helpers require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Mint / list / revoke
// ---------------------------------------------------------------------------

/**
 * Issue a new PAT for `userId`. Returns the *raw* token (shown once) and the
 * stored record. The caller must surface the raw token to the user and then
 * forget it.
 */
export async function issuePAT(opts: {
  userId: string;
  name: string;
  scopes?: Scope[];
  expiresInDays?: number | null;
}): Promise<{ rawToken: string; record: PatRecord }> {
  const { userId, name } = opts;
  const scopes = opts.scopes ?? (["read", "write"] as Scope[]);
  const expiresAt =
    opts.expiresInDays && opts.expiresInDays > 0
      ? new Date(Date.now() + opts.expiresInDays * 86_400_000).toISOString()
      : null;

  const rawToken = generateRawToken();
  const token_hash = hashToken(rawToken);
  const token_prefix = rawToken.slice(0, TOKEN_PREFIX.length + TOKEN_PREFIX_LEN);

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("personal_access_tokens")
    .insert({
      user_id: userId,
      name,
      token_hash,
      token_prefix,
      scopes,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error) throw error;
  return { rawToken, record: data as PatRecord };
}

/**
 * Validate a raw bearer token. Returns the owning user_id + scopes if active,
 * or null otherwise. Atomically bumps last_used_at via the SECURITY DEFINER
 * `public.validate_pat` SQL function.
 */
export async function validatePAT(
  rawToken: string,
): Promise<{ userId: string; scopes: Scope[] } | null> {
  if (!rawToken.startsWith(TOKEN_PREFIX)) return null;
  const supabase = serviceClient();
  const { data, error } = await supabase
    .rpc("validate_pat", { p_hash: hashToken(rawToken) })
    .single();

  if (error || !data) return null;
  const row = data as { user_id: string; scopes: Scope[] };
  return { userId: row.user_id, scopes: row.scopes };
}

/** List all (active + revoked) tokens for a user. Used by the Settings UI. */
export async function listPATsForUser(userId: string): Promise<PatRecord[]> {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("personal_access_tokens")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PatRecord[];
}

/** Soft-revoke a token. Idempotent. */
export async function revokePAT(opts: {
  tokenId: string;
  userId: string;
}): Promise<void> {
  const supabase = serviceClient();
  const { error } = await supabase
    .from("personal_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", opts.tokenId)
    .eq("user_id", opts.userId)
    .is("revoked_at", null);
  if (error) throw error;
}

