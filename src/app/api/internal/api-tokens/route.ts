/**
 * Internal (cookie-authenticated) endpoints powering the Settings → API
 * tokens UI. NOT part of the public /api/v1/* surface — uses your existing
 * supabase server helper for cookie session, not bearer tokens.
 *
 * GET   /api/internal/api-tokens          List my tokens (no secrets)
 * POST  /api/internal/api-tokens          Mint a new token (returns rawToken ONCE)
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr"; // adjust to your existing helper
import { issuePAT, listPATsForUser } from "@/lib/pat";

async function getUserId(): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookies().get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tokens = await listPATsForUser(userId);
  return NextResponse.json({
    tokens: tokens.map((t) => ({
      id: t.id,
      name: t.name,
      token_prefix: t.token_prefix,
      scopes: t.scopes,
      last_used_at: t.last_used_at,
      expires_at: t.expires_at,
      revoked_at: t.revoked_at,
      created_at: t.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { name?: string; scopes?: ("read" | "write")[]; expires_in_days?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.name || body.name.length > 80) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  const { rawToken, record } = await issuePAT({
    userId,
    name: body.name,
    scopes: body.scopes ?? ["read", "write"],
    expiresInDays: body.expires_in_days ?? null,
  });

  // rawToken is returned ONCE. UI must surface it now and warn the user.
  return NextResponse.json({
    raw_token: rawToken,
    token: {
      id: record.id,
      name: record.name,
      token_prefix: record.token_prefix,
      scopes: record.scopes,
      expires_at: record.expires_at,
      created_at: record.created_at,
    },
  });
}

