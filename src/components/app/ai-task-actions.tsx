"use client";

import { useState } from "react";
import { Sparkles, Clock, MessageSquare, Check } from "lucide-react";
import { toast } from "sonner";
import { useFindTime, usePrepMeeting, type TimeSlot, type MeetingPrep } from "@/hooks/use-ai";
import { useUpdateTask } from "@/hooks/use-tasks";
import type { Task } from "@/lib/db.types";
import { cn } from "@/lib/utils";

const MEETING_HINTS = /\b(meeting|sync|standup|stand-up|1:1|one[- ]on[- ]one|catch[- ]up|call|kickoff|kick[- ]off|review|interview|會議|會面|面試|미팅|회의)\b/i;

/**
 * Two AI shortcuts that mount in the task detail panel:
 *   1. "Find me time" — AI suggests 3 slots in the next 7 days; picking a
 *      slot writes start_at/due_at on the task.
 *   2. "Prep meeting" — AI generates a brief agenda + question list. Only
 *      shown when the title looks meeting-shaped.
 */
export function AiTaskActions({ task }: { task: Task }) {
  const findTime = useFindTime();
  const prepMeeting = usePrepMeeting();
  const update = useUpdateTask();
  const [slots, setSlots] = useState<TimeSlot[] | null>(null);
  const [prep, setPrep] = useState<MeetingPrep | null>(null);

  const looksLikeMeeting = MEETING_HINTS.test(task.title);

  async function runFindTime() {
    setSlots(null);
    try {
      const r = await findTime.mutateAsync({
        task_id: task.id,
        title: task.title,
        estimated_minutes: (task as any).estimated_minutes ?? null,
      });
      if (!r) {
        toast.error("AI is currently disabled.");
        return;
      }
      setSlots(r.slots);
    } catch (e: any) {
      toast.error(
        e?.message?.includes("429")
          ? "Daily find-time budget reached."
          : "Couldn't find time — try again."
      );
    }
  }

  function applySlot(s: TimeSlot) {
    update.mutate({
      id: task.id,
      start_at: s.start_at,
      due_at: s.end_at,
      is_all_day: false,
    } as any);
    toast.success(`Scheduled — ${s.label}`);
    setSlots(null);
  }

  async function runPrepMeeting() {
    setPrep(null);
    try {
      const r = await prepMeeting.mutateAsync({
        task_id: task.id,
        title: task.title,
        notes: task.notes,
      });
      if (!r) {
        toast.error("AI is currently disabled.");
        return;
      }
      setPrep(r);
    } catch (e: any) {
      toast.error(
        e?.message?.includes("429")
          ? "Daily prep-meeting budget reached."
          : "Couldn't prepare agenda — try again."
      );
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runFindTime}
          disabled={findTime.isPending}
          className="btn-ghost h-8 px-3 text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
          title="AI suggests 3 time slots in the next 7 days"
        >
          <Clock className={cn("size-3.5", findTime.isPending && "animate-spin")} />
          {findTime.isPending ? "Searching…" : "Find me time"}
        </button>

        {looksLikeMeeting && (
          <button
            type="button"
            onClick={runPrepMeeting}
            disabled={prepMeeting.isPending}
            className="btn-ghost h-8 px-3 text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
            title="AI drafts a brief agenda + questions"
          >
            <MessageSquare
              className={cn("size-3.5", prepMeeting.isPending && "animate-pulse")}
            />
            {prepMeeting.isPending ? "Thinking…" : "Prep meeting"}
          </button>
        )}

        {(task as any).estimated_minutes != null && (
          <span
            className="inline-flex items-center gap-1 text-[11px] text-muted-fg"
            title="AI-estimated wall-clock time"
          >
            <Sparkles className="size-3" /> ~{(task as any).estimated_minutes}m
          </span>
        )}
      </div>

      {slots && slots.length > 0 && (
        <ul className="space-y-1.5">
          {slots.map((s, i) => (
            <li
              key={`${s.start_at}-${i}`}
              className="border border-border rounded-md p-2 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{s.label}</div>
                <div className="text-[11px] text-muted-fg">
                  {new Date(s.start_at).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  ·{" "}
                  <span className={cn(
                    "uppercase tracking-wider text-[10px]",
                    s.fit === "best" ? "text-success" : s.fit === "good" ? "text-fg" : "text-muted-fg"
                  )}>
                    {s.fit}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => applySlot(s)}
                className="btn-ghost size-7 grid place-items-center text-success"
                title="Schedule"
              >
                <Check className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {prep && (
        <div className="border border-border rounded-md p-3 text-xs space-y-2 bg-muted/30">
          <div>
            <div className="font-medium uppercase tracking-wider text-[10px] text-muted-fg mb-1">
              Agenda
            </div>
            <ul className="space-y-0.5 text-fg">
              {prep.agenda.map((line, i) => (
                <li key={i} className="leading-relaxed">— {line}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-medium uppercase tracking-wider text-[10px] text-muted-fg mb-1">
              Questions
            </div>
            <ul className="space-y-0.5 text-fg">
              {prep.questions.map((q, i) => (
                <li key={i} className="leading-relaxed">· {q}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
