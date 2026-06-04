import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/newsletter/[id]/send — send a saved draft.
 * Delegates to the main newsletter POST handler logic.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: broadcast, error } = await sc
    .from("broadcasts")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !broadcast)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (broadcast.status !== "draft")
    return NextResponse.json(
      { error: "already_sent", status: broadcast.status },
      { status: 400 }
    );

  // Import and reuse the send logic from the parent route
  // For now, update status and redirect to the main send flow
  const mainRoute = new URL("/api/admin/newsletter", process.env.NEXT_PUBLIC_APP_URL ?? "https://firstlight.to");
  const res = await fetch(mainRoute, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: _req.headers.get("cookie") ?? "",
    },
    body: JSON.stringify({
      subject: broadcast.subject,
      body: broadcast.body_text,
      audience: broadcast.audience,
      action: "send",
    }),
  });

  // Delete the draft since we created a new sent record
  if (res.ok) {
    await sc.from("broadcasts").delete().eq("id", params.id);
  }

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
