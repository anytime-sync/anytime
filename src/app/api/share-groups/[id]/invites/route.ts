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
 * POST /api/share-groups/[id]/invites
 * Body: { invitee_email: string }
 *
 * Owner-only. Creates an invite that goes straight to the invitee's
 * inbox at status `pending_acceptance` — no separate self-approval
 * step. (The earlier two-step flow caused duplicate UX and a
 * confusing "approve your own invite" prompt for the owner.)
 *
 * If the invitee already has an account we resolve their user id
 * via a service-role lookup against `profiles`. The user-scoped
 * client can't do that lookup because RLS on profiles hides rows
 * for users who aren't co-members yet — exactly the case we have
 * here. Without service role, invitee_user_id was being saved as
 * null and the invite never reached the invitee's inbox.
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

  // Service-role lookup so we can resolve the invitee's id even when
  // RLS would otherwise hide them.
  let inviteeUserId: string | null = null;
  try {
    const sb = service();
    const { data: prof } = await sb
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    inviteeUserId = prof?.id ?? null;
  } catch (e) {
    console.warn("[invites POST] profile lookup failed:", e);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("share_group_invites")
    .insert({
      group_id: groupId,
      inviter_id: user.id,
      invitee_email: email,
      invitee_user_id: inviteeUserId,
      status: "pending_acceptance",
      approved_by: user.id,
      approved_at: now,
    })
    .select("id, group_id, invitee_email, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Look up group name for the invitee notification body.
  const { data: groupRow } = await supabase
    .from("share_groups")
    .select("name")
    .eq("id", groupId)
    .maybeSingle();
  const groupName = groupRow?.name ?? "a group";

  // Notify the invitee directly (only possible if they're a
  // registered user — otherwise the email goes out via signup).
  if (inviteeUserId) {
    await supabase.from("app_notifications").insert({
      user_id: inviteeUserId,
      kind: "invite_received",
      title: "You have an invite to " + groupName,
      body: "Open Groups to accept or decline.",
      payload: { invite_id: data.id, group_id: groupId, invitee_email: email },
      action_url: "/app/groups",
    });
  }

  // Strip invitee_user_id so callers cannot use this endpoint as an
  // account-existence oracle (was returning whether the email is a
  // registered user). Owner still sees full data via GET.
  const { invitee_user_id: _ignored, ...safeRow } = (data ?? {}) as Record<string, unknown>;
  return NextResponse.json({ row: safeRow });
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
