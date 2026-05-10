import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/share-groups/invites/[id]/respond
 * Body: { action: "decline" | "accept" | "revoke" | "approve" }
 *
 * - `accept`  (invitee): pending_acceptance -> accepted; trigger
 *   `tg_share_invite_after_update` materializes the membership row.
 * - `decline` (invitee or inviter): -> declined
 * - `revoke`  (owner or inviter): -> revoked
 * - `approve` (owner or inviter, legacy only): pending_approval ->
 *   pending_acceptance. Kept so any pre-existing rows still work,
 *   but new invites skip this step.
 *
 * We compute caller role explicitly and 403 on a wrong-perspective
 * call so failures are visible instead of silently no-op-ing
 * (RLS would allow the UPDATE statement to run with zero rows
 * affected, which the prior version reported as success).
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

  const callerIsInviter = invite.inviter_id === user.id;
  const callerIsInvitee = invite.invitee_user_id === user.id;

  // Owner-of-group lookup, only for actions that need it.
  let callerIsOwner = false;
  if (action === "approve" || action === "revoke") {
    const { data: m } = await supabase
      .from("share_group_members")
      .select("role")
      .eq("group_id", invite.group_id)
      .eq("user_id", user.id)
      .maybeSingle();
    callerIsOwner = m?.role === "owner";
  }

  const patch: Record<string, unknown> = {};
  if (action === "approve") {
    if (!(callerIsOwner || callerIsInviter)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (invite.status !== "pending_approval") {
      return NextResponse.json({ error: "wrong_state" }, { status: 400 });
    }
    patch.status = "pending_acceptance";
    patch.approved_by = user.id;
    patch.approved_at = new Date().toISOString();
  } else if (action === "decline") {
    if (!(callerIsInvitee || callerIsInviter)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    patch.status = "declined";
  } else if (action === "accept") {
    if (!callerIsInvitee) {
      return NextResponse.json({ error: "not_your_invite" }, { status: 403 });
    }
    if (invite.status !== "pending_acceptance") {
      return NextResponse.json({ error: "wrong_state" }, { status: 400 });
    }
    patch.status = "accepted";
  } else if (action === "revoke") {
    if (!(callerIsOwner || callerIsInviter)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    patch.status = "revoked";
  }

  // Update with .select() so we can detect zero-row changes (e.g.
  // RLS unexpectedly blocking) and report them instead of returning
  // a misleading success.
  const { data: updated, error: updateErr } = await supabase
    .from("share_group_invites")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }
  if (!updated) {
    return NextResponse.json({ error: "no_row_updated" }, { status: 403 });
  }

  // Look up the group name once for the notification body.
  const { data: groupRow } = await supabase
    .from("share_groups")
    .select("name")
    .eq("id", invite.group_id)
    .maybeSingle();
  const groupName = groupRow?.name ?? "the group";

  const notifs: Array<Record<string, unknown>> = [];
  if (action === "approve" && invite.invitee_user_id) {
    notifs.push({
      user_id: invite.invitee_user_id,
      kind: "invite_received",
      title: "You have an invite to " + groupName,
      body: "Open Groups to accept or decline.",
      payload: { invite_id: invite.id, group_id: invite.group_id },
      action_url: "/app/groups",
    });
  } else if (action === "accept") {
    notifs.push({
      user_id: invite.inviter_id,
      kind: "invite_accepted",
      title: "Joined " + groupName,
      body: "Your invitee accepted and is now a member.",
      payload: {
        invite_id: invite.id,
        group_id: invite.group_id,
        member_id: user.id,
      },
      action_url: "/app/groups",
    });
  } else if (action === "decline" && invite.inviter_id !== user.id) {
    notifs.push({
      user_id: invite.inviter_id,
      kind: "invite_declined",
      title: "Invite declined",
      body: "Your invitee declined to join " + groupName + ".",
      payload: { invite_id: invite.id, group_id: invite.group_id },
      action_url: "/app/groups",
    });
  } else if (action === "revoke" && invite.invitee_user_id) {
    notifs.push({
      user_id: invite.invitee_user_id,
      kind: "invite_revoked",
      title: "Invite revoked",
      body: "The owner of " + groupName + " revoked your invite.",
      payload: { invite_id: invite.id, group_id: invite.group_id },
      action_url: "/app/groups",
    });
  }
  if (notifs.length) {
    await supabase.from("app_notifications").insert(notifs);
  }

  return NextResponse.json({ ok: true, action });
}
