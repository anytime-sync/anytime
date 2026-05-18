"use client";

import { type TasksFilter, type TaskWithTags } from "@/hooks/use-tasks";
import { useViewItems, type ViewItem, byTimeAsc } from "@/hooks/use-view-items";
import { TaskItem } from "./task-item";
import { useUIStore } from "@/store/ui";
import { Plus, ArrowDownUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InlineTaskInput } from "./inline-task-input";
import { SortableMixedList } from "./sortable-mixed-list";
import { DailyEdition } from "./daily-edition";
import { MorningCopilotCard } from "./morning-copilot-card";
import { AntiOverloadBanner } from "./anti-overload-banner";
import { useLanguage } from "@/lib/use-language";
import { t as tr } from "@/lib/i18n";

type Props = {
  title: string;
  subtitle?: string;
  filter: TasksFilter;
  defaults?: { project_id?: string | null; due_at?: string | null };
  /** Show the AI Daily Edition card and anti-overload banner (Today view). */
  showDailyEdition?: boolean;
  /** Optional content rendered above the inline-task-input. */
  prelude?: React.ReactNode;
  /** Optional element rendered to the right of the Quick add button. */
  headerExtra?: React.ReactNode;
  /** Default sort. "manual" keeps drag-to-reorder against stored positions
   *  (Inbox / project lists). "due_at" sorts by deadline ascending —
   *  Today, Tomorrow, Next 7, Next 90. In due_at mode the user can still
   *  drag to override; the override is remembered per-device under
   *  `sortKey` and a "Sort by date" chip appears to revert. */
  sortBy?: "manual" | "due_at";
  /** localStorage key suffix (e.g. "today", "tomorrow"). Required when
   *  sortBy="due_at" so the manual-override flag can persist per view. */
  sortKey?: string;
  /** Split incomplete items into date-bucket sections (Today / Tomorrow /
   *  Next 7 days / Next 90 days / No date). Each section is its own
   *  SortableMixedList — drag-to-reorder still works within a bucket. */
  groupByDate?: boolean;
};

function readSortOverride(sortKey?: string): "manual" | null {
  if (!sortKey || typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(`fl.sort.${sortKey}`);
    return v === "manual" ? "manual" : null;
  } catch {
    return null;
  }
}

/**
 * Round F v4.3: TaskListView consumes useViewItems so Google Calendar
 * events render alongside tasks in the same flat list, sorted by start/due
 * time. Events are non-draggable; only tasks reorder.
 *
 * Completed-task drawer at the bottom is unchanged — events don't have a
 * "completed" state in the local DB and aren't included there.
 *
 * `groupByDate` still works for Inbox / Next 90 — events get bucketed
 * into Today / Tomorrow / Next 7 / Next 90 / No date alongside tasks.
 */
export function TaskListView({
  title,
  subtitle,
  filter,
  defaults,
  showDailyEdition,
  prelude,
  headerExtra,
  sortBy = "manual",
  sortKey,
  groupByDate = false,
}: Props) {
  const { items, isLoading } = useViewItems(filter);
  const lang = useLanguage();
  const setQuickAdd = useUIStore((s) => s.setQuickAddOpen);
  const [showCompleted, setShowCompleted] = useState(false);

  const [manualOverride, setManualOverride] = useState<"manual" | null>(null);
  useEffect(() => {
    setManualOverride(readSortOverride(sortKey));
  }, [sortKey]);

  const effectiveSort: "manual" | "due_at" =
    sortBy === "due_at" && manualOverride !== "manual" ? "due_at" : "manual";

  const incompleteItems = items.filter((it) =>
    it.kind === "task" ? !it.task.is_completed : true
  );
  const completedTasks: TaskWithTags[] = items
    .filter((it): it is Extract<ViewItem, { kind: "task" }> => it.kind === "task")
    .filter((it) => it.task.is_completed)
    .map((it) => it.task);

  const renderItems = useMemo(() => {
    if (effectiveSort === "due_at") {
      return [...incompleteItems].sort(byTimeAsc);
    }
    // Manual mode: tasks keep stored position order; events are spliced in
    // by sortAt so they slot into the right place by date even with hand-
    // arranged tasks.
    const tasks = incompleteItems.filter((it) => it.kind === "task");
    const events = incompleteItems
      .filter((it) => it.kind === "event")
      .sort(byTimeAsc);
    if (events.length === 0) return tasks;

    const out: ViewItem[] = [];
    let ti = 0;
    let ei = 0;
    while (ti < tasks.length || ei < events.length) {
      const t = tasks[ti];
      const e = events[ei];
      if (!t) {
        out.push(e);
        ei++;
      } else if (!e) {
        out.push(t);
        ti++;
      } else if (t.sortAt <= e.sortAt) {
        out.push(t);
        ti++;
      } else {
        out.push(e);
        ei++;
      }
    }
    return out;
  }, [incompleteItems, effectiveSort]);

  function flipToManual() {
    if (!sortKey) return;
    try {
      window.localStorage.setItem(`fl.sort.${sortKey}`, "manual");
    } catch {}
    setManualOverride("manual");
  }

  function revertToDateSort() {
    if (!sortKey) return;
    try {
      window.localStorage.removeItem(`fl.sort.${sortKey}`);
    } catch {}
    setManualOverride(null);
  }

  const showRevertChip = sortBy === "due_at" && manualOverride === "manual";

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl md:text-4xl tracking-tight truncate leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-fg mt-1 truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showRevertChip && (
              <button
                onClick={revertToDateSort}
                className="inline-flex items-center gap-1.5 text-[11px] md:text-xs px-2 h-7 rounded-md border border-border text-muted-fg hover:text-fg hover:border-fg/40 whitespace-nowrap"
                title={tr(lang, "taskList.revertSort")}
              >
                <ArrowDownUp className="size-3" />
                <span className="hidden sm:inline">{tr(lang, "taskList.sortByDate")}</span>
                <span className="sm:hidden">Date</span>
              </button>
            )}
            {headerExtra}
            <button
              className="btn-ghost gap-2 px-2 md:px-3"
              onClick={() => setQuickAdd(true)}
              aria-label={tr(lang, "shared.quickAdd")}
              title={tr(lang, "shared.quickAdd")}
            >
              <Plus className="size-4" />
              <span className="hidden md:inline">{tr(lang, "shared.quickAdd")}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 md:px-3 py-3 space-y-3">
        {showDailyEdition && (
          <div className="px-3">
            <MorningCopilotCard />
            <DailyEdition />
            <AntiOverloadBanner />
          </div>
        )}
        {prelude && <div className="px-3">{prelude}</div>}
        <InlineTaskInput
          defaultProjectId={defaults?.project_id ?? null}
          defaultDueAt={defaults?.due_at ?? null}
        />

        {isLoading ? (
          <div className="text-sm text-muted-fg px-3">{tr(lang, "taskList.loading")}</div>
        ) : renderItems.length === 0 && completedTasks.length === 0 ? (
          <div className="px-3 py-12 text-center text-muted-fg">
            <div className="text-3xl mb-2 font-display"><em>—</em></div>
            <p className="text-sm">{tr(lang, "taskList.emptyHint")}</p>
          </div>
        ) : null}

        {groupByDate ? (
          <GroupedSections
            items={renderItems}
            lang={lang}
            onManualReorder={
              sortBy === "due_at" && manualOverride !== "manual"
                ? flipToManual
                : undefined
            }
          />
        ) : (
          <SortableMixedList
            items={renderItems}
            lang={lang}
            onManualReorder={
              sortBy === "due_at" && manualOverride !== "manual"
                ? flipToManual
                : undefined
            }
          />
        )}

        {completedTasks.length > 0 && (
          <div className="pt-4">
            <button
              className="px-3 text-xs text-muted-fg hover:text-fg"
              onClick={() => setShowCompleted((v) => !v)}
            >
              {showCompleted ? "Hide" : "Show"} completed ({completedTasks.length})
            </button>
            {showCompleted &&
              completedTasks.map((t) => <TaskItem key={t.id} task={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Date-bucket grouping for views that opt in via `groupByDate`. Splits
 * incomplete items into editorial sections that read like a small
 * calendar. Each bucket renders its own SortableMixedList so drag-to-
 * reorder still works within a section without leaking across boundaries.
 */
function GroupedSections({
  items,
  lang,
  onManualReorder,
}: {
  items: ViewItem[];
  lang: import("@/lib/i18n").LanguageCode | string;
  onManualReorder?: () => void;
}) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);
  const startDayAfter = new Date(startTomorrow);
  startDayAfter.setDate(startDayAfter.getDate() + 1);
  const startIn7 = new Date(startToday);
  startIn7.setDate(startIn7.getDate() + 7);
  const startIn90 = new Date(startToday);
  startIn90.setDate(startIn90.getDate() + 90);

  const today: ViewItem[] = [];
  const tomorrow: ViewItem[] = [];
  const next7: ViewItem[] = [];
  const next90: ViewItem[] = [];
  const noDate: ViewItem[] = [];

  for (const it of items) {
    const stamp = it.sortAt;
    if (!Number.isFinite(stamp)) {
      noDate.push(it);
      continue;
    }
    const d = new Date(stamp);
    if (d < startTomorrow) today.push(it);
    else if (d < startDayAfter) tomorrow.push(it);
    else if (d < startIn7) next7.push(it);
    else if (d < startIn90) next90.push(it);
    else noDate.push(it);
  }

  today.sort(byTimeAsc);
  tomorrow.sort(byTimeAsc);
  next7.sort(byTimeAsc);
  next90.sort(byTimeAsc);

  return (
    <div className="space-y-4">
      <Section title={tr(lang as any, "sidebar.today")} items={today} lang={lang} onManualReorder={onManualReorder} />
      <Section title={tr(lang as any, "sidebar.tomorrow")} items={tomorrow} lang={lang} onManualReorder={onManualReorder} />
      <Section title={tr(lang as any, "sidebar.next7")} items={next7} lang={lang} onManualReorder={onManualReorder} />
      <Section title={tr(lang as any, "sidebar.next90")} items={next90} lang={lang} onManualReorder={onManualReorder} />
      <Section title={tr(lang as any, "view.bucket.noDate")} items={noDate} lang={lang} onManualReorder={onManualReorder} />
    </div>
  );
}

function Section({
  title,
  items,
  lang,
  onManualReorder,
}: {
  title: string;
  items: ViewItem[];
  lang: import("@/lib/i18n").LanguageCode | string;
  onManualReorder?: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="px-3 pt-1 flex items-baseline gap-2">
        <p className="editorial-number text-[10px] uppercase tracking-[0.18em] text-muted-fg">
          {title}
        </p>
        <span className="text-[10px] text-muted-fg/70 tabular-nums">
          ({items.length})
        </span>
      </div>
      <SortableMixedList items={items} lang={lang} onManualReorder={onManualReorder} />
    </div>
  );
}
