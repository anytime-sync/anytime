"use client";

import { useMemo, useState } from "react";
import { Bell, CalendarClock, Flag, Folder, Hash, Repeat, Sparkles } from "lucide-react";
import {
  parseQuickInput,
  describeParsed,
  type ParsedQuickInput,
} from "@/lib/quick-parse";
import { useCreateTask } from "@/hooks/use-tasks";
import { useCreateProject, useProjects } from "@/hooks/use-projects";
import { useParseTaskAI } from "@/hooks/use-ai";
import { VoiceButton } from "./voice-button";
import { cn } from "@/lib/utils";

/**
 * Reusable inline "Add task" row that runs the conversational parser on
 * every keystroke and shows a compact live preview underneath.
 *
 * defaultProjectId — list/project the task lands in if the user doesn't
 *   explicitly type ~ListName. (Smart views like Today/Inbox pass null.)
 *
 * defaultDueAt — fallback ISO timestamp used when the user's text didn't
 *   include a date (calendar single-day view passes the day so anything
 *   typed there lands on the visible date, not at "no date").
 */
export function InlineTaskInput({
  defaultProjectId = null,
  defaultDueAt = null,
  placeholder = 'Add task — try "Email Sam tomorrow 9am, urgent #work"',
}: {
  defaultProjectId?: string | null;
  defaultDueAt?: string | null;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const create = useCreateTask();
  const createProject = useCreateProject();
  const { data: projects = [] } = useProjects();
  const aiParse = useParseTaskAI();

  const parsed = useMemo(() => parseQuickInput(text), [text]);
  const showPreview = text.trim().length > 0 && hasAnyExtraction(parsed);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    // LLM parse on submit; chrono fallback on failure or when AI is disabled.
    let p: any = parsed;
    try {
      const ai = await aiParse.mutateAsync(text.trim());
      if (ai && ai.title) p = ai;
    } catch {}
    if (!p.title) return;

    let projectId: string | null = defaultProjectId;
    if (p.projectName) {
      const found = projects.find(
        (pr: any) => pr.name.toLowerCase() === p.projectName!.toLowerCase()
      );
      projectId = found ? found.id : (await createProject.mutateAsync({ name: p.projectName })).id;
    }

    await create.mutateAsync({
      title: p.title,
      // Fall back to the host view's date when the user typed nothing
      // date-like — keeps tasks added from the calendar's day view on
      // that day, instead of landing in "no date".
      due_at: p.due_at ?? defaultDueAt,
      is_all_day: p.due_at ? p.is_all_day : !!defaultDueAt,
      priority: p.priority,
      tagNames: p.tagNames,
      project_id: projectId,
      rrule: p.rrule,
      reminder_at: p.reminder_at,
      ...(p.estimated_minutes != null ? { estimated_minutes: p.estimated_minutes } : {}),
    } as any);
    setText("");
  }

  return (
    <div>
      <form
        className="px-3 py-2 rounded-md border border-dashed border-border flex items-center gap-3 cursor-text"
        onSubmit={submit}
      >
        <span className="size-5 rounded-full border-2 border-muted-fg" />
        <input
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-fg"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <VoiceButton
          onTranscript={(t) => setText(t)}
          onFinal={(t) => setText(t)}
          className="size-7 shrink-0"
        />
        {showPreview && (
          <span className="text-[11px] text-muted-fg shrink-0">Enter to add</span>
        )}
      </form>

      {showPreview && (
        <div className="px-3 mt-1.5 space-y-1.5">
          <div className="flex items-start gap-2 text-[12px] text-muted-fg">
            <Sparkles className="size-3.5 shrink-0 mt-0.5" />
            <p className="leading-snug">{describeParsed(parsed)}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {parsed.due_at && (
              <PreviewChip
                icon={<CalendarClock className="size-3" />}
                label={shortDue(parsed.due_at, parsed.is_all_day)}
              />
            )}
            {parsed.rrule && (
              <PreviewChip icon={<Repeat className="size-3" />} label={shortRrule(parsed.rrule)} />
            )}
            {parsed.reminder_at && (
              <PreviewChip
                icon={<Bell className="size-3" />}
                label={shortReminder(parsed.reminder_at, parsed.due_at)}
              />
            )}
            {parsed.priority > 0 && (
              <PreviewChip
                icon={<Flag className="size-3" />}
                label={priorityWord(parsed.priority)}
                tone={priorityTone(parsed.priority)}
              />
            )}
            {parsed.projectName && (
              <PreviewChip icon={<Folder className="size-3" />} label={parsed.projectName} />
            )}
            {parsed.tagNames.map((t) => (
              <PreviewChip key={t} icon={<Hash className="size-3" />} label={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function hasAnyExtraction(p: ParsedQuickInput): boolean {
  return !!(
    p.due_at ||
    p.rrule ||
    p.reminder_at ||
    p.priority > 0 ||
    p.projectName ||
    p.tagNames.length
  );
}

function PreviewChip({
  icon, label, tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "high" | "med" | "low";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 h-5 rounded-full text-[10px] border",
        tone === "high"
          ? "border-p-high text-p-high bg-p-high/10"
          : tone === "med"
            ? "border-p-med text-p-med bg-p-med/10"
            : tone === "low"
              ? "border-p-low text-p-low bg-p-low/10"
              : "border-fg/40 text-fg bg-muted"
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function priorityWord(p: number) {
  if (p >= 5) return "High";
  if (p >= 3) return "Medium";
  if (p >= 1) return "Low";
  return "None";
}
function priorityTone(p: number): "high" | "med" | "low" | undefined {
  if (p >= 5) return "high";
  if (p >= 3) return "med";
  if (p >= 1) return "low";
  return undefined;
}
function shortRrule(rule: string) {
  if (/FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR/i.test(rule)) return "Weekdays";
  const dom = rule.match(/FREQ=WEEKLY;BYDAY=([A-Z]{2})$/i);
  if (dom) {
    const m: Record<string, string> = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" };
    return `Every ${m[dom[1]!.toUpperCase()] ?? dom[1]}`;
  }
  if (/FREQ=DAILY/i.test(rule)) return "Daily";
  if (/FREQ=WEEKLY/i.test(rule)) return "Weekly";
  if (/FREQ=MONTHLY/i.test(rule)) return "Monthly";
  if (/FREQ=YEARLY/i.test(rule)) return "Yearly";
  return "Repeats";
}
function shortReminder(reminderIso: string, dueIso: string | null) {
  if (!dueIso)
    return new Date(reminderIso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const offsetMs = new Date(dueIso).getTime() - new Date(reminderIso).getTime();
  if (offsetMs <= 0)
    return new Date(reminderIso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const min = Math.round(offsetMs / 60_000);
  if (min >= 60 && min % 60 === 0) {
    const h = min / 60;
    return `${h}h before`;
  }
  return `${min}m before`;
}
function shortDue(iso: string, allDay: boolean) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today); dayAfter.setDate(dayAfter.getDate() + 2);
  const dayPart =
    d >= today && d < tomorrow
      ? "Today"
      : d >= tomorrow && d < dayAfter
      ? "Tomorrow"
      : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (allDay) return dayPart;
  return `${dayPart} ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}
