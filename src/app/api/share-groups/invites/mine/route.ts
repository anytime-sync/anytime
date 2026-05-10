import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("supabase_misconfigured");
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * GET /api/share-groups/invites/mine
 *
 * Returns invites where the current user is the invitee and the
 * invite is awaiting their acceptance. Group name is hydrated via
 * the service role because RLS on share_groups otherwise hides the
 * group from a non-member invitee, which would show up as
 * "(unknown group)".
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: rawRows, error } = await supabase
    .from("share_group_invites")
    .select(
      "id, group_id, inviter_id, invitee_email, invitee_user_id, status, created_at"
    )
    .eq("invitee_user_id", user.id)
    .eq("status", "pending_acceptance")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows = rawRows ?? [];

  // Hydrate group names with service role — invitees aren't members
  // yet so a regular-RLS join returns null and the UI falls back to
  // "(unknown group)".
  const groupIds = Array.from(new Set(rows.map((r) => r.group_id)));
  let groupMap: Record<string, { id: string; name: string }> = {};
  if (groupIds.length) {
    try {
      const sb = service();
      const { data: groups } = await sb
        .from("share_groups")
        .select("id, name")
        .in("id", groupIds);
      groupMap = Object.fromEntries(
        (groups ?? []).map((g) => [g.id, { id: g.id, name: g.name }])
      );
    } catch (e) {
      console.warn("[invites/mine] group name hydration failed:", e);
    }
  }

  const enriched = rows.map((r) => ({
    ...r,
    group: groupMap[r.group_id] ?? null,
    viewer_role: "invitee" as const,
  }));

  return NextResponse.json({ rows: enriched });
}
