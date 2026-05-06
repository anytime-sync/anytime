import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/share-groups/[id]/members/[uid]
 * Body: { role: 'owner' | 'member' }
 *
 * Owner-only. Promotes a member to owner, or demotes another owner
 * back to member. RLS "owners manage membership" allows the update.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; uid: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const role = (body.role ?? "").trim();
  if (role !== "owner" && role !== "member") {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  const { error } = await supabase
    .from("share_group_members")
    .update({ role })
    .eq("group_id", params.id)
    .eq("user_id", params.uid);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/share-groups/[id]/members/[uid]
 *
 * Owner can remove anyone (including themselves if another owner exists).
 * A member can remove themselves (leave the group).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; uid: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { error } = await supabase
    .from("share_group_members")
    .delete()
    .eq("group_id", params.id)
    .eq("user_id", params.uid);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
