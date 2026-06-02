/**
 * POST /api/telegram/setup
 *
 * Registers the webhook URL with Telegram. Call once after deploy.
 * Protected by CRON_SECRET (same as other admin endpoints).
 */

import { NextRequest, NextResponse } from "next/server";
import { setWebhook, isBotConfigured } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  // Auth: require CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBotConfigured()) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN not set" },
      { status: 503 },
    );
  }

  // Derive webhook URL from request
  const url = new URL(req.url);
  const webhookUrl = `${url.protocol}//${url.host}/api/telegram/webhook`;

  const ok = await setWebhook(webhookUrl);
  return NextResponse.json({ ok, webhookUrl });
}
