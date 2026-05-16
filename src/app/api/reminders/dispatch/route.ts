import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getResend, getFromAddress } from "@/lib/resend";
import { format } from "date-fns";
import { getLanguage, t, type LanguageCode } from "@/lib/i18n";
import { makeUnsubToken } from "@/lib/unsub-token";
import webpush from "web-push";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reminder dispatcher.
 *
 * Pinged by Vercel Cron (or any external scheduler such as cron-job.org).
 * Vercel Cron sends GET with `Authorization: Bearer ${CRON_SECRET}`. We
 * also accept that header on POST so a manual curl works for testing.
 *
 * Logic:
 *   - Find tasks where reminder_at <= now AND reminder_sent_at IS NULL
 *     AND is_completed = false (limit 100 per tick).
 *   - Resolve each user's email + language + email_reminders flag.
 *   - Send Resend email; mark reminder_sent_at on success or skip.
 *   - Failed sends are NOT marked, so the next tick retries.
 *
 * Setup:
 *   - RESEND_API_KEY  — required, Resend API key
 *   - RESEND_FROM_ADDRESS — optional, "Your Name <addr@your-domain>"
 *   - CRON_SECRET     — required, any random string; matches Vercel Cron auth
 *   - SUPABASE_SERVICE_ROLE_KEY — required for cross-user reads
 *   - APP_URL         — optional, used in email CTA (defaults to vercel URL)
 */
export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }

async function handle(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!isAuthorizedCron(auth)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json({ error: "resend_disabled" }, { status: 503 });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl   = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supaUrl) {
    return NextResponse.json({ error: "supabase_misconfigured" }, { status: 500 });
  }

  const supabase = createSupabaseClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("tasks")
    .select("id, user_id, title, due_at, reminder_at, project_id")
    .lte("reminder_at", nowIso)
    .is("reminder_sent_at", null)
    .eq("is_completed", false)
    .limit(100);
  if (error) {
    console.error("[reminders] fetch error", error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ sent: 0, attempted: 0 });
  }

  const userIds = [...new Set(due.map((t) => t.user_id))];

  // Resolve emails via the auth admin API.
  const emailByUser = new Map<string, string>();
  for (const uid of userIds) {
    try {
      const { data: u } = await supabase.auth.admin.getUserById(uid);
      if (u.user?.email) emailByUser.set(uid, u.user.email);
    } catch (e) {
      console.error("[reminders] getUserById failed", uid, e);
    }
  }

  // Resolve preferences (language + email_reminders).
  const { data: prefRows } = await supabase
    .from("user_preferences")
    .select("user_id, email_reminders, language")
    .in("user_id", userIds);
  const prefByUser = new Map<string, { language: string; email_reminders: boolean }>();
  for (const r of prefRows ?? []) {
    prefByUser.set(r.user_id, {
      language: r.language ?? "en",
      email_reminders: r.email_reminders ?? true,
    });
  }

  const from = getFromAddress();
  const appUrl = process.env.APP_URL ?? "https://firstlight.to";

  let sent = 0;
  const handledIds: string[] = [];

  for (const task of due) {
    const email = emailByUser.get(task.user_id);
    const pref = prefByUser.get(task.user_id);
    const lang = (pref?.language ?? "en") as LanguageCode;

    // Honor opt-out: still mark as handled so we don't re-check forever.
    if (!email || pref?.email_reminders === false) {
      handledIds.push(task.id);
      continue;
    }

    try {
      const subject = t(lang, "email.subject").replace("{title}", task.title);
      await resend.emails.send({
        from,
        to: email,
        subject,
        html: emailHtml({
          title: task.title,
          dueAt: task.due_at,
          lang,
          appUrl,
          unsubUrl: `${appUrl}/api/reminders/unsubscribe?t=${makeUnsubToken(task.user_id)}`,
        }),
        // Real one-click unsubscribe header — Gmail/Outlook honor this
        // for the inbox-level unsubscribe button.
        headers: {
          "List-Unsubscribe": `<${appUrl}/api/reminders/unsubscribe?t=${makeUnsubToken(task.user_id)}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      sent++;
      handledIds.push(task.id);
    } catch (e) {
      // Don't mark as sent — the next tick will retry.
      console.error("[reminders] send failed", task.id, e);
    }
  }

  // Web push (in parallel to email). Same throttle: only send per task once.
  // We already track 'handled' via reminder_sent_at, so push and email
  // share that single flag — a reminder fires both channels in one tick.
  const vapidPub = process.env.VAPID_PUBLIC_KEY;
  const vapidPriv = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_CONTACT_EMAIL ?? "mailto:no-reply@firstlight.app";
  if (vapidPub && vapidPriv) {
    webpush.setVapidDetails(vapidEmail, vapidPub, vapidPriv);
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("user_id,endpoint,p256dh,auth")
      .in("user_id", userIds);
    const subsByUser = new Map<string, Array<{ endpoint: string; p256dh: string; auth: string }>>();
    for (const s of subs ?? []) {
      const arr = subsByUser.get(s.user_id) ?? [];
      arr.push(s);
      subsByUser.set(s.user_id, arr);
    }
    // pushTasks: only those we just emailed (or tried to) AND whose owner has push enabled.
    for (const task of due) {
      const pref = prefByUser.get(task.user_id);
      if (pref?.email_reminders === false && !(pref as any)?.push_reminders) continue;
      // honor push_reminders flag if present (defaults to true server-side)
      const pushFlag = (pref as any)?.push_reminders;
      if (pushFlag === false) continue;
      const list = subsByUser.get(task.user_id) ?? [];
      for (const s of list) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({
              title: task.title,
              body: "First Light · Reminder",
              tag: `task-${task.id}`,
              url: `${appUrl}/app/today`,
            })
          );
        } catch (e: any) {
          // 410 / 404 = endpoint gone, prune it.
          const code = e?.statusCode;
          if (code === 410 || code === 404) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", s.endpoint);
          } else {
            console.error("[push send]", code, e?.message ?? e);
          }
        }
      }
    }
  }

  if (handledIds.length) {
    await supabase
      .from("tasks")
      .update({ reminder_sent_at: nowIso })
      .in("id", handledIds);
  }

  return NextResponse.json({ sent, attempted: due.length });
}

/* ------------- Email template ------------- */

function emailHtml({
  title,
  dueAt,
  lang,
  appUrl,
  unsubUrl,
}: {
  title: string;
  dueAt: string | null;
  lang: LanguageCode;
  appUrl: string;
  unsubUrl: string;
}): string {
  const locale = getLanguage(lang).dateFnsLocale;
  const dueStr = dueAt
    ? format(new Date(dueAt), "EEEE, MMMM d · HH:mm", { locale })
    : "";

  // Brand-aligned: cream bg, serif headline, warm gold accent.
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(t(lang, "email.kicker"))}</title>
  </head>
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FAF7F2;padding:48px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border-radius:8px;border:1px solid #ECE6D8;max-width:560px;">
            <tr>
              <td style="padding:32px 32px 8px;">
                <p style="margin:0 0 16px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#777;">${escapeHtml(t(lang, "email.kicker"))}</p>
                <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;line-height:1.3;color:#111;">${escapeHtml(title)}</h1>
                ${dueStr ? `<p style="margin:0 0 24px;font-size:14px;color:#666;"><span style="color:#999;">${escapeHtml(t(lang, "email.dueLabel"))} · </span>${escapeHtml(dueStr)}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <a href="${appUrl}/app/today" style="display:inline-block;padding:10px 20px;background:#C89B5A;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">${escapeHtml(t(lang, "email.openCta"))}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;border-top:1px solid #ECE6D8;">
                <p style="margin:0 0 8px;font-size:11px;color:#999;line-height:1.5;">${escapeHtml(t(lang, "email.footer"))}</p>
                <p style="margin:0;font-size:11px;color:#999;line-height:1.5;">
                  <a href="${unsubUrl}" style="color:#999;text-decoration:underline;">${escapeHtml(t(lang, "email.unsubscribe"))}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
