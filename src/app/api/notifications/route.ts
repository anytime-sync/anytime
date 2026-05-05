import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/notifications
 *
 * Returns the caller&rsquo;s notifications, newest first. Unread shown
 * first by default. The bell badge counts unread items.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));

  let q = supabase
    .from("app_notifications")
    .select("id, kind, title, body, payload, action_url, read_at, created_at")
    .eq("user_id", user.id);
  if (unreadOnly) q = q.is("read_at", null);
  q = q
    .order("read_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Also return the unread count (cheap header for the bell badge).
  const { count: unreadCount } = await supabase
    .from("app_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return NextResponse.json({ rows: data, unread: unreadCount ?? 0 });
}

/**
 * PATCH /api/notifications  (mark-all-read)
 * Body: { mark_all_read: true }
 */
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { mark_all_read?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  if (!body.mark_all_read) {
    return NextResponse.json({ error: "no_action" }, { status: 400 });
  }

  const { error } = await supabase
    .from("app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
