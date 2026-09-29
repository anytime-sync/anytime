import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData();
  const authorizationId = String(formData.get("authorization_id") ?? "");
  const decision = String(formData.get("decision") ?? "");

  if (!authorizationId) {
    return NextResponse.json({ error: "Missing authorization_id" }, { status: 400 });
  }

  const supabase = createClient();

  if (decision === "approve") {
    const { data, error } =
      await supabase.auth.oauth.approveAuthorization(authorizationId);
    if (error || !data?.redirect_url) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to approve authorization" },
        { status: 400 }
      );
    }
    return NextResponse.redirect(data.redirect_url, 303);
  }

  const { data, error } =
    await supabase.auth.oauth.denyAuthorization(authorizationId);
  if (error || !data?.redirect_url) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to deny authorization" },
      { status: 400 }
    );
  }
  return NextResponse.redirect(data.redirect_url, 303);
}
