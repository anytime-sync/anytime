import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Persist the browser's PushSubscription. The client passes the
 * subscription's endpoint, p256dh, auth keys (and optionally a UA hint
 * for our own logging — multiple devices possible per user).
 *
 * RLS allows insert under auth.uid() = user_id, so we can use the
 * regular client.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const ua = (req.headers.get("user-agent") ?? "").slice(0, 256);

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: u.user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: ua,
      },
      { onConflict: "user_id,endpoint" }
    );

  if (error) {
    console.error("[push.subscribe]", error);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
