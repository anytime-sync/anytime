import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { checkAiBudget, logAiCall } from "@/lib/ai-rate-limit";
import { planDaySystem } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/types";
import type { LanguageCode } from "@/lib/i18n";
import { safeTimezone, localNowStr } from "@/lib/ai/tz";
import { fetchScheduleContext, renderScheduleContext } from "@/lib/ai/schedule-context";

export const runtime = "nodejs";

/**
 * /api/ai/plan-day — single-day quadrant + priority planner.
 *
 * Mirrors plan-week but scoped to today's slice: due today, overdue,
 * or undated. Same input/output shape as plan-week so the existing
 * Plan-my-week modal UI can be reused with a different button + endpoint.
 */

const PlanDayRequestSchema = z.object({
  tz: z.string().optional(),
  tasks: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        due_at: z.string().nullable().optional(),
        priority: z.number().int().min(0).max(5),
        project: z.string().nullable().optional(),
      })
    )
    .min(1)
    .max(40),
});

const PlanDayResultSchema = z.object({
  suggestions: z.array(
    z.object({
      id: z.string(),
      quadrant: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      suggested_priority: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(5)]),
      reason: z.string(),
    })
  ),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const __budget = await checkAiBudget(u.user.id, "plan_day");
  if (!__budget.ok) {
    return NextResponse.json(
      { error: "rate_limited", used: __budget.used, limit: __budget.limit },
      { status: 429, headers: { "Retry-After": String(__budget.retryAfter) } }
    );
  }

  const client = getAnthropic();
  if (!client) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsedReq = PlanDayRequestSchema.safeParse(body);
  if (!parsedReq.success) {
    return NextResponse.json({ error: "bad_request", detail: parsedReq.error.message }, { status: 400 });
  }
  const { tasks, tz: rawTz } = parsedReq.data;
  const tz = safeTimezone(rawTz);

  // Skip time-locked tasks entirely — meetings, calendar events, anniversaries
  // and anything carrying a clock time in the title. Plan-my-Day suggests an order
  // for *flexible* work; everything else stays exactly where the user put it.
  function isTimeLocked(x: { title: string }): boolean {
    const re = /\b(meeting|meet|call|interview|appointment|appt|anniversary|birthday|wedding|ceremony|dinner reservation|flight|doctor|dentist|hearing|exam|consultation|conference|standup|stand-up|sync|1:1|one-on-one|catch-up|catchup|review with|check-in)\b/i;
    const time = /\b(at\s+\d|\d{1,2}\s*(am|pm|AM|PM)|\d{1,2}:\d{2})\b/;
    return re.test(x.title) || time.test(x.title);
  }
  const lockedTasks = tasks.filter(isTimeLocked);
  const flexibleTasks = tasks.filter((t) => !isTimeLocked(t));

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("language")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const language = (prefs?.language ?? "en") as LanguageCode;

  const taskBlock = flexibleTasks
    .map((t) => {
      const parts = [
        `[${t.id}]`,
        t.title,
        t.due_at ? `· due ${t.due_at}` : "· undated",
        `· p${t.priority}`,
        t.project ? `· ${t.project}` : "",
      ];
      return parts.filter(Boolean).join(" ");
    })
    .join("\n");

  const now = new Date();

  try {
    // Fetch schedule context — fail-safe
    let schedCtx;
    try {
      schedCtx = await fetchScheduleContext(supabase, u.user.id, tz, 1);
    } catch (ctxErr: any) {
      console.warn("[ai] plan-day: schedule context failed:", ctxErr?.message);
      schedCtx = null;
    }

    const userMsg = [
      `NOW: ${localNowStr(now, tz)}`,
      `USER_TIMEZONE: ${tz}`,
      `WORKING_HORIZON: today`,
      "",
      schedCtx ? renderScheduleContext(schedCtx) : "SCHEDULE: unavailable",
      "",
      `TASKS TO PLAN (${tasks.length} total, ${flexibleTasks.length} flexible, ${lockedTasks.length} time-locked):`,
      taskBlock,
    ].join("\n");

    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 1500,
      system: planDaySystem(language),
      messages: [{ role: "user", content: userMsg }],
    });
    const content = res.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    const json = extractJson(content);

    // Lenient parse — coerce values instead of throwing on minor AI deviations
    const RawSchema = z.object({
      suggestions: z.array(z.object({
        id: z.string(),
        quadrant: z.coerce.number().int().min(1).max(4).transform((v) => Math.min(4, Math.max(1, Math.round(v))) as 1|2|3|4),
        suggested_priority: z.coerce.number().int().transform((v) => {
          const valid = [0, 1, 3, 5];
          return (valid.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a)) as 0|1|3|5;
        }),
        reason: z.string().catch("no reason provided"),
      })).catch([]),
      notes: z.string().optional().catch(""),
    });
    const parsed = RawSchema.parse(json ?? {});

    // Include all tasks the AI returned (not just flexible)
    const known = new Set(tasks.map((t) => t.id));
    const filtered = parsed.suggestions.filter((s) => known.has(s.id));

    await logAiCall(u.user.id, "plan_day", { model: res.model, status: 200, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens });
    return NextResponse.json({ suggestions: filtered, notes: parsed.notes ?? "" });
  } catch (e: any) {
    console.error("[ai] plan-day", "\n", e?.stack || e?.message || e);
    return NextResponse.json(
      { error: "plan_day_failed", detail: e?.message ?? String(e) },
      { status: 502 }
    );
  }
}
