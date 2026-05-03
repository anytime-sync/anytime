import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Token management for the ICS calendar feed.
 *
 * GET    — return the current token state (token, created_at, url)
 * POST   — mint a new token (or rotate the existing one)
 * DELETE — clear the token (disables the feed; subscribed calendars
 *          will silently 404 on next refresh)
 *
 * We use the service-role client so that the user_preferences upsert
 * isn't subject to the table's RLS policy referencing auth.users
 * (the public anon role can hit a "permission denied for table users"
 * error when we touched site_content the same way — same fix here).
 *
 * Auth comes from the cookie-based server client first; we only call
 * the service-role client AFTER we've confirmed an authenticated user.
 */

function newToken(): string {
  // 32 random bytes → 43-char base64url. Plenty of entropy and
  // URL-safe (no padding, no slashes).
  return randomBytes(32).toString("base64url");
}

function admin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supaUrl) return null;
  return createSupabaseClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function currentUserId(): Promise<string | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function buildUrl(req: Request, token: string): string {
  const url = new URL(req.url);
  // Use APP_URL when present so the URL we hand the user matches what
  // they see in the browser (e.g. firstlight.to even if we're running
  // on a vercel.app preview alias).
  const base = process.env.APP_URL || `${url.protocol}//${url.host}`;
  // Single path segment so the [token]/route.ts handler matches; the
  // .ics suffix is stripped server-side. This is the form Apple
  // Calendar / Google Calendar / Outlook all expect.
  return `${base.replace(/\/$/, "")}/api/ics/${token}.ics`;
}

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const a = admin();
  if (!a) return NextResponse.json({ error: "supabase_misconfigured" }, { status: 500 });
  const { data, error } = await a
    .from("user_preferences")
    .select("ics_feed_token, ics_feed_created_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const token = data?.ics_feed_token ?? null;
  return NextResponse.json({
    enabled: !!token,
    token,
    url: token ? buildUrl(req, token) : null,
    created_at: data?.ics_feed_created_at ?? null,
  });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const a = admin();
  if (!a) return NextResponse.json({ error: "supabase_misconfigured" }, { status: 500 });
  const token = newToken();
  const { error } = await a
    .from("user_preferences")
    .upsert({
      user_id: userId,
      ics_feed_token: token,
      ics_feed_created_at: new Date().toISOString(),
    });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    enabled: true,
    token,
    url: buildUrl(req, token),
    created_at: new Date().toISOString(),
  });
}

export async function DELETE(_req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const a = admin();
  if (!a) return NextResponse.json({ error: "supabase_misconfigured" }, { status: 500 });
  const { error } = await a
    .from("user_preferences")
    .update({ ics_feed_token: null, ics_feed_created_at: null })
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enabled: false, token: null, url: null });
}
