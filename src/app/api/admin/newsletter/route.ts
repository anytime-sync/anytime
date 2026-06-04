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
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://firstlight.to";

/**
 * GET /api/admin/newsletter — list all broadcasts.
 */
export async function GET() {
  const supabase = await createClient();
  if (!(await requireAdmin(supabase)))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sc = getServiceClient();
  const { data, error } = await sc
    .from("broadcasts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/**
 * POST /api/admin/newsletter
 * Body: { subject, body, audience, action: "draft" | "send" }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { subject, body, audience, action } = await req.json();
  if (!subject?.trim())
    return NextResponse.json({ error: "subject_required" }, { status: 400 });

  const sc = getServiceClient();

  const { data: broadcast, error: insertErr } = await sc
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

  if (insertErr || !broadcast)
    return NextResponse.json(
      { error: insertErr?.message ?? "insert_failed" },
      { status: 500 }
    );

  if (action === "send") {
    const result = await sendBroadcast(sc, broadcast);
    return NextResponse.json(result);
  }

  return NextResponse.json(broadcast);
}

// ─── Send logic ─────────────────────────────────────────────────────

async function sendBroadcast(sc: any, broadcast: any) {
  const resend = getResend();
  if (!resend) {
    await sc.from("broadcasts").update({ status: "failed" }).eq("id", broadcast.id);
    return { error: "RESEND_API_KEY not configured", sent_count: 0 };
  }

  // 1. Get users who have NOT opted out of broadcasts
  //    Join profiles + user_preferences to check email_broadcasts flag
  const { data: profiles } = await sc
    .from("profiles")
    .select("id, email")
    .not("email", "is", null);

  if (!profiles || profiles.length === 0) {
    await sc
      .from("broadcasts")
      .update({ status: "sent", sent_count: 0, sent_at: new Date().toISOString() })
      .eq("id", broadcast.id);
    return { sent_count: 0 };
  }

  // Get users who opted out
  const { data: optedOut } = await sc
    .from("user_preferences")
    .select("user_id")
    .eq("email_broadcasts", false);

  const optedOutIds = new Set((optedOut ?? []).map((r: any) => r.user_id));

  // Filter by audience (plan) if not "all"
  let eligibleIds = new Set(profiles.map((p: any) => p.id));

  if (broadcast.audience !== "all") {
    const { data: planUsers } = await sc.from("user_plans").select("user_id, plan");
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
    eligibleIds = new Set(targetIds);
  }

  // Final recipient list: eligible AND not opted out
  const recipients = profiles.filter(
    (p: any) => eligibleIds.has(p.id) && !optedOutIds.has(p.id)
  );

  if (recipients.length === 0) {
    await sc
      .from("broadcasts")
      .update({ status: "sent", sent_count: 0, sent_at: new Date().toISOString() })
      .eq("id", broadcast.id);
    return { sent_count: 0 };
  }

  // 2. Send via Resend batch
  let sentCount = 0;
  const fromAddr = getFromAddress();
  const batchSize = 100;

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const emails = batch.map((u: any) => {
      const unsubToken = makeUnsubToken(u.id);
      const unsubUrl = `${APP_URL}/unsubscribe?token=${unsubToken}&type=broadcasts`;
      const settingsUrl = `${APP_URL}/app/settings#settings-notifications`;

      return {
        from: fromAddr,
        to: u.email,
        subject: broadcast.subject,
        html: wrapInTemplate(broadcast.body_html, unsubUrl, settingsUrl),
        text: broadcast.body_text + broadcastTextFooter(unsubUrl, settingsUrl),
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    try {
      await resend.batch.send(emails);
      sentCount += batch.length;
    } catch (err) {
      console.error("[newsletter] batch send failed", err);
    }
  }

  await sc
    .from("broadcasts")
    .update({
      status: sentCount > 0 ? "sent" : "failed",
      sent_count: sentCount,
      sent_at: new Date().toISOString(),
    })
    .eq("id", broadcast.id);

  return { sent_count: sentCount, id: broadcast.id };
}

// ─── Email template ─────────────────────────────────────────────────

function wrapInTemplate(bodyHtml: string, unsubUrl: string, settingsUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fafaf8;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:580px;margin:0 auto;padding:40px 24px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#b8860b;margin:0;">
        First Light · Update
      </p>
    </div>

    <!-- Body -->
    <div style="font-size:16px;line-height:1.7;color:#1a1a19;">
      ${bodyHtml}
    </div>

    <!-- Footer -->
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #e8e6e1;text-align:center;">
      <p style="font-size:12px;color:#999;line-height:1.6;margin:0 0 8px;">
        You’re receiving this because you have a First Light account.
      </p>
      <p style="font-size:12px;color:#999;line-height:1.6;margin:0 0 8px;">
        <a href="${settingsUrl}" style="color:#b8860b;text-decoration:underline;">Manage email preferences</a>
        &nbsp;&middot;&nbsp;
        <a href="${unsubUrl}" style="color:#999;text-decoration:underline;">Unsubscribe from updates</a>
      </p>
      <p style="font-size:11px;color:#ccc;margin:16px 0 0;">
        &copy; ${new Date().getFullYear()} First Light &middot; firstlight.to
      </p>
    </div>
  </div>
</body>
</html>`;
}

function broadcastTextFooter(unsubUrl: string, settingsUrl: string): string {
  return `\n\n---\nYou're receiving this because you have a First Light account.\nManage preferences: ${settingsUrl}\nUnsubscribe from updates: ${unsubUrl}\n\n© ${new Date().getFullYear()} First Light · firstlight.to`;
}

// ─── Markdown → HTML ────────────────────────────────────────────────

function markdownToHtml(md: string): string {
  return md
    .split("\n\n")
    .map(
      (p) =>
        `<p style="margin:0 0 16px;line-height:1.7;font-family:Georgia,serif;">${p
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>")
          .replace(
            /\[(.+?)\]\((.+?)\)/g,
            '<a href="$2" style="color:#b8860b;text-decoration:underline;">$1</a>'
          )
          .replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}
