import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.endpoint) {
    return NextResponse.json({ error: "missing_endpoint" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", u.user.id)
    .eq("endpoint", body.endpoint);

  if (error) {
    console.error("[push.unsubscribe]", error);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
