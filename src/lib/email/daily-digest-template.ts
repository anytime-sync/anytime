/**
 * HTML email template for the daily digest. Editorial voice: brief,
 * confident, calm — reads like a one-paragraph briefing memo with a
 * scannable list of priorities below it.
 *
 * Same skeleton across all 5 languages; strings are passed in as a
 * pre-translated chrome object built from i18n.ts.
 */
import { format, type Locale } from "date-fns";
import { type LanguageCode } from "@/lib/i18n";

export type DigestTask = {
  id: string;
  title: string;
  due_at: string | null;
  priority: number | null;
};

export type DigestPayload = {
  recipientName: string;
  language: LanguageCode;
  locale: Locale;
  date: Date;
  topToday: DigestTask[];
  q1Today: DigestTask[];
  overdue: DigestTask[];
  habitsToday: number;
  streakDays: number;
  appUrl: string;
  unsubUrl: string;
  chrome: {
    kicker: string;
    headline: string;
    intro: string;
    sectionTopToday: string;
    sectionQ1: string;
    sectionOverdue: string;
    cta: string;
    footer: string;
    unsubLabel: string;
    streakSuffix: (n: number) => string;
    habitsSummary: (n: number) => string;
    noTasks: string;
  };
};

export function renderDigestHtml(p: DigestPayload): string {
  const dateLine = format(p.date, "EEEE, MMMM d", { locale: p.locale });

  const taskLi = (t: DigestTask) => {
    const due = t.due_at ? format(new Date(t.due_at), "h:mm a", { locale: p.locale }) : "";
    return `<li style="margin:0 0 8px 0;line-height:1.45;">
      <span style="color:#222;">${escapeHtml(t.title)}</span>
      ${due ? `<span style="color:#888;font-size:13px;margin-left:8px;">· ${due}</span>` : ""}
    </li>`;
  };

  const section = (title: string, tasks: DigestTask[], emptyHint?: string) => {
    if (tasks.length === 0 && !emptyHint) return "";
    return `
      <h3 style="font-family:Georgia,serif;font-size:11px;letter-spacing:0.18em;color:#777;text-transform:uppercase;margin:28px 0 10px;">
        ${escapeHtml(title)}
      </h3>
      ${tasks.length
        ? `<ul style="list-style:none;padding:0;margin:0;font-size:15px;">${tasks.map(taskLi).join("")}</ul>`
        : `<p style="color:#999;font-size:14px;font-style:italic;margin:0;">${escapeHtml(emptyHint!)}</p>`
      }
    `;
  };

  return `<!doctype html>
<html lang="${p.language}">
<body style="margin:0;padding:0;background:#f7f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#222;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f5f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #ebe7df;border-radius:8px;padding:32px 36px;text-align:left;">
        <tr><td>
          <p style="font-family:Georgia,serif;font-size:11px;letter-spacing:0.18em;color:#a67d3d;text-transform:uppercase;margin:0 0 6px;">${escapeHtml(p.chrome.kicker)}</p>
          <p style="color:#999;font-size:13px;margin:0 0 18px;">${escapeHtml(dateLine)}</p>
          <h1 style="font-family:Georgia,serif;font-size:26px;line-height:1.25;color:#222;margin:0 0 14px;font-weight:500;">${escapeHtml(p.chrome.headline)}</h1>
          <p style="font-size:15px;line-height:1.55;color:#333;margin:0 0 8px;">${escapeHtml(p.chrome.intro)}</p>
          <p style="font-size:13px;color:#888;margin:0 0 4px;">${escapeHtml(p.chrome.streakSuffix(p.streakDays))} · ${escapeHtml(p.chrome.habitsSummary(p.habitsToday))}</p>

          ${section(p.chrome.sectionQ1, p.q1Today, p.chrome.noTasks)}
          ${section(p.chrome.sectionTopToday, p.topToday)}
          ${section(p.chrome.sectionOverdue, p.overdue)}

          <table cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0;">
            <tr><td style="background:#a67d3d;border-radius:6px;">
              <a href="${p.appUrl}/app/today" style="display:inline-block;padding:12px 22px;color:#fff;text-decoration:none;font-size:14px;font-weight:500;">
                ${escapeHtml(p.chrome.cta)}
              </a>
            </td></tr>
          </table>

          <hr style="border:0;border-top:1px solid #ebe7df;margin:32px 0 16px;"/>
          <p style="color:#999;font-size:12px;line-height:1.5;margin:0;">
            ${escapeHtml(p.chrome.footer)}
            <br/>
            <a href="${p.unsubUrl}" style="color:#999;text-decoration:underline;">${escapeHtml(p.chrome.unsubLabel)}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function renderDigestText(p: DigestPayload): string {
  const lines: string[] = [];
  lines.push(p.chrome.kicker.toUpperCase());
  lines.push(format(p.date, "EEEE, MMMM d", { locale: p.locale }));
  lines.push("");
  lines.push(p.chrome.headline);
  lines.push("");
  lines.push(p.chrome.intro);
  lines.push(`${p.chrome.streakSuffix(p.streakDays)} · ${p.chrome.habitsSummary(p.habitsToday)}`);
  lines.push("");

  const section = (title: string, tasks: DigestTask[], emptyHint?: string) => {
    if (tasks.length === 0 && !emptyHint) return;
    lines.push("— " + title.toUpperCase() + " —");
    if (tasks.length === 0) lines.push("  (" + emptyHint + ")");
    else for (const t of tasks) {
      const due = t.due_at ? format(new Date(t.due_at), "h:mm a", { locale: p.locale }) : "";
      lines.push(`  • ${t.title}${due ? `  (${due})` : ""}`);
    }
    lines.push("");
  };
  section(p.chrome.sectionQ1, p.q1Today, p.chrome.noTasks);
  section(p.chrome.sectionTopToday, p.topToday);
  section(p.chrome.sectionOverdue, p.overdue);

  lines.push(`${p.chrome.cta}: ${p.appUrl}/app/today`);
  lines.push("");
  lines.push(p.chrome.footer);
  lines.push(`${p.chrome.unsubLabel}: ${p.unsubUrl}`);
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
