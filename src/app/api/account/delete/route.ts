import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GDPR right of erasure — deletes the authenticated user from auth.users.
 * All other tables cascade via the user_id FK ON DELETE CASCADE clause
 * defined in 0001_init.sql, so a single delete tears down the entire
 * user's data.
 *
 * The user must be signed in and POST to this endpoint with a
 * confirmation field matching their email — defense in depth against
 * accidental or CSRF-driven calls.
 */
export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const confirm = String(body.confirm_email ?? "").trim().toLowerCase();
  if (!confirm || confirm !== (u.user.email ?? "").toLowerCase()) {
    return NextResponse.json({ error: "confirm_mismatch" }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl   = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supaUrl) {
    return NextResponse.json({ error: "supabase_misconfigured" }, { status: 500 });
  }

  const admin = createSupabaseClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.auth.admin.deleteUser(u.user.id);
  if (error) {
    console.error("[account.delete]", error);
    return NextResponse.json({ error: "delete_failed", detail: error.message }, { status: 500 });
  }

  // Sign the now-orphaned session out so the browser doesn't keep
  // showing the app while the cookies are still set.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
