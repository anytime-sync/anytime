import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/share-groups/invites/mine
 *
 * Returns invites the current user can act on:
 *   - status = pending_acceptance, invitee_user_id = me  (to accept/decline)
 *   - status = pending_approval, inviter_id = me        (waiting for owner approval — created by me)
 *   - status = pending_approval where I'm group owner   (to approve/decline as owner)
 *
 * Joined with the group name so the inbox can render rich rows.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // RLS already restricts visibility, so a wide select returns just
  // the rows the user can act on.
  const { data, error } = await supabase
    .from("share_group_invites")
    .select(
      "id, group_id, inviter_id, invitee_email, invitee_user_id, status, created_at, group:share_groups!group_id ( id, name )"
    )
    .in("status", ["pending_approval", "pending_acceptance"])
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ rows: data });
}
