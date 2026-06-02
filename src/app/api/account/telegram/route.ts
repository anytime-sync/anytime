/**
 * GET    /api/account/telegram — check link status
 * POST   /api/account/telegram — link Telegram (body: { telegramId, telegramUsername? })
 * DELETE /api/account/telegram — unlink
 *
 * Auth: Supabase session (cookie-based, same as other /api/account/* routes)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUser() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return { user, sb };
}

// GET — check link status
export async function GET() {
  const { user, sb } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await sb
    .from("user_telegram_links")
    .select("telegram_id, telegram_username, linked_at")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({ linked: !!data, ...(data ?? {}) });
}

// POST — link Telegram account
export async function POST(req: NextRequest) {
  const { user, sb } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const telegramId = body.telegramId;
  if (!telegramId || typeof telegramId !== "number") {
    return NextResponse.json(
      { error: "telegramId (number) required" },
      { status: 400 },
    );
  }

  // Upsert: if user already has a link, update it
  const { data, error } = await sb
    .from("user_telegram_links")
    .upsert(
      {
        user_id: user.id,
        telegram_id: telegramId,
        telegram_username: body.telegramUsername ?? null,
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  return NextResponse.json({ linked: true, ...data });
}

// DELETE — unlink
export async function DELETE() {
  const { user, sb } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await sb.from("user_telegram_links").delete().eq("user_id", user.id);

  return NextResponse.json({ linked: false });
}
