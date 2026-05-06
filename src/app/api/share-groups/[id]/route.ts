import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/share-groups/[id]
 * Body: { name?: string; description?: string | null }
 *
 * Owner-only. Renames or updates the description of a share group.
 * RLS already gates this to owners via "owners update groups".
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { name?: string; description?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "name_empty" }, { status: 400 });
    }
    patch.name = trimmed;
  }
  if (body.description !== undefined) {
    const d =
      typeof body.description === "string" ? body.description.trim() : null;
    patch.description = d || null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("share_groups")
    .update(patch)
    .eq("id", params.id)
    .select("id, name, description, created_by, created_at")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ row: data });
}

/**
 * DELETE /api/share-groups/[id]
 * Owner-only. Removes the group; cascade in DB cleans up members,
 * invites, notifications. Tasks shared into this group keep their
 * data but lose the share_group_id link.
 */
export async function DELETE(
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
  const { error } = await supabase
    .from("share_groups")
    .delete()
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
