import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAlias } from "@/lib/inbox-alias";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/inbox-alias — read or rotate the current user's private
 * inbound-email alias. The address itself is rendered client-side as
 * `${alias_local}@firstlight.to`; this route only owns the local-part.
 *
 *   GET  → returns `{ row }` with the user's existing row, or
 *          `{ row: null }` if they haven't generated one yet.
 *   POST → upserts the row with a fresh alias_local. On rotation we
 *          reset `total_received` to 0 and `last_received_at` to null
 *          so the UI's "Last received: …" copy doesn't leak the
 *          previous address's history.
 *
 * RLS gates rows by `user_id = auth.uid()`, so service-role isn't
 * needed — the user can only read/write their own row.
 */

type AliasRow = {
  user_id: string;
  alias_local: string;
  default_list_id: string | null;
  created_at: string;
  last_received_at: string | null;
  total_received: number;
};

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_inbox_aliases")
    .select(
      "user_id, alias_local, default_list_id, created_at, last_received_at, total_received"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ row: (data as AliasRow | null) ?? null });
}

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Try a few times — alias_local has a UNIQUE constraint and a fresh
  // collision is astronomically unlikely, but a finite retry keeps us
  // honest (and survives a clock-skewed test that pre-seeds rows).
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const alias_local = generateAlias();
    const { data, error } = await supabase
      .from("user_inbox_aliases")
      .upsert(
        {
          user_id: user.id,
          alias_local,
          // Reset counters on rotation so the UI doesn't show stale
          // history from the previous address.
          last_received_at: null,
          total_received: 0,
        },
        { onConflict: "user_id" }
      )
      .select(
        "user_id, alias_local, default_list_id, created_at, last_received_at, total_received"
      )
      .single();

    if (!error && data) {
      return NextResponse.json({ row: data as AliasRow });
    }
    lastErr = error?.message ?? "upsert_failed";
    // 23505 = unique_violation; only retry that case
    if (!/duplicate|unique/i.test(lastErr)) break;
  }
  return NextResponse.json(
    { error: lastErr ?? "rotate_failed" },
    { status: 400 }
  );
}
