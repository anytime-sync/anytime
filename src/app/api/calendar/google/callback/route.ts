import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  exchangeCodeForTokens,
  fetchUserInfo,
  fetchPrimaryCalendarId,
  SCOPES,
} from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth callback. Google sends:
 *   ?code=...&state=...
 *   or ?error=access_denied&state=...
 *
 * We verify the HMAC in `state` matches the currently-authed user
 * (CSRF + binding), exchange the code for tokens, fetch the account
 * email + primary calendar id, and upsert into
 * `user_calendar_connections` via the service-role client (so the
 * row is owned by the user even if RLS would reject the write).
 *
 * On success: 302 → /app/settings?cal_connected=1
 * On error:   302 → /app/settings?cal_err=<reason>
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const appUrl = getAppUrl();
  const settingsUrl = `${appUrl ?? ""}/app/settings`;

  if (oauthError) {
    return NextResponse.redirect(
      `${settingsUrl}?cal_err=${encodeURIComponent(oauthError)}`,
      { status: 302 }
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}?cal_err=missing_params`, {
      status: 302,
    });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${settingsUrl}?cal_err=unauthorized`, {
      status: 302,
    });
  }

  // Verify state matches the authed user.
  const stateUser = verifyState(state, user.id);
  if (!stateUser) {
    return NextResponse.redirect(`${settingsUrl}?cal_err=bad_state`, {
      status: 302,
    });
  }

  if (!appUrl) {
    return NextResponse.redirect(`${settingsUrl}?cal_err=no_app_url`, {
      status: 302,
    });
  }
  const redirectUri = `${appUrl}/api/calendar/google/callback`;

  let tokens;
  try {
    tokens = await exchangeCodeForTokens({ code, redirectUri });
  } catch (e) {
    console.error("[gcal callback] token exchange", e);
    return NextResponse.redirect(`${settingsUrl}?cal_err=token_exchange`, {
      status: 302,
    });
  }

  let info;
  let primaryCalendarId: string;
  try {
    info = await fetchUserInfo(tokens.access_token);
    primaryCalendarId = await fetchPrimaryCalendarId(tokens.access_token);
  } catch (e) {
    console.error("[gcal callback] userinfo/calendar", e);
    return NextResponse.redirect(`${settingsUrl}?cal_err=userinfo`, {
      status: 302,
    });
  }

  const expiresAt = new Date(
    Date.now() + tokens.expires_in * 1000
  ).toISOString();

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supaUrl) {
    return NextResponse.redirect(
      `${settingsUrl}?cal_err=supabase_misconfigured`,
      { status: 302 }
    );
  }
  const service = createServiceClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: upErr } = await service
    .from("user_calendar_connections")
    .upsert(
      {
        user_id: user.id,
        provider: "google",
        account_email: info.email,
        // Refresh tokens are only returned on the first consent (with
        // prompt=consent we always get one, but be defensive).
        ...(tokens.refresh_token
          ? { refresh_token: tokens.refresh_token }
          : {}),
        access_token: tokens.access_token,
        expires_at: expiresAt,
        scope: tokens.scope ?? SCOPES.join(" "),
        primary_calendar_id: primaryCalendarId,
        // Force a fresh bootstrap on the next sync — old sync_token
        // (if any) belongs to a previous connection.
        sync_token: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (upErr) {
    console.error("[gcal callback] upsert", upErr);
    return NextResponse.redirect(`${settingsUrl}?cal_err=db_upsert`, {
      status: 302,
    });
  }

  return NextResponse.redirect(`${settingsUrl}?cal_connected=1`, {
    status: 302,
  });
}

function verifyState(state: string, userId: string): string | null {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) return null;
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [nonce, b64Uid, sig] = parts;
  if (!nonce || !b64Uid || !sig) return null;
  let stateUid: string;
  try {
    stateUid = Buffer.from(
      b64Uid.replace(/-/g, "+").replace(/_/g, "/") +
        "=".repeat((4 - (b64Uid.length % 4)) % 4),
      "base64"
    ).toString("utf-8");
  } catch {
    return null;
  }
  if (stateUid !== userId) return null;
  const expected = createHmac("sha256", secret)
    .update(`${userId}|${nonce}`)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(sig, "hex");
  } catch {
    return null;
  }
  if (providedBuf.length !== expectedBuf.length) return null;
  return timingSafeEqual(providedBuf, expectedBuf) ? userId : null;
}

function getAppUrl(): string | null {
  const fromEnv =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!fromEnv) return null;
  return fromEnv.replace(/\/+$/, "");
}
