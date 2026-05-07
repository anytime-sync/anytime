"use client";

import { useTasks, type TasksFilter, type TaskWithTags } from "@/hooks/use-tasks";
import { TaskItem } from "./task-item";
import { useUIStore } from "@/store/ui";
import { Plus, ArrowDownUp } from "lucide-react";
import { useEffect, useState } from "react";
import { InlineTaskInput } from "./inline-task-input";
import { SortableTaskList } from "./sortable-task-list";
import { DailyEdition } from "./daily-edition";
import { AntiOverloadBanner } from "./anti-overload-banner";
import { useLanguage } from "@/lib/use-language";
import { t as tr } from "@/lib/i18n";

type Props = {
  title: string;
  subtitle?: string;
  filter: TasksFilter;
  defaults?: { project_id?: string | null };
  /** Show the AI Daily Edition card and anti-overload banner (Today view). */
  showDailyEdition?: boolean;
  /** Optional content rendered above the inline-task-input — used by
   *  Today to show the streak ribbon (current streak, habits today,
   *  Q1 count). Renders right under any DailyEdition card. */
  prelude?: React.ReactNode;
  /** Optional element rendered to the right of the Quick add button —
   *  used by Today to show its List/Timeline toggle. */
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
  /** Split incomplete tasks into date-bucket sections (Today / Tomorrow /
   *  Next 7 days / Next 90 days / No date). Each section is its own
   *  SortableTaskList — drag-to-reorder still works within a bucket. */
  groupByDate?: boolean;
};

/** Sort tasks ascending by due_at; tasks without a due_at fall to the
 *  bottom in stable creation order. */
function byDueAtAsc(a: TaskWithTags, b: TaskWithTags): number {
  const ad = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
  const bd = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
  if (ad !== bd) return ad - bd;
  // Stable tiebreak — older created first when due_at matches or both are null.
  const ac = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bc = b.created_at ? new Date(b.created_at).getTime() : 0;
  return ac - bc;
}

function readSortOverride(sortKey?: string): "manual" | null {
  if (!sortKey || typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(`fl.sort.${sortKey}`);
    return v === "manual" ? "manual" : null;
  } catch {
    return null;
  }
}

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
  const { data: tasks = [], isLoading } = useTasks(filter);
  const lang = useLanguage();
  const setQuickAdd = useUIStore((s) => s.setQuickAddOpen);
  const [showCompleted, setShowCompleted] = useState(false);

  // Manual-override flag: only meaningful when default is "due_at".
  // Hydrate from localStorage on the client (SSR-safe — start as null).
  const [manualOverride, setManualOverride] = useState<"manual" | null>(null);
  useEffect(() => {
    setManualOverride(readSortOverride(sortKey));
  }, [sortKey]);

  // Effective sort mode for THIS render. When the user has dragged in a
  // date-based view, we honor their hand-arrangement until they explicitly
  // revert via the "Sort by date" chip.
  const effectiveSort: "manual" | "due_at" =
    sortBy === "due_at" && manualOverride !== "manual" ? "due_at" : "manual";

  let incomplete = tasks.filter((t) => !t.is_completed);
  const completed = tasks.filter((t) => t.is_completed);

  if (effectiveSort === "due_at") {
    incomplete = [...incomplete].sort(byDueAtAsc);
  }
  // In manual mode, useTasks already returns rows ordered by `position`,
  // so no further sort is needed.

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

  // Show the revert chip only when (a) the view defaults to date-sort and
  // (b) the user has actively flipped it to manual on this device.
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
            {/* Icon-only on mobile so a long title (e.g. "Last week's
                edition", multi-word l10n strings) gets the room it needs. */}
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
            <DailyEdition />
            <AntiOverloadBanner />
          </div>
        )}
        {prelude && <div className="px-3">{prelude}</div>}
        <InlineTaskInput defaultProjectId={defaults?.project_id ?? null} />

        {isLoading ? (
          <div className="text-sm text-muted-fg px-3">{tr(lang, "taskList.loading")}</div>
        ) : incomplete.length === 0 && completed.length === 0 ? (
          <div className="px-3 py-12 text-center text-muted-fg">
            <div className="text-3xl mb-2 font-display"><em>—</em></div>
            <p className="text-sm">{tr(lang, "taskList.emptyHint")}</p>
          </div>
        ) : null}

        {/* Always wrap in SortableTaskList so drag works in every view.
            In date-sorted views, dragging flips the view to manual mode
            (per-device, via localStorage) — the new positions stick and
            the "Sort by date" chip appears to revert. */}
        {groupByDate ? (
          <GroupedSections
            tasks={incomplete}
            lang={lang}
            onManualReorder={
              sortBy === "due_at" && manualOverride !== "manual"
                ? flipToManual
                : undefined
            }
          />
        ) : (
          <SortableTaskList
            tasks={incomplete}
            onManualReorder={
              sortBy === "due_at" && manualOverride !== "manual"
                ? flipToManual
                : undefined
            }
          />
        )}

        {completed.length > 0 && (
          <div className="pt-4">
            <button
              className="px-3 text-xs text-muted-fg hover:text-fg"
              onClick={() => setShowCompleted((v) => !v)}
            >
              {showCompleted ? "Hide" : "Show"} completed ({completed.length})
            </button>
            {showCompleted &&
              completed.map((t) => <TaskItem key={t.id} task={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}


/**
 * Date-bucket grouping for views that opt in via `groupByDate`. Splits
 * incomplete tasks into editorial sections that read like a small
 * calendar. Each bucket renders its own SortableTaskList so
 * drag-to-reorder still works within a section without leaking across
 * boundaries. Section titles use the i18n table.
 */
function GroupedSections({
  tasks,
  onManualReorder,
  lang,
}: {
  tasks: TaskWithTags[];
  onManualReorder?: () => void;
  lang: import("@/lib/i18n").LanguageCode;
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

  const today: TaskWithTags[] = [];
  const tomorrow: TaskWithTags[] = [];
  const next7: TaskWithTags[] = [];
  const next90: TaskWithTags[] = [];
  const noDate: TaskWithTags[] = [];

  for (const tk of tasks) {
    if (!tk.due_at) {
      noDate.push(tk);
      continue;
    }
    const d = new Date(tk.due_at);
    if (d < startTomorrow) today.push(tk);
    else if (d < startDayAfter) tomorrow.push(tk);
    else if (d < startIn7) next7.push(tk);
    else if (d < startIn90) next90.push(tk);
    else noDate.push(tk);
  }

  const sortBucket = (a: TaskWithTags, b: TaskWithTags) => {
    const ad = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bd = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    return (a.created_at ? new Date(a.created_at).getTime() : 0) -
      (b.created_at ? new Date(b.created_at).getTime() : 0);
  };
  today.sort(sortBucket);
  tomorrow.sort(sortBucket);
  next7.sort(sortBucket);
  next90.sort(sortBucket);

  return (
    <div className="space-y-4">
      <Section title={tr(lang, "sidebar.today")} tasks={today} onManualReorder={onManualReorder} />
      <Section title={tr(lang, "sidebar.tomorrow")} tasks={tomorrow} onManualReorder={onManualReorder} />
      <Section title={tr(lang, "sidebar.next7")} tasks={next7} onManualReorder={onManualReorder} />
      <Section title={tr(lang, "sidebar.next90")} tasks={next90} onManualReorder={onManualReorder} />
      <Section title={tr(lang, "view.bucket.noDate")} tasks={noDate} onManualReorder={onManualReorder} />
    </div>
  );
}

function Section({
  title,
  tasks,
  onManualReorder,
}: {
  title: string;
  tasks: TaskWithTags[];
  onManualReorder?: () => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="px-3 pt-1 flex items-baseline gap-2">
        <p className="editorial-number text-[10px] uppercase tracking-[0.18em] text-muted-fg">
          {title}
        </p>
        <span className="text-[10px] text-muted-fg/70 tabular-nums">
          ({tasks.length})
        </span>
      </div>
      <SortableTaskList tasks={tasks} onManualReorder={onManualReorder} />
    </div>
  );
}
