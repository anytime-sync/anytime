import { createHmac, randomBytes } from "node:crypto";

export const X_ACCOUNT = "AaronCheng69226";
export const X_BRANDS = [
  { name: "OQUA", url: "https://www.oqua.com", slot: "oqua:" },
  { name: "First Sight", url: "https://firstsight.to/community.html", slot: "fs-" },
  { name: "First Light", url: "https://firstlight.to", slot: "firstlight" },
] as const;

export const X_KEYS = ["X_CONSUMER_KEY", "X_CONSUMER_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"] as const;
export type XCredentials = Record<(typeof X_KEYS)[number], string>;

function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

/** OAuth 1.0a user context. Credentials never leave this server module. */
export function signXRequest(
  method: string,
  url: string,
  keys: XCredentials,
  nonce = randomBytes(16).toString("hex"),
  timestamp = Math.floor(Date.now() / 1000).toString(),
): string {
  const parsed = new URL(url);
  const oauth: Record<string, string> = {
    oauth_consumer_key: keys.X_CONSUMER_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: keys.X_ACCESS_TOKEN,
    oauth_version: "1.0",
  };
  const pairs = [...parsed.searchParams.entries(), ...Object.entries(oauth)]
    .map(([key, value]) => [encode(key), encode(value)])
    .sort(([ak, av], [bk, bv]) => ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0);
  const parameters = pairs.map(([key, value]) => key + "=" + value).join("&");
  const base = [method.toUpperCase(), parsed.origin + parsed.pathname, parameters].map(encode).join("&");
  oauth.oauth_signature = createHmac("sha1", encode(keys.X_CONSUMER_SECRET) + "&" + encode(keys.X_ACCESS_TOKEN_SECRET))
    .update(base).digest("base64");
  return "OAuth " + Object.entries(oauth).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => encode(key) + '="' + encode(value) + '"').join(", ");
}

export function xFailure(status: number) {
  if (status === 402) return { state: "credits_required", message: "X API credits are depleted. Add prepaid credits in the X Developer Console; reconnecting will not fix the balance." };
  if (status === 401) return { state: "reconnect_required", message: "X rejected the saved authentication. Review the app and account authorization." };
  if (status === 403) return { state: "permissions_required", message: "X denied this operation. Review the app permissions and API access." };
  if (status === 429) return { state: "rate_limited", message: "X is rate-limiting requests. Wait before checking again." };
  return { state: "unavailable", message: "X could not be verified. No connection or posting success is assumed." };
}

export async function verifyX(keys: XCredentials, fetcher: typeof fetch = fetch) {
  const url = "https://api.x.com/2/users/me";
  try {
    const response = await fetcher(url, {
      headers: { Authorization: signXRequest("GET", url, keys) },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { ...xFailure(response.status), httpStatus: response.status };
    const payload = await response.json();
    const user = payload?.data;
    if (typeof user?.id !== "string" || typeof user?.username !== "string") {
      return { state: "unavailable", message: "X returned an incomplete account identity.", httpStatus: response.status };
    }
    if (user.username.toLowerCase() !== X_ACCOUNT.toLowerCase()) {
      return { state: "account_mismatch", message: "The saved credentials belong to a different X account. Promotion remains unverified.", httpStatus: response.status };
    }
    return {
      state: "connected",
      message: "The shared X account is authenticated for OQUA, First Sight and First Light. Publishing permission is checked separately; this check sends no post.",
      account: { id: user.id, username: user.username },
      httpStatus: response.status,
    };
  } catch {
    // Never echo provider errors, request headers or credential-bearing objects.
    return { state: "unavailable", message: "X could not be reached securely. Try again later." };
  }
}
