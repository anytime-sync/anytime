"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Clock3, Flag, Hash, ListTree, Repeat, Sparkles, Trash2, Users } from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { useDeleteTask, useToggleTask, useSubtaskCounts, useUpdateTask } from "@/hooks/use-tasks";
import { useFindTime, type TimeSlot } from "@/hooks/use-ai";
import { useCanUseFeature } from "@/hooks/use-feature-access";
import { toast } from "sonner";
import { useProjects } from "@/hooks/use-projects";
import { useUIStore } from "@/store/ui";
import type { TaskWithTags } from "@/hooks/use-tasks";
import { TranslatedSubtitle } from "./translated-subtitle";
import { cn, priorityColorClass } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";

export function TaskItem({ task, isOverlapping }: { task: TaskWithTags; isOverlapping?: boolean }) {
  const lang = useLanguage();
  const toggle = useToggleTask();
  const selectedId = useUIStore((s) => s.selectedTaskId);
  const setSelected = useUIStore((s) => s.setSelectedTaskId);
  const isSelected = selectedId === task.id;
  const { data: counts = {} } = useSubtaskCounts([task.id]);
  const subCount = counts[task.id];

  // Which inline scheduler tray (if any) is expanded under this row. Only one
  // at a time; rendered *inline* below the metadata line so it pushes the list
  // down instead of floating over neighbouring rows (no overlap, works on touch).
  const [tray, setTray] = useState<null | "snooze" | "findtime">(null);

  // Swipe-to-delete on touch devices. Mouse / pen pointer types fall
  // through to no-ops so desktop click + drag-reorder are untouched. The
  // dnd-kit TouchSensor (configured in SortableTaskList) requires a
  // 250ms hold to begin a reorder, so a quick swipe never competes.
  const del = useDeleteTask();
  // Look up the share-group name for the badge. React Query dedupes across rows so
  // 100 task-items still trigger exactly one fetch.
  const { data: shareGroupsMap = {} } = useQuery<Record<string, string>>({
    queryKey: ["share-groups", "names"],
    queryFn: async () => {
      const r = await fetch("/api/share-groups");
      if (!r.ok) return {};
      const j = await r.json();
      const map: Record<string, string> = {};
      for (const row of ((j.rows ?? []) as Array<{ group?: { id?: string; name?: string } | null }>)) {
        if (row?.group?.id && row?.group?.name) map[row.group.id] = row.group.name;
      }
      return map;
    },
    staleTime: 60_000,
  });
  const shareGroupId: string | null = (task as { share_group_id?: string | null }).share_group_id ?? null;
  const shareGroupName = shareGroupId ? shareGroupsMap[shareGroupId] ?? null : null;

  const [swipeX, setSwipeX] = useState(0);
  const [swipeAnim, setSwipeAnim] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const dirRef = useRef<"h" | "v" | null>(null);
  const SWIPE_DELETE_AT = -110;
  const SWIPE_MAX = -160;

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return;
    if (task.is_completed) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    dirRef.current = null;
    setSwipeAnim(false);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (dirRef.current === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      dirRef.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (dirRef.current === "h") setSwiping(true);
    }
    if (dirRef.current === "h" && dx < 0) {
      setSwipeX(Math.max(dx, SWIPE_MAX));
    }
  }
  function onPointerUp() {
    if (!startRef.current) return;
    startRef.current = null;
    const wasHoriz = dirRef.current === "h";
    dirRef.current = null;
    if (!wasHoriz) {
      setSwiping(false);
      return;
    }
    setSwipeAnim(true);
    if (swipeX <= SWIPE_DELETE_AT) {
      setSwipeX(-1000);
      setTimeout(() => del.mutate(task.id), 180);
    } else {
      setSwipeX(0);
      setTimeout(() => setSwiping(false), 220);
    }
  }
  // Resolve the task's project so we can render a "~ListName" pill on the
  // row. Smart views (Today / Tomorrow / Next 7 / Next 90) pull tasks
  // from every list, so without this you can't tell at a glance which
  // list a task belongs to.
  const { data: projects = [] } = useProjects();
  const project = task.project_id
    ? projects.find((p: any) => p.id === task.project_id)
    : null;

  return (
    <div className="relative">
      <div
        className={cn(
          "absolute inset-0 rounded-md flex items-center justify-end pr-4 gap-2 pointer-events-none transition-opacity bg-danger text-white",
          swipeX < -10 ? "opacity-100" : "opacity-0"
        )}
        aria-hidden
      >
        <span className="font-display text-[17px] leading-tight text-fg">
          {swipeX <= SWIPE_DELETE_AT ? "Release to delete" : "Delete"}
        </span>
        <Trash2 className="size-5" />
      </div>
    <div
      onClick={(e) => {
        if (swiping) {
          e.stopPropagation();
          return;
        }
        setSelected(task.id);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        transform: `translateX(${swipeX}px)`,
        transition: swipeAnim ? "transform 200ms ease-out" : "none",
        touchAction: "pan-y",
      }}
      className={cn(
        "group flex items-start gap-3 px-3 py-2 rounded-md cursor-pointer border relative",
        swipeX !== 0 && "bg-bg",
        // Overdue: red left accent border + faint red tint (highest priority)
        !task.is_completed && task.due_at && isPast(new Date(task.due_at))
          ? isSelected
            ? "border-red-400/50 bg-red-500/10"
            : "border-l-red-400 border-l-2 border-t-transparent border-r-transparent border-b-transparent bg-red-500/5 hover:bg-red-500/10"
          // Overlapping slot: amber left accent border + faint amber tint
          : !task.is_completed && isOverlapping
          ? isSelected
            ? "border-amber-400/50 bg-amber-500/10"
            : "border-l-amber-400 border-l-2 border-t-transparent border-r-transparent border-b-transparent bg-amber-500/5 hover:bg-amber-500/10"
          : isSelected ? "bg-muted border-border" : "border-transparent hover:bg-muted/60"
      )}
    >
      <button
        aria-label={task.is_completed ? "Mark incomplete" : "Mark complete"}
        onClick={(e) => {
          e.stopPropagation();
          toggle(task);
        }}
        className={cn(
          "mt-0.5 size-5 rounded-full border-2 grid place-items-center transition-colors shrink-0",
          task.is_completed
            ? "bg-success border-success text-white"
            : task.priority >= 5
            ? "border-p-high"
            : task.priority >= 3
            ? "border-p-med"
            : task.priority >= 1
            ? "border-p-low"
            : "border-muted-fg"
        )}
      >
        {task.is_completed && (
          <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-6" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-sm truncate",
            task.is_completed && "line-through text-muted-fg"
          )}
        >
          {task.title}
          {!task.is_completed && task.due_at && isPast(new Date(task.due_at)) && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-600 dark:text-red-400 text-[10px] font-semibold uppercase tracking-wide align-middle leading-none">
              overdue
            </span>
          )}
          {!task.is_completed && isOverlapping && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-semibold uppercase tracking-wide align-middle leading-none">
              overlap
            </span>
          )}
          {shareGroupName && (
            <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent/15 text-accent text-[10px] font-medium align-middle leading-none">
              <Users className="size-2.5" aria-hidden="true" />
              {shareGroupName}
            </span>
          )}
        </div>
        <TranslatedSubtitle
          taskId={task.id}
          sourceTitle={task.title}
          shareGroupId={(task as any).share_group_id ?? null}
        />
        {/* Inline notes preview — first line, muted, truncated. */}
        {task.notes && !task.is_completed && (
          <p className="text-[13px] text-muted-fg mt-1 line-clamp-1 leading-snug">
            {task.notes}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[13px] text-muted-fg">
          {task.due_at && <DueChip due_at={task.due_at} start_at={task.start_at ?? undefined} all_day={task.is_all_day} />}
          {/* Duration: explicit start->end range wins; otherwise estimated. */}
          {(task.start_at && task.due_at && !task.is_all_day) ||
          task.estimated_pomodoros > 0 ? (
            <DurationChip task={task} />
          ) : null}
          {task.priority > 0 && (
            <span className="inline-flex items-center gap-1">
              <Flag className={cn("size-3", priorityColorClass(task.priority))} />
            </span>
          )}
          {/* Row-level scheduler triggers — a clock (quick snooze) and a
              sparkle (AI find-time). Clicking toggles an INLINE tray below the
              row (see below); no floating popover, so nothing overlaps the
              next task. Hidden on completed tasks. */}
          {!task.is_completed && (
            <SchedTrigger
              active={tray === "snooze"}
              onToggle={() => setTray((v) => (v === "snooze" ? null : "snooze"))}
            />
          )}
          {!task.is_completed && (
            <FindTimeTrigger
              task={task}
              active={tray === "findtime"}
              onToggle={() => setTray((v) => (v === "findtime" ? null : "findtime"))}
            />
          )}
          {/* Project pill — shows the list a task lives in. Hidden when
              there's no project (Inbox tasks). Same coloring scheme as
              the sidebar list dot. */}
          {project && (
            <span
              className="inline-flex items-center h-5 rounded-full px-2.5 text-[11px] leading-none"
              style={{
                backgroundColor: (project as any).color
                  ? `${(project as any).color}22`
                  : "var(--muted)",
                color: (project as any).color || "var(--muted-fg)",
                border: `1px solid ${(project as any).color || "var(--border)"}`,
              }}
              title={`In list: ${(project as any).name}`}
            >
              ~{(project as any).name}
            </span>
          )}
          {/* Tags render as color-block pills — same visual language as
              the sidebar tag list, the inline preview, and the task-detail
              tag editor, so a tag looks identical anywhere it appears. */}
          {task.tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center h-5 rounded-full px-2.5 text-[11px] leading-none"
              style={{ backgroundColor: t.color || "var(--accent)", color: "#fff" }}
            >
              {t.name}
            </span>
          ))}
          {task.rrule && (
            <span className="inline-flex items-center gap-1" title={t(lang, "taskItem.repeats")}>
              <Repeat className="size-3" />
            </span>
          )}
          {subCount && subCount.total > 0 && (
            <span className="inline-flex items-center gap-1" title={t(lang, "taskItem.subtasks")}>
              <ListTree className="size-3" /> {subCount.done}/{subCount.total}
            </span>
          )}
        </div>
        {/* Inline scheduler tray — expands *within* the row, pushing the list
            down. Never floats over the next task. */}
        {tray === "snooze" && (
          <SnoozeTray task={task} onDone={() => setTray(null)} />
        )}
        {tray === "findtime" && (
          <FindTimeTray task={task} onDone={() => setTray(null)} />
        )}
      </div>
    </div>
    </div>
  );
}

/**
 * Small always-visible trigger for the inline snooze tray. Dimmed by default,
 * brightening on row hover / when active. Toggles the tray in the parent.
 */
function SchedTrigger({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const lang = useLanguage();
  return (
    <button
      type="button"
      aria-label={t(lang, "taskPanel.snooze")}
      title={t(lang, "taskPanel.snooze")}
      aria-expanded={active}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={cn(
        "inline-flex items-center gap-1 transition-opacity hover:text-fg",
        active ? "opacity-100 text-fg" : "opacity-55 group-hover:opacity-100"
      )}
    >
      <Clock3 className="size-3" />
    </button>
  );
}

/**
 * Trigger for the inline find-time tray. Gated by the ai_find_time feature
 * flag — renders nothing when the plan can't use it. Toggling opens the tray;
 * the tray itself fires the AI request when it mounts.
 */
function FindTimeTrigger({ task, active, onToggle }: { task: TaskWithTags; active: boolean; onToggle: () => void }) {
  const lang = useLanguage();
  const canFindTime = useCanUseFeature("ai_find_time");
  if (!canFindTime) return null;
  return (
    <button
      type="button"
      aria-label={t(lang, "aiActions.findTimeTooltip")}
      title={t(lang, "aiActions.findTimeTooltip")}
      aria-expanded={active}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={cn(
        "inline-flex items-center gap-1 transition-opacity hover:text-fg",
        active ? "opacity-100 text-fg" : "opacity-55 group-hover:opacity-100"
      )}
    >
      <Sparkles className="size-3" />
    </button>
  );
}

// Shared shift logic for snooze presets.
function snoozeAnchor(task: TaskWithTags): Date {
  if (task.due_at) return new Date(task.due_at);
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * Inline snooze tray. Renders a horizontal wrap of preset chips *inside* the
 * task row (below the metadata line), so it pushes the list down instead of
 * floating over the next task. No absolute positioning, no overlap, touch-safe.
 * Preserves duration on time-blocked tasks; Weekend = coming Sat; Clear
 * unschedules. Selecting a preset applies it and closes the tray.
 */
function SnoozeTray({ task, onDone }: { task: TaskWithTags; onDone: () => void }) {
  const lang = useLanguage();
  const update = useUpdateTask();

  function applyDue(newDue: Date) {
    const patch: { id: string; start_at?: string | null; due_at: string | null; is_all_day?: boolean } = {
      id: task.id,
      due_at: newDue.toISOString(),
    };
    if (task.start_at && task.due_at) {
      const delta = newDue.getTime() - new Date(task.due_at).getTime();
      patch.start_at = new Date(new Date(task.start_at).getTime() + delta).toISOString();
    } else if (task.start_at && !task.due_at) {
      patch.start_at = newDue.toISOString();
    }
    update.mutate(patch);
    onDone();
  }
  function shiftByDays(days: number) {
    const newDue = new Date(snoozeAnchor(task).getTime());
    newDue.setDate(newDue.getDate() + days);
    applyDue(newDue);
  }
  function toWeekend() {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    let add = (6 - d.getDay() + 7) % 7;
    if (add === 0) add = 7;
    d.setDate(d.getDate() + add);
    applyDue(d);
  }
  function clearDue() {
    update.mutate({ id: task.id, due_at: null, start_at: null });
    onDone();
  }

  const chip =
    "px-2.5 py-1 rounded-full border border-border bg-muted/40 text-[12px] leading-none text-fg/90 hover:bg-muted hover:border-accent/50 transition-colors whitespace-nowrap";

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-2 flex flex-wrap items-center gap-1.5"
    >
      <button type="button" className={chip} onClick={(e) => { e.stopPropagation(); shiftByDays(1); }}>
        {t(lang, "taskPanel.snooze1d")}
      </button>
      <button type="button" className={chip} onClick={(e) => { e.stopPropagation(); shiftByDays(2); }}>
        {t(lang, "taskPanel.snooze2d")}
      </button>
      <button type="button" className={chip} onClick={(e) => { e.stopPropagation(); shiftByDays(3); }}>
        {t(lang, "taskPanel.snooze3d")}
      </button>
      <button type="button" className={chip} onClick={(e) => { e.stopPropagation(); toWeekend(); }}>
        {t(lang, "taskPanel.snoozeWeekend")}
      </button>
      <button type="button" className={chip} onClick={(e) => { e.stopPropagation(); shiftByDays(7); }}>
        {t(lang, "taskPanel.snooze1w")}
      </button>
      {task.due_at && (
        <button
          type="button"
          className={cn(chip, "text-muted-fg hover:text-danger hover:border-danger/50")}
          onClick={(e) => { e.stopPropagation(); clearDue(); }}
        >
          {t(lang, "taskPanel.snoozeClear")}
        </button>
      )}
    </div>
  );
}

/**
 * Inline find-time tray. Fires the AI find-time request on mount and renders
 * up to 3 slot chips *inside* the row (below the metadata line) — same inline,
 * non-overlapping approach as SnoozeTray. Picking a slot schedules the task.
 * On cap (429) or empty, shows a quiet inline note and self-closes on cap.
 */
function FindTimeTray({ task, onDone }: { task: TaskWithTags; onDone: () => void }) {
  const findTime = useFindTime();
  const update = useUpdateTask();
  const [slots, setSlots] = useState<TimeSlot[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    (async () => {
      try {
        const r = await findTime.mutateAsync({
          task_id: task.id,
          title: task.title,
          estimated_minutes: (task as any).estimated_minutes ?? null,
        });
        if (!r) { setNote("capped"); return; }
        setSlots(r.slots);
      } catch (e: any) {
        if (e?.message?.includes("429")) setNote("capped");
        else { toast.error("Couldn't find time — try again."); onDone(); }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applySlot(s: TimeSlot) {
    update.mutate({
      id: task.id,
      start_at: s.start_at,
      due_at: s.end_at,
      is_all_day: false,
    } as any);
    toast.success(`Scheduled — ${s.label}`);
    onDone();
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-2 flex flex-wrap items-center gap-1.5"
    >
      {findTime.isPending && (
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-fg">
          <Sparkles className="size-3 animate-pulse" /> Searching…
        </span>
      )}
      {!findTime.isPending && slots && slots.length > 0 && slots.map((s, i) => (
        <button
          key={`${s.start_at}-${i}`}
          type="button"
          onClick={(e) => { e.stopPropagation(); applySlot(s); }}
          title={new Date(s.start_at).toLocaleString(undefined, {
            weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          })}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] leading-none transition-colors whitespace-nowrap",
            s.fit === "best"
              ? "border-success/50 bg-success/10 text-success hover:bg-success/20"
              : "border-border bg-muted/40 text-fg/90 hover:bg-muted hover:border-accent/50"
          )}
        >
          <span className="font-medium">{s.label}</span>
          <span className="text-muted-fg">
            {new Date(s.start_at).toLocaleString(undefined, {
              weekday: "short", hour: "numeric", minute: "2-digit",
            })}
          </span>
        </button>
      ))}
      {!findTime.isPending && ((slots && slots.length === 0) || note === "capped") && (
        <span className="text-[12px] text-muted-fg">
          {note === "capped" ? "Daily AI limit reached." : "No open slots found."}
        </span>
      )}
    </div>
  );
}

/**
 * Duration chip — shows either an explicit time range ("10:00-11:00") when
 * the task has both start_at + due_at, or a duration ("30m" / "1h 30m")
 * derived from estimated pomodoros (each = 25 min).
 */
function DurationChip({ task }: { task: TaskWithTags }) {
  const lang = useLanguage();
  if (task.start_at && task.due_at && !task.is_all_day) {
    const s = new Date(task.start_at);
    const e = new Date(task.due_at);
    const min = Math.max(0, Math.round((+e - +s) / 60_000));
    const fmt = (d: Date) =>
      d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return (
      <span className="inline-flex items-center gap-1" title={`${min} min`}>
        <Clock className="size-3" />
        {fmt(s)}–{fmt(e)}
      </span>
    );
  }
  const est = task.estimated_pomodoros * 25;
  if (est > 0) {
    const label = est >= 60 ? `${Math.round(est / 60)}h ${est % 60 || ""}m`.trim() : `${est}m`;
    return (
      <span className="inline-flex items-center gap-1" title={t(lang, "taskItem.estimated")}>
        <Clock className="size-3" />
        {label}
      </span>
    );
  }
  return null;
}

function DueChip({ due_at, start_at, all_day }: { due_at: string; start_at?: string; all_day: boolean }) {
  const d = new Date(due_at);
  // Use start_at for the displayed time when available (shows when the task begins,
  // which is more actionable than the end/due time). Overdue logic always uses due_at.
  const displayD = start_at ? new Date(start_at) : d;
  const overdue = isPast(d);
  const label = isToday(displayD)
    ? all_day
      ? "Today"
      : `Today ${format(displayD, "h:mm a")}`
    : isTomorrow(displayD)
    ? all_day
      ? "Tomorrow"
      : `Tomorrow ${format(displayD, "h:mm a")}`
    : all_day
    ? format(displayD, "MMM d")
    : format(displayD, "MMM d, h:mm a");
  return (
    <span className={cn("inline-flex items-center gap-1", overdue && "text-danger")}>
      <Calendar className="size-3" /> {label}
    </span>
  );
}
