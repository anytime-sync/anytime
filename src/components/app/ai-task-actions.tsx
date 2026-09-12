"use client";

import Link from "next/link";
import { useUIStore } from "@/store/ui";
import { useState } from "react";
import { Sparkles, Clock, MessageSquare, Check } from "lucide-react";
import { toast } from "sonner";
import { useFindTime, usePrepMeeting, type TimeSlot, type MeetingPrep } from "@/hooks/use-ai";
import { useUpdateTask } from "@/hooks/use-tasks";
import type { Task } from "@/lib/db.types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";
import { useCanUseFeature } from "@/hooks/use-feature-access";

const MEETING_HINTS = /\b(meeting|sync|standup|stand-up|1:1|one[- ]on[- ]one|catch[- ]up|call|kickoff|kick[- ]off|review|interview|會議|會面|面試|미팅|회의)\b/i;

/**
 * Two AI shortcuts that mount in the task detail panel:
 *   1. "Find me time" — AI suggests 3 slots in the next 7 days; picking a
 *      slot writes start_at/due_at on the task.
 *   2. "Prep meeting" — AI generates a brief agenda + question list. Only
 *      shown when the title looks meeting-shaped.
 */
export function AiTaskActions({ task }: { task: Task }) {
  const lang = useLanguage();
  const openTask = useUIStore(s => s.setSelectedTaskId);
  const [coverage,setCoverage] = useState("");
  const findTime = useFindTime();
  const prepMeeting = usePrepMeeting();
  const update = useUpdateTask();
  const [slots, setSlots] = useState<TimeSlot[] | null>(null);
  const [prep, setPrep] = useState<MeetingPrep | null>(null);

  // Tier/flag gates. If the feature is off for this plan (or admin-disabled)
  // we don't render the button at all — no control that only errors on click.
  const canFindTime = useCanUseFeature("ai_find_time");
  const canPrepMeeting = useCanUseFeature("ai_prep_meeting");
  // Hide a button once its daily budget is exhausted, rather than showing a
  // "budget reached" error each time it's clicked.
  const [findTimeCapped, setFindTimeCapped] = useState(false);
  const [prepCapped, setPrepCapped] = useState(false);

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
        setFindTimeCapped(true);
        return;
      }
      setSlots(r.slots); setCoverage(r.coverage ?? "");
    } catch (e: any) {
      // Cap reached → hide the affordance instead of an error toast.
      if (e?.message?.includes("429")) {
        setFindTimeCapped(true);
      } else {
        toast.error("Couldn't find time — try again.");
      }
    }
  }

  async function applySlot(s:TimeSlot) {
    if(update.isPending)return;
    try {
      if(Date.parse(s.start_at)<Date.now())throw new Error('Slot has passed. Find a new time.');
      await update.mutateAsync({id:task.id,start_at:s.start_at,due_at:s.end_at,is_all_day:false});
      toast.success('Task dates updated.');setSlots(null);
    } catch(e) {toast.error(e instanceof Error ? e.message : 'Could not save this slot.');}
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
        setPrepCapped(true);
        return;
      }
      setPrep(r);
    } catch (e: any) {
      // Cap reached → hide the affordance instead of an error toast.
      if (e?.message?.includes("429")) {
        setPrepCapped(true);
      } else {
        toast.error("Couldn't prepare agenda — try again.");
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canFindTime && !findTimeCapped && (
        <button
          type="button"
          onClick={runFindTime}
          disabled={findTime.isPending}
          className="btn-ghost h-8 px-3 text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
          title={t(lang, "aiActions.findTimeTooltip")}
        >
          <Clock className={cn("size-3.5", findTime.isPending && "animate-spin")} />
          {findTime.isPending ? "Searching…" : "Find me time"}
        </button>
        )}

        {looksLikeMeeting && canPrepMeeting && !prepCapped && (
          <button
            type="button"
            onClick={runPrepMeeting}
            disabled={prepMeeting.isPending}
            className="btn-ghost h-8 px-3 text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
            title={t(lang, "aiActions.prepMeetingTooltip")}
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
            title={t(lang, "aiActions.estimatedTooltip")}
          >
            <Sparkles className="size-3" /> ~{(task as any).estimated_minutes}m
          </span>
        )}
      </div>

      {slots && <p className="text-xs text-muted-fg">{coverage}</p>}
      {slots && slots.length===0 && <p className="text-sm">No fitting slot was found. Try a shorter duration or review the calendar.</p>}
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
                disabled={update.isPending} onClick={() => void applySlot(s)}
                className="btn-ghost size-7 grid place-items-center text-success"
                title={t(lang, "aiActions.scheduleTooltip")}
              >
                <Check className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {prep && (
        <div className="border border-border rounded-md p-3 text-xs space-y-2 bg-muted/30">
          {prep.actions?.map((action,i) => <article key={i} className="space-y-1 border-b border-border pb-2"><strong>{action.title}</strong><p>{action.why}</p><p>Next step: {action.nextAction}</p><div className="flex flex-wrap gap-2">{action.sourceIds.map(id => { const source=prep.sources?.find(s=>s.id===id); if(!source)return null; return source.kind==='task' ? <button key={id} className="underline text-accent" onClick={()=>openTask(id.slice(5))}>{source.title}</button> : <Link key={id} className="underline text-accent" href={`/app/notes/${id.slice(5)}`}>{source.title}</Link>; })}</div></article>)}
          {prep.missingContext?.map((m,i)=><p key={i} className="text-muted-fg">{m}</p>)}
          {!prep.actions && <>
          <div>
            <div className="font-medium uppercase tracking-wider text-[10px] text-muted-fg mb-1">
              Agenda
            </div>
            <ul className="space-y-0.5 text-fg">
              {(prep.actions ? [] : prep.agenda).map((line, i) => (
                <li key={i} className="leading-relaxed">— {line}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-medium uppercase tracking-wider text-[10px] text-muted-fg mb-1">
              Questions
            </div>
            <ul className="space-y-0.5 text-fg">
              {(prep.actions ? [] : prep.questions).map((q, i) => (
                <li key={i} className="leading-relaxed">· {q}</li>
              ))}
            </ul>
          </div>
          </>}
        </div>
      )}
    </div>
  );
}
