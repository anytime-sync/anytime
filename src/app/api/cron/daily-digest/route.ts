import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getResend, getFromAddress } from "@/lib/resend";
import { getLanguage, type LanguageCode } from "@/lib/i18n";
import { makeUnsubToken } from "@/lib/unsub-token";
import {
  renderDigestHtml,
  renderDigestText,
  type DigestTask,
} from "@/lib/email/daily-digest-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily Digest cron — runs every hour. For each opted-in user, if
 * their LOCAL time right now matches their `digest_send_hour`
 * preference (default 7am) AND we haven't already sent today's
 * digest, builds + sends the email.
 *
 * Per-user-per-day idempotency via `daily_digest_log (user_id,
 * sent_for_date PK)` — even if Vercel Cron retries, no duplicates.
 *
 * Auth: Bearer ${CRON_SECRET}, same shape as /api/reminders/dispatch.
 */
export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }

async function handle(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const resend = getResend();
  if (!resend) return NextResponse.json({ error: "resend_disabled" }, { status: 503 });
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supaUrl) {
    return NextResponse.json({ error: "supabase_misconfigured" }, { status: 500 });
  }
  const supabase = createSupabaseClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const appUrl = process.env.APP_URL ?? "https://firstlight.to";
  const nowUtc = new Date();

  // Pull every user opted in to digest. Hourly cron + per-row local-hour
  // check filters down to ~1/24 of users per tick — a Pro plan can
  // comfortably handle thousands. For now, server-side filter on the
  // rough column then JS-side filter on local hour.
  const { data: prefs, error: prefsErr } = await supabase
    .from("user_preferences")
    .select("user_id, language, timezone, digest_send_hour, email_daily_digest")
    .eq("email_daily_digest", true);
  if (prefsErr) {
    return NextResponse.json({ error: prefsErr.message }, { status: 500 });
  }

  const sent: Array<{ user_id: string; status: string; detail?: string }> = [];
  for (const pref of prefs ?? []) {
    const tz = pref.timezone || "UTC";
    const localHour = currentHourInTz(nowUtc, tz);
    if (localHour !== (pref.digest_send_hour ?? 7)) continue;

    const localDate = currentDateInTz(nowUtc, tz);

    // Already sent today?
    const { data: existing } = await supabase
      .from("daily_digest_log")
      .select("user_id")
      .eq("user_id", pref.user_id)
      .eq("sent_for_date", localDate)
      .maybeSingle();
    if (existing) continue;

    // Resolve recipient.
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", pref.user_id)
      .maybeSingle();
    if (!profile?.email) continue;

    // Pull today's tasks: bucket by quadrant 1 vs everything-else due
    // today, plus overdue (due_at < today's local 00:00).
    const todayStart = startOfLocalDay(nowUtc, tz);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const { data: dueToday } = await supabase
      .from("tasks")
      .select("id, title, due_at, priority")
      .eq("user_id", pref.user_id)
      .eq("is_completed", false)
      .gte("due_at", todayStart.toISOString())
      .lt("due_at", todayEnd.toISOString())
      .order("priority", { ascending: false })
      .order("due_at", { ascending: true })
      .limit(20);
    const { data: overdueRaw } = await supabase
      .from("tasks")
      .select("id, title, due_at, priority")
      .eq("user_id", pref.user_id)
      .eq("is_completed", false)
      .lt("due_at", todayStart.toISOString())
      .order("due_at", { ascending: true })
      .limit(5);

    const due = (dueToday ?? []) as DigestTask[];
    // Quadrant 1 in our model = priority >= 4 (high/urgent + important)
    const q1Today = due.filter((t) => (t.priority ?? 0) >= 4).slice(0, 5);
    const topToday = due
      .filter((t) => !q1Today.find((q) => q.id === t.id))
      .slice(0, 3);
    const overdue = (overdueRaw ?? []) as DigestTask[];

    // Streak: read habit_logs for this user, walk back from yesterday,
    // count consecutive days with at least one habit logged.
    const streakDays = await computeStreak(supabase, pref.user_id, tz);
    const habitsToday = await countHabitsLoggedToday(supabase, pref.user_id, localDate);

    const lang = (pref.language ?? "en") as LanguageCode;
    const langDef = getLanguage(lang);
    const chrome = buildChrome(lang, profile.full_name ?? "");
    const unsubToken = makeUnsubToken(pref.user_id);
    const unsubUrl = `${appUrl}/api/reminders/unsubscribe?token=${unsubToken}`;

    const html = renderDigestHtml({
      recipientName: profile.full_name ?? "",
      language: lang,
      locale: langDef.dateFnsLocale,
      date: nowUtc,
      topToday,
      q1Today,
      overdue,
      habitsToday,
      streakDays,
      appUrl,
      unsubUrl,
      chrome,
    });
    const text = renderDigestText({
      recipientName: profile.full_name ?? "",
      language: lang,
      locale: langDef.dateFnsLocale,
      date: nowUtc,
      topToday,
      q1Today,
      overdue,
      habitsToday,
      streakDays,
      appUrl,
      unsubUrl,
      chrome,
    });

    try {
      const { data: emailRes, error: sendErr } = await resend.emails.send({
        from: getFromAddress(),
        to: profile.email,
        subject: chrome.headline,
        html,
        text,
      });
      if (sendErr) {
        sent.push({ user_id: pref.user_id, status: "send_error", detail: sendErr.message });
        continue;
      }
      await supabase.from("daily_digest_log").insert({
        user_id: pref.user_id,
        sent_for_date: localDate,
        email_id: emailRes?.id ?? null,
      });
      sent.push({ user_id: pref.user_id, status: "ok" });
    } catch (e) {
      sent.push({
        user_id: pref.user_id,
        status: "exception",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ ok: true, sent, total: sent.length });
}

function currentHourInTz(now: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const h = parts.find((p) => p.type === "hour")?.value ?? "0";
  // Intl returns 24 for midnight in some impls — normalize to 0.
  const n = parseInt(h, 10);
  return n === 24 ? 0 : n;
}

function currentDateInTz(now: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD
}

function startOfLocalDay(now: Date, tz: string): Date {
  const ymd = currentDateInTz(now, tz);
  // Re-anchor that local date to UTC midnight equivalent. The query
  // tolerance is 24h so a small offset doesn't matter.
  return new Date(`${ymd}T00:00:00.000Z`);
}

type SupabaseAdminClient = ReturnType<typeof createSupabaseClient<any, "public", "public", any, any>>;

async function computeStreak(
  supabase: SupabaseAdminClient,
  userId: string,
  tz: string
): Promise<number> {
  const today = currentDateInTz(new Date(), tz);
  // Look back up to 90 days — anyone running longer should still see
  // a healthy number; we're not racing for a perfect lifetime streak.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 90);
  const { data: rows } = await supabase
    .from("habit_logs")
    .select("logged_date")
    .eq("user_id", userId)
    .gte("logged_date", since.toISOString().slice(0, 10));
  if (!rows || rows.length === 0) return 0;

  const days = new Set(rows.map((r) => r.logged_date as string));
  let streak = 0;
  // Start from yesterday — today's habit might not be done yet at 7am.
  const cursor = new Date(today + "T00:00:00.000Z");
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (true) {
    const k = cursor.toISOString().slice(0, 10);
    if (days.has(k)) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else break;
  }
  return streak;
}

async function countHabitsLoggedToday(
  supabase: SupabaseAdminClient,
  userId: string,
  localDate: string
): Promise<number> {
  const { count } = await supabase
    .from("habit_logs")
    .select("habit_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("logged_date", localDate);
  return count ?? 0;
}

/**
 * Pre-translated chrome strings for the digest template. Kept inline
 * here (rather than in i18n.ts) so the email is self-contained — i18n
 * keys are for in-app UI; emails only ship five locales of one feature
 * and cohabit with Resend templates.
 */
function buildChrome(lang: LanguageCode, name: string) {
  const firstName = name.split(/\s+/)[0] || "";
  const map = {
    en: {
      kicker: "FIRST LIGHT · DAILY DIGEST",
      headline: firstName ? `${firstName}, here's your day.` : "Here's your day.",
      intro: "A calm read of what matters today. Move through it without rush.",
      sectionTopToday: "On the agenda",
      sectionQ1: "Urgent + important",
      sectionOverdue: "Carrying over",
      cta: "Open today in First Light",
      footer: "First Light · Daily digest. You can change the send time or pause this in Settings.",
      unsubLabel: "Pause daily digest",
      streakSuffix: (n: number) => n === 0 ? "No streak yet" : `${n}-day streak`,
      habitsSummary: (n: number) => n === 0 ? "no habits logged yet today" : `${n} habit${n === 1 ? "" : "s"} logged`,
      noTasks: "Nothing urgent today.",
    },
    "zh-TW": {
      kicker: "FIRST LIGHT · 每日簡報",
      headline: firstName ? `${firstName}，今日的版面。` : "今日的版面。",
      intro: "靜下來看今天的重點。不急、按部就班地完成。",
      sectionTopToday: "今日要事",
      sectionQ1: "急且重要",
      sectionOverdue: "順延任務",
      cta: "在 First Light 中開啟今天",
      footer: "First Light · 每日簡報。可在設定中調整寄送時間或暫停。",
      unsubLabel: "暫停每日簡報",
      streakSuffix: (n: number) => n === 0 ? "尚未建立連續紀錄" : `已連續 ${n} 天`,
      habitsSummary: (n: number) => n === 0 ? "今日尚未記錄習慣" : `今日已記錄 ${n} 項習慣`,
      noTasks: "今天沒有急件。",
    },
    "zh-CN": {
      kicker: "FIRST LIGHT · 每日简报",
      headline: firstName ? `${firstName}，今天的版面。` : "今天的版面。",
      intro: "静下来看今天的重点。不急、按部就班完成。",
      sectionTopToday: "今日要事",
      sectionQ1: "紧急且重要",
      sectionOverdue: "顺延任务",
      cta: "在 First Light 中打开今天",
      footer: "First Light · 每日简报。可在设置中调整发送时间或暂停。",
      unsubLabel: "暂停每日简报",
      streakSuffix: (n: number) => n === 0 ? "尚未建立连续记录" : `已连续 ${n} 天`,
      habitsSummary: (n: number) => n === 0 ? "今天尚未记录习惯" : `今天已记录 ${n} 项习惯`,
      noTasks: "今天没有急件。",
    },
    ja: {
      kicker: "FIRST LIGHT · デイリーブリーフ",
      headline: firstName ? `${firstName}さん、今日の紙面です。` : "今日の紙面です。",
      intro: "今日大切なことを、静かに眺めて。焦らずに進めましょう。",
      sectionTopToday: "本日のテーマ",
      sectionQ1: "緊急かつ重要",
      sectionOverdue: "持ち越し",
      cta: "First Light で今日を開く",
      footer: "First Light · デイリーブリーフ。送信時間や停止は設定から変更できます。",
      unsubLabel: "デイリーブリーフを停止",
      streakSuffix: (n: number) => n === 0 ? "連続記録はまだありません" : `${n}日連続`,
      habitsSummary: (n: number) => n === 0 ? "今日の習慣はまだ未記録" : `習慣 ${n}件 達成`,
      noTasks: "緊急なものはありません。",
    },
    ko: {
      kicker: "FIRST LIGHT · 데일리 다이제스트",
      headline: firstName ? `${firstName}님, 오늘의 지면입니다.` : "오늘의 지면입니다.",
      intro: "오늘 중요한 것만 차분히 살펴보세요. 서두르지 말고요.",
      sectionTopToday: "오늘의 의제",
      sectionQ1: "긴급 + 중요",
      sectionOverdue: "이월된 작업",
      cta: "First Light에서 오늘 열기",
      footer: "First Light · 데일리 다이제스트. 발송 시간 변경이나 일시 중지는 설정에서 가능합니다.",
      unsubLabel: "데일리 다이제스트 일시 중지",
      streakSuffix: (n: number) => n === 0 ? "아직 연속 기록이 없습니다" : `${n}일 연속`,
      habitsSummary: (n: number) => n === 0 ? "오늘 기록한 습관 없음" : `습관 ${n}개 기록`,
      noTasks: "오늘 급한 일은 없어요.",
    },
  } as const;
  return map[lang] ?? map.en;
}
