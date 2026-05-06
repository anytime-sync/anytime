import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/share-groups
 *
 * Lists every group the caller is a member of (owner or member). The
 * select pulls the joined profile for each owner so the UI can show
 * who runs each group without a second round-trip.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // RLS on share_group_members + share_groups already restricts visibility
  // to rows the caller participates in.
  const { data, error } = await supabase
    .from("share_group_members")
    .select(
      "role, joined_at, group:share_groups!group_id ( id, name, description, created_by, created_at )"
    )
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ rows: data });
}

/**
 * POST /api/share-groups
 * Body: { name: string; description?: string }
 *
 * Create a new group. The trigger `tg_share_group_after_insert`
 * automatically inserts the caller as owner in `share_group_members`,
 * so we don't need to do it from here.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { name?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "missing_name" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("share_groups")
    .insert({
      name,
      description: (body.description ?? "").trim() || null,
      created_by: user.id,
    })
    .select("id, name, description, created_by, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ row: data });
}
