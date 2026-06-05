/**
 * POST /api/account/telegram/link-token
 * 
 * Generates a short-lived token that the user sends to the Telegram bot
 * to link their account. Token expires in 10 minutes.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate a 6-char alphanumeric code (easy to type in Telegram)
  const code = crypto.randomBytes(3).toString("hex").toUpperCase(); // e.g. "A1B2C3"
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  const svc = getServiceClient();

  // Delete any existing pending tokens for this user
  await svc
    .from("telegram_link_tokens")
    .delete()
    .eq("user_id", user.id);

  // Insert new token
  const { error } = await svc
    .from("telegram_link_tokens")
    .insert({
      user_id: user.id,
      code,
      expires_at: expiresAt,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    code,
    expiresAt,
    botUrl: "https://t.me/Firstlightapp_bot",
    instruction: `Send this code to @Firstlightapp_bot: ${code}`,
  });
}
