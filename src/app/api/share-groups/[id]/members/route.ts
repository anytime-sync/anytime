import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/share-groups/[id]/members
 *
 * Returns the members of a share group, joined to their profile so the
 * caller can render names + avatars (used by the assignee picker on
 * shared tasks).
 *
 * RLS: the "members read membership" policy already restricts visibility
 * to people in the same group.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("share_group_members")
    .select(
      "user_id, role, joined_at, profile:user_id ( id, full_name, email )"
    )
    .eq("group_id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ rows: data ?? [] });
}
