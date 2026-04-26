"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseQuickInput, describeParsed, describeNow, type ParsedQuickInput } from "@/lib/quick-parse";
import { useCreateTask } from "@/hooks/use-tasks";
import { useCreateProject, useProjects } from "@/hooks/use-projects";
import { useUIStore } from "@/store/ui";
import { useParseTaskAI } from "@/hooks/use-ai";
import { VoiceButton } from "./voice-button";
import {
  Bell, CalendarClock, Flag, Folder, Hash, Repeat, Sparkles,
} from "lucide-react";
import { addDays, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Email Sam tomorrow at 9am with a reminder 30 minutes before, urgent #work",
  "Stand-up every weekday at 10am",
  "Pick up groceries on Friday at 6pm in Errands #shopping",
  "Pay rent monthly on the 1st",
  "Call mom Sunday afternoon",
];

export function QuickAdd() {
  const open = useUIStore((s) => s.quickAddOpen);
  const setOpen = useUIStore((s) => s.setQuickAddOpen);
  const [text, setText] = useState("");
  const [now, setNow] = useState(() => new Date());
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();
  const createProject = useCreateProject();
  const { data: projects = [] } = useProjects();
  const aiParse = useParseTaskAI();

  const parsed = useMemo(() => parseQuickInput(text), [text]);
  const preview = useMemo(() => describeParsed(parsed, now), [parsed, now]);
  const quadrant = useMemo(() => classifyQuadrant(parsed, now), [parsed, now]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (open) {
      setText("");
      setNow(new Date());
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if (!open && e.key.toLowerCase() === "q" && !isTyping(e)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  async function submit() {
    if (!text.trim()) return;
    // Try the LLM parser first — it handles richer phrases ("the Friday before
    // the offsite", "after dentist before kids pickup"). Fall back to the
    // chrono-node `parsed` if AI is disabled or fails.
    let p: any = parsed;
    try {
      const ai = await aiParse.mutateAsync(text.trim());
      if (ai && ai.title) p = ai;
    } catch {
      // chrono fallback already in `parsed`
    }
    if (!p.title) return;
    let projectId: string | null = null;
    if (p.projectName) {
      const found = projects.find((pr: any) => pr.name.toLowerCase() === p.projectName!.toLowerCase());
      if (found) projectId = found.id;
      else {
        const created = await createProject.mutateAsync({ name: p.projectName });
        projectId = created.id;
      }
    }
    await createTask.mutateAsync({
      title: p.title,
      due_at: p.due_at,
      is_all_day: p.is_all_day,
      priority: p.priority,
      tagNames: p.tagNames,
      project_id: projectId,
      rrule: p.rrule,
      reminder_at: p.reminder_at,
      ...(p.estimated_minutes != null ? { estimated_minutes: p.estimated_minutes } : {}),
    } as any);
    setOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start pt-[10vh] bg-black/40 animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="card w-[92vw] max-w-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* "Now" anchor */}
        <div className="flex items-center justify-between text-[11px] text-muted-fg">
          <span className="editorial-number uppercase tracking-[0.18em]">Quick add</span>
          <span>{describeNow(now)}</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-lg placeholder:text-muted-fg"
            placeholder='Tell me what to add — or press the mic and speak'
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
          <VoiceButton onTranscript={(t) => setText(t)} onFinal={(t) => setText(t)} />
        </div>

        {/* Conversational preview */}
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-fg flex items-start gap-2">
          <Sparkles className="size-4 text-muted-fg shrink-0 mt-0.5" />
          <p className="leading-relaxed">{preview}</p>
        </div>

        {/* Live activation row + mini Eisenhower */}
        <div className="grid md:grid-cols-[1fr_auto] gap-4">
          <div className="flex flex-wrap gap-1.5 content-start">
            <Activator
              active={!!parsed.due_at}
              icon={<CalendarClock className="size-3.5" />}
              label={parsed.due_at ? formatDueShort(parsed.due_at, parsed.is_all_day) : "Time"}
            />
            <Activator
              active={!!parsed.rrule}
              icon={<Repeat className="size-3.5" />}
              label={parsed.rrule ? rruleShort(parsed.rrule) : "Repeat"}
            />
            <Activator
              active={!!parsed.reminder_at}
              icon={<Bell className="size-3.5" />}
              label={parsed.reminder_at ? reminderShort(parsed.reminder_at, parsed.due_at) : "Reminder"}
            />
            <Activator
              active={parsed.priority > 0}
              icon={<Flag className="size-3.5" />}
              label={parsed.priority > 0 ? priorityWord(parsed.priority) : "Priority"}
              tone={priorityTone(parsed.priority)}
            />
            <Activator
              active={!!parsed.projectName}
              icon={<Folder className="size-3.5" />}
              label={parsed.projectName ?? "Inbox"}
            />
            {parsed.tagNames.map((t) => (
              <Activator key={t} active icon={<Hash className="size-3.5" />} label={t} />
            ))}
            {parsed.tagNames.length === 0 && (
              <Activator active={false} icon={<Hash className="size-3.5" />} label="Tags" />
            )}
          </div>
          <MiniEisenhower active={quadrant} />
        </div>

        {/* Examples (only on empty input) */}
        {!text && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                className="text-[11px] text-muted-fg hover:text-fg border border-border rounded-full px-2 py-0.5"
                onClick={() => setText(ex)}
              >
                {ex.length > 56 ? ex.slice(0, 54) + "…" : ex}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-muted-fg pt-1">
          <span>
            Hints: <code>tomorrow 9am</code>, <code>every Monday</code>,{" "}
            <code>remind me 30m before</code>, <code>urgent</code>,{" "}
            <code>#tag</code>, <code>~ListName</code>
          </span>
          <span>Enter to add · Esc to close</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- small components ---------- */

function Activator({
  active, icon, label, tone,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  tone?: "high" | "med" | "low" | "none";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 h-6 rounded-full text-xs border transition-all",
        active
          ? tone === "high"
            ? "border-p-high text-p-high bg-p-high/10"
            : tone === "med"
              ? "border-p-med text-p-med bg-p-med/10"
              : tone === "low"
                ? "border-p-low text-p-low bg-p-low/10"
                : "border-fg text-fg bg-muted"
          : "border-border text-muted-fg bg-transparent"
      )}
    >
      {icon}
      {label}
    </span>
  );
}

type Quadrant = "q1" | "q2" | "q3" | "q4" | null;

function classifyQuadrant(p: ParsedQuickInput, now: Date): Quadrant {
  if (!p.title) return null;
  const tomorrow = addDays(now, 1);
  const isUrgent = p.due_at
    ? (() => {
        const d = new Date(p.due_at);
        return isToday(d) || isPast(d) || d <= tomorrow;
      })()
    : false;
  const isImportant = p.priority >= 3;
  if (isUrgent && isImportant)   return "q1";
  if (!isUrgent && isImportant)  return "q2";
  if (isUrgent && !isImportant)  return "q3";
  return "q4";
}

function MiniEisenhower({ active }: { active: Quadrant }) {
  const cells: Array<{ key: Exclude<Quadrant, null>; label: string; fg: string; bg: string; border: string }> = [
    { key: "q1", label: "Do first",  fg: "#B91C1C", bg: "rgba(239, 68, 68, 0.10)",  border: "#EF4444" },
    { key: "q2", label: "Schedule",  fg: "#047857", bg: "rgba(16, 185, 129, 0.10)", border: "#10B981" },
    { key: "q3", label: "Delegate",  fg: "#B45309", bg: "rgba(245, 158, 11, 0.12)", border: "#F59E0B" },
    { key: "q4", label: "Eliminate", fg: "#475569", bg: "rgba(100, 116, 139, 0.10)", border: "#94A3B8" },
  ];
  return (
    <div className="shrink-0 self-start">
      <div className="grid grid-cols-2 gap-1 w-[176px]">
        {cells.map((c) => {
          const isActive = active === c.key;
          return (
            <div
              key={c.key}
              style={{
                backgroundColor: isActive ? c.fg : c.bg,
                color: isActive ? "white" : c.fg,
                borderColor: c.border,
                borderTopWidth: 3,
              }}
              className={cn(
                "h-12 rounded-md border text-[10px] grid place-items-center text-center px-1 transition-all",
                isActive && "shadow-md font-medium"
              )}
              title={c.label}
            >
              {c.label}
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-fg text-center mt-1">Eisenhower</div>
    </div>
  );
}

/* ---------- formatters ---------- */

function priorityWord(p: number) {
  if (p >= 5) return "High";
  if (p >= 3) return "Medium";
  if (p >= 1) return "Low";
  return "None";
}
function priorityTone(p: number): "high" | "med" | "low" | "none" {
  if (p >= 5) return "high";
  if (p >= 3) return "med";
  if (p >= 1) return "low";
  return "none";
}
function rruleShort(rule: string) {
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
function reminderShort(reminderIso: string, dueIso: string | null) {
  if (!dueIso) return new Date(reminderIso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const offsetMs = new Date(dueIso).getTime() - new Date(reminderIso).getTime();
  if (offsetMs <= 0) return new Date(reminderIso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const min = Math.round(offsetMs / 60_000);
  if (min >= 60 && min % 60 === 0) {
    const h = min / 60;
    return `${h}h before`;
  }
  return `${min}m before`;
}
function formatDueShort(iso: string, allDay: boolean) {
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

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}
