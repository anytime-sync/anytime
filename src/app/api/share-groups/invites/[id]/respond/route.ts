import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/share-groups/invites/[id]/respond
 * Body: { action: "approve" | "decline" | "accept" | "revoke" }
 *
 * - `approve` (owner): pending_approval -> pending_acceptance
 * - `decline` (owner or invitee): -> declined
 * - `accept`  (invitee): pending_acceptance -> accepted; trigger
 *   `tg_share_invite_after_update` materialises the membership row.
 * - `revoke`  (owner): -> revoked
 *
 * RLS gates each path: invitees can see their own invites by
 * `invitee_user_id = auth.uid()` (or by `invitee_email = jwt.email`),
 * owners can see all invites for groups they own.
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
  const { id } = await params;

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const action = body.action ?? "";
  if (!["approve", "decline", "accept", "revoke"].includes(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  // Look up the invite first so we can route + validate.
  const { data: invite, error: lookupErr } = await supabase
    .from("share_group_invites")
    .select("id, group_id, inviter_id, invitee_user_id, status")
    .eq("id", id)
    .single();
  if (lookupErr || !invite) {
    return NextResponse.json(
      { error: lookupErr?.message ?? "invite_not_found" },
      { status: 404 }
    );
  }

  const patch: Record<string, unknown> = {};
  if (action === "approve") {
    if (invite.status !== "pending_approval") {
      return NextResponse.json({ error: "wrong_state" }, { status: 400 });
    }
    patch.status = "pending_acceptance";
    patch.approved_by = user.id;
    patch.approved_at = new Date().toISOString();
  } else if (action === "decline") {
    patch.status = "declined";
  } else if (action === "accept") {
    if (invite.status !== "pending_acceptance") {
      return NextResponse.json({ error: "wrong_state" }, { status: 400 });
    }
    if (invite.invitee_user_id && invite.invitee_user_id !== user.id) {
      return NextResponse.json({ error: "not_your_invite" }, { status: 403 });
    }
    patch.status = "accepted";
    // If the invite was created without invitee_user_id, set it now so
    // the trigger can materialize the membership.
    if (!invite.invitee_user_id) patch.invitee_user_id = user.id;
  } else if (action === "revoke") {
    patch.status = "revoked";
  }

  const { error: updateErr } = await supabase
    .from("share_group_invites")
    .update(patch)
    .eq("id", id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, action });
}
