import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/admin";
import { getResend, getFromAddress } from "@/lib/resend";
import { makeUnsubToken } from "@/lib/unsub-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return null;
  }
  return user;
}

/**
 * GET /api/admin/newsletter
 * List all broadcasts (drafts + sent).
 */
export async function GET() {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await serviceClient
    .from("broadcasts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

/**
 * POST /api/admin/newsletter
 * Create a draft or immediately send a broadcast.
 * Body: { subject, body, audience, action: "draft" | "send" }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { subject, body, audience, action } = await req.json();
  if (!subject?.trim()) {
    return NextResponse.json({ error: "subject_required" }, { status: 400 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Save as draft first
  const { data: broadcast, error: insertErr } = await serviceClient
    .from("broadcasts")
    .insert({
      subject: subject.trim(),
      body_text: body ?? "",
      body_html: markdownToHtml(body ?? ""),
      audience: audience ?? "all",
      status: "draft",
      created_by: user.id,
    })
    .select()
    .single();

  if (insertErr || !broadcast) {
    return NextResponse.json(
      { error: insertErr?.message ?? "insert_failed" },
      { status: 500 }
    );
  }

  if (action === "send") {
    const result = await sendBroadcast(serviceClient, broadcast);
    return NextResponse.json(result);
  }

  return NextResponse.json(broadcast);
}

/**
 * Send a broadcast to matching users via Resend.
 */
async function sendBroadcast(serviceClient: any, broadcast: any) {
  const resend = getResend();
  if (!resend) {
    await serviceClient
      .from("broadcasts")
      .update({ status: "failed" })
      .eq("id", broadcast.id);
    return { error: "RESEND_API_KEY not configured", sent_count: 0 };
  }

  // Get target users based on audience
  let query = serviceClient
    .from("profiles")
    .select("id, email")
    .not("email", "is", null);

  if (broadcast.audience !== "all") {
    // Join with user_plans view to filter by plan
    const { data: planUsers } = await serviceClient
      .from("user_plans")
      .select("user_id, plan");

    const targetIds = (planUsers ?? [])
      .filter((pu: any) => {
        if (broadcast.audience === "free") return pu.plan === "free";
        if (broadcast.audience === "plus")
          return pu.plan === "plus" || pu.plan === "pro" || pu.plan === "vip";
        if (broadcast.audience === "pro")
          return pu.plan === "pro" || pu.plan === "vip";
        return true;
      })
      .map((pu: any) => pu.user_id);

    query = query.in("id", targetIds);
  }

  const { data: users } = await query;
  if (!users || users.length === 0) {
    await serviceClient
      .from("broadcasts")
      .update({ status: "sent", sent_count: 0, sent_at: new Date().toISOString() })
      .eq("id", broadcast.id);
    return { sent_count: 0 };
  }

  // Send via Resend batch (max 100 per call)
  let sentCount = 0;
  const fromAddr = getFromAddress();
  const batchSize = 100;

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    const emails = batch.map((u: any) => ({
      from: fromAddr,
      to: u.email,
      subject: broadcast.subject,
      html: broadcast.body_html + unsubFooter(u.id),
      text: broadcast.body_text + `\n\nUnsubscribe: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://firstlight.to"}/unsubscribe?token=${makeUnsubToken(u.id)}`,
      headers: {
        "List-Unsubscribe": `<${process.env.NEXT_PUBLIC_APP_URL ?? "https://firstlight.to"}/api/unsubscribe?token=${makeUnsubToken(u.id)}>`,
      },
    }));

    try {
      await resend.batch.send(emails);
      sentCount += batch.length;
    } catch (err) {
      console.error("[newsletter] batch send failed", err);
    }
  }

  await serviceClient
    .from("broadcasts")
    .update({
      status: sentCount > 0 ? "sent" : "failed",
      sent_count: sentCount,
      sent_at: new Date().toISOString(),
    })
    .eq("id", broadcast.id);

  return { sent_count: sentCount, id: broadcast.id };
}

function unsubFooter(userId: string): string {
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://firstlight.to"}/unsubscribe?token=${makeUnsubToken(userId)}`;
  return `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;text-align:center;font-size:12px;color:#999;"><a href="${url}" style="color:#999;">Unsubscribe</a></div>`;
}

/**
 * Very basic markdown→HTML (bold, italic, links, paragraphs).
 * For a real product, use a proper markdown lib.
 */
function markdownToHtml(md: string): string {
  return md
    .split("\n\n")
    .map((p) =>
      `<p style="margin:0 0 16px;line-height:1.6;font-family:Georgia,serif;">${p
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(
          /\[(.+?)\]\((.+?)\)/g,
          '<a href="$2" style="color:#b8860b;">$1</a>'
        )
        .replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}
