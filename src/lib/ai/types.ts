import { z } from "zod";

export const ParsedTaskSchema = z.object({
  title: z.string().min(1),
  /** start_at lets the parser surface ranges like "10am-11am". Optional
   *  on read so older code paths producing only due_at still validate. */
  start_at: z.string().nullable().optional(),
  due_at: z.string().nullable(),
  is_all_day: z.boolean(),
  priority: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(5)]),
  tagNames: z.array(z.string()),
  projectName: z.string().nullable(),
  rrule: z.string().nullable(),
  reminder_at: z.string().nullable(),
  estimated_minutes: z.number().int().positive().nullable(),
});
export type ParsedTask = z.infer<typeof ParsedTaskSchema>;

/**
 * One task extracted from a scanned image. Same shape as ParsedTaskSchema
 * minus the `min(1)` on title (the model sometimes returns short notes
 * with empty titles which we want to filter out client-side rather than
 * fail the whole batch on).
 */
export const ScannedTaskSchema = z.object({
  title: z.string(),
  start_at: z.string().nullable().optional(),
  due_at: z.string().nullable(),
  is_all_day: z.boolean().optional().default(false),
  priority: z
    .union([z.literal(0), z.literal(1), z.literal(3), z.literal(5)])
    .default(0),
  tagNames: z.array(z.string()).default([]),
  projectName: z.string().nullable().optional(),
  rrule: z.string().nullable().optional(),
  reminder_at: z.string().nullable().optional(),
  estimated_minutes: z.number().int().positive().nullable().optional(),
});
export type ScannedTask = z.infer<typeof ScannedTaskSchema>;

export const ScannedTasksSchema = z.object({
  tasks: z.array(ScannedTaskSchema),
});
export type ScannedTasks = z.infer<typeof ScannedTasksSchema>;

export const QuadrantResultSchema = z.object({
  quadrant: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  reason: z.string(),
});
export type QuadrantResult = z.infer<typeof QuadrantResultSchema>;

export const DailyEditionSchema = z.object({
  kicker: z.string(),
  headline: z.string(),
  front_page: z.string(),
  inside: z.string(),
  below_fold: z.string(),
});
export type DailyEdition = z.infer<typeof DailyEditionSchema>;

/**
 * Weekly retro. shipped/slipped/drop_list are the original columns;
 * themes + next_week_plan are the smarter-retro upgrade. Both are optional
 * on read so older cached rows still validate — the prompt asks for them
 * on every new generation.
 */
export const WeeklyRetroSchema = z.object({
  shipped: z.string(),
  slipped: z.string(),
  drop_list: z.string(),
  themes: z.string().optional(),
  next_week_plan: z.string().optional(),
});
export type WeeklyRetro = z.infer<typeof WeeklyRetroSchema>;

/**
 * Morning Co-pilot (Round E v1) — proactive once-a-day brief.
 *
 * The model returns a single JSON object with a kicker, headline, intro
 * paragraph, an optional clarifying question, ≤3 suggested actions
 * (each carrying a kind + concrete task_id + short reason), and a
 * one-line closing intent. We validate the suggested_actions list is
 * capped on the server before persisting; the route also filters
 * hallucinated task_ids out before storage.
 */
export const MorningCopilotActionKindSchema = z.enum([
  "defer",
  "drop",
  "batch",
  "reschedule",
]);
export type MorningCopilotActionKind = z.infer<
  typeof MorningCopilotActionKindSchema
>;

export const MorningCopilotActionSchema = z.object({
  kind: MorningCopilotActionKindSchema,
  task_id: z.string(),
  reason: z.string(),
});
export type MorningCopilotAction = z.infer<typeof MorningCopilotActionSchema>;

export const MorningCopilotSchema = z.object({
  kicker: z.string(),
  headline: z.string(),
  intro: z.string(),
  clarifying_question: z.string().nullable(),
  suggested_actions: z.array(MorningCopilotActionSchema).max(3),
  closing_intent: z.string(),
});
export type MorningCopilotBrief = z.infer<typeof MorningCopilotSchema>;

/**
 * Strip a Claude response down to the JSON it produced, regardless of
 * whether the model wrapped it in ```json fences or chatter.
 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  // Find the first `{` and last `}` to be tolerant of a "Here's the JSON:" preamble.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in response");
  return JSON.parse(raw.slice(start, end + 1));
}
