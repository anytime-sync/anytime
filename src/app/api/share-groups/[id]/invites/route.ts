import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/share-groups/[id]/invites
 * Body: { invitee_email: string }
 *
 * Owner-only. Creates an invite that the originator can later approve
 * (status starts as `pending_approval`). After owner approval the
 * invite moves to `pending_acceptance` so the invitee can accept.
 *
 * The invitee may already be a registered user — we look them up by
 * email and store their id in `invitee_user_id` so the invite shows
 * up in their inbox immediately. If they're not registered, just the
 * email is stored and resolves on signup.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: groupId } = await params;

  let body: { invitee_email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const email = (body.invitee_email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // Resolve invitee_user_id when possible (no service role here, so we
  // query the profiles view instead — emails are stored in profiles
  // for already-registered users).
  const { data: prof } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  const { data, error } = await supabase
    .from("share_group_invites")
    .insert({
      group_id: groupId,
      inviter_id: user.id,
      invitee_email: email,
      invitee_user_id: prof?.id ?? null,
      status: "pending_approval",
    })
    .select("id, group_id, invitee_email, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Notify the inviter that their invite is queued and needs their
  // approval before it goes out. (Owner-approval workflow: the same
  // person creating the invite has to approve it.)
  await supabase.from("app_notifications").insert({
    user_id: user.id,
    kind: "invite_pending_your_approval",
    title: "Approve your invite",
    body: \`You created an invite for \${email}. Open Groups to approve it.\`,
    payload: { invite_id: data.id, group_id: groupId, invitee_email: email },
    action_url: "/app/groups",
  });

  return NextResponse.json({ row: data });
}

/**
 * GET /api/share-groups/[id]/invites
 *
 * List the invites for this group (owner-only via RLS).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: groupId } = await params;

  const { data, error } = await supabase
    .from("share_group_invites")
    .select(
      "id, group_id, invitee_email, invitee_user_id, status, approved_at, created_at"
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ rows: data });
}
