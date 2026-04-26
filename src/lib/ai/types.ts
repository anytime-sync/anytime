import { z } from "zod";

export const ParsedTaskSchema = z.object({
  title: z.string().min(1),
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
