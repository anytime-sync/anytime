import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kicks off the Google Calendar OAuth dance.
 *
 *   GET /api/calendar/google/connect
 *     → 302 to https://accounts.google.com/o/oauth2/v2/auth?...
 *
 * State format: `<nonce>.<base64url(userId)>.<base64url(hmac(userId|nonce))>`
 *   - `nonce` is 16 random bytes (CSRF anti-replay)
 *   - the HMAC binds the nonce + user, so an attacker can't swap user
 *     ids server-side.
 *
 * Reuses INBOUND_EMAIL_SECRET as the HMAC key for now (per Round F
 * spec). When we have a dedicated GOOGLE_OAUTH_STATE_SECRET we'll
 * swap it out.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 }
    );
  }

  const appUrl = getAppUrl();
  if (!appUrl) {
    return NextResponse.json({ error: "no_app_url" }, { status: 500 });
  }
  const redirectUri = `${appUrl}/api/calendar/google/callback`;

  const nonce = randomBytes(16).toString("hex");
  const sig = createHmac("sha256", secret)
    .update(`${user.id}|${nonce}`)
    .digest("hex");
  const state = `${nonce}.${b64url(user.id)}.${sig}`;

  let url: string;
  try {
    url = buildAuthUrl({ state, redirectUri });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "build_auth_url_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.redirect(url, { status: 302 });
}

function b64url(s: string): string {
  return Buffer.from(s, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getAppUrl(): string | null {
  const fromEnv =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!fromEnv) return null;
  return fromEnv.replace(/\/+$/, "");
}
