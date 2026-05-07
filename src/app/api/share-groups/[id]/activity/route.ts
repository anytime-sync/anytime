import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/share-groups/[id]/activity
 *
 * Returns the most recent group_activity rows for a group, newest
 * first, capped at 100. Joined to the actor's profile so the UI can
 * render avatar + name without a second round trip.
 *
 * RLS: only group members can read group_activity.
 *
 * Task title is *not* joined here on purpose — the trigger that
 * populates group_activity stuffs the title into payload.title at
 * write time, which is what we want for `task_deleted` (the row no
 * longer exists) and is more efficient for the common case. The
 * client falls back to payload.title.
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
    .from("group_activity")
    .select(
      "id, group_id, actor_id, kind, payload, task_id, created_at, actor:profiles!actor_id ( id, full_name, email, avatar_url )"
    )
    .eq("group_id", params.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ rows: data ?? [] });
}
