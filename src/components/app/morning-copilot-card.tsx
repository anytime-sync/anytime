"use client";

/**
 * Morning Co-pilot card — Round E.
 *
 * Editorial proactive briefing rendered above Daily Edition on the
 * Today view. Now collapsible: the card starts expanded but can be
 * collapsed to just kicker + headline + chevron toggle so it doesn't
 * dominate screen space once the user has read it.
 */

import { useEffect, useMemo, useState } from "react";
import { format, startOfTomorrow } from "date-fns";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CornerUpRight,
  Layers,
  Newspaper,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  useMorningCopilot,
  useRespondToCopilot,
  useUserPrefs,
  type MorningCopilotAction,
  type MorningCopilotActionKind,
} from "@/hooks/use-ai";
import { createClient } from "@/lib/supabase/client";
import { getLanguage, t, type StringKey } from "@/lib/i18n";
import { useLanguage } from "@/lib/use-language";
import { cn } from "@/lib/utils";
import { useCanUseFeature } from "@/hooks/use-feature-access";

// Map an action kind to its translation key + icon. Centralised so the
// chip and the row label stay in sync and a future kind only needs a
// single edit.
const KIND_LABEL: Record<MorningCopilotActionKind, StringKey> = {
  defer: "copilot.actionDefer",
  drop: "copilot.actionDrop",
  batch: "copilot.actionBatch",
  reschedule: "copilot.actionReschedule",
};

function ActionIcon({ kind }: { kind: MorningCopilotActionKind }) {
  switch (kind) {
    case "defer":
    case "reschedule":
      return <CornerUpRight className="size-3.5" />;
    case "drop":
      return <ArrowRight className="size-3.5 -rotate-90" />;
    case "batch":
      return <Layers className="size-3.5" />;
  }
}

export function MorningCopilotCard() {
  const aiEnabled = useCanUseFeature("ai_morning_copilot");
  const lang = useLanguage();
  const { data: prefs } = useUserPrefs();
  const locale = getLanguage(prefs?.language).dateFnsLocale;
  const { data, isLoading, isError, refetch } = useMorningCopilot();
  const respond = useRespondToCopilot();

  // Collapse state — starts expanded so the user sees the full brief
  // on first load, but can toggle it down to just the header.
  const [collapsed, setCollapsed] = useState(false);

  // Per-row checkbox state — keyed off action index. Default: every
  // suggested action is selected, mirroring the "Apply" verb's
  // affordance: the user opts OUT, not in.
  const actions = useMemo<MorningCopilotAction[]>(
    () => data?.brief?.suggested_actions ?? [],
    [data]
  );
  const [picked, setPicked] = useState<boolean[]>([]);
  useEffect(() => {
    setPicked(actions.map(() => true));
  }, [actions]);

  const [busy, setBusy] = useState(false);

  // ---- early returns ------------------------------------------------
  // AI off, dismissed, snoozed, or not yet loaded -> render nothing.
  if (!aiEnabled) return null; if (isLoading) return null;
  if (isError) {
    return (
      <article className="rounded-xl border border-border surface p-4 mb-4 text-sm text-muted-fg">
        <p>
          {t(lang, "copilot.errLoad")}{" "}
          <button
            className="underline hover:text-fg"
            onClick={() => refetch()}
          >
            {t(lang, "copilot.tryAgain")}
          </button>
        </p>
      </article>
    );
  }
  if (!data) return null;
  if (data.status !== "open") return null;
  const brief = data.brief;
  if (!brief) return null;

  // ---- mutators -----------------------------------------------------
  async function applyTaskMutations(picks: MorningCopilotAction[]): Promise<{
    applied: number;
    batched: number;
  }> {
    const supabase = createClient();
    let applied = 0;
    let batched = 0;
    const tomorrowAt9 = startOfTomorrow();
    tomorrowAt9.setHours(9, 0, 0, 0);
    const tomorrowIso = tomorrowAt9.toISOString();

    for (const action of picks) {
      try {
        if (action.kind === "defer" || action.kind === "reschedule") {
          // Fetch current task to preserve duration when shifting dates
          const { data: task } = await supabase
            .from("tasks")
            .select("start_at, due_at")
            .eq("id", action.task_id)
            .single();

          const patch: Record<string, unknown> = { is_all_day: false };

          if (task?.start_at && task?.due_at) {
            // Preserve original duration: shift both start and end
            const durationMs = new Date(task.due_at).getTime() - new Date(task.start_at).getTime();
            const newStart = tomorrowAt9;
            const newEnd = new Date(newStart.getTime() + durationMs);
            patch.start_at = newStart.toISOString();
            patch.due_at = newEnd.toISOString();
          } else if (task?.start_at && !task?.due_at) {
            // Has start but no end — shift start, leave end null
            patch.start_at = tomorrowIso;
          } else {
            // No start — just set due_at (original behavior)
            patch.due_at = tomorrowIso;
          }

          const { error } = await supabase
            .from("tasks")
            .update(patch)
            .eq("id", action.task_id);
          if (!error) applied += 1;
        } else if (action.kind === "drop") {
          const { error } = await supabase
            .from("tasks")
            .update({ priority: 0, due_at: null })
            .eq("id", action.task_id);
          if (!error) applied += 1;
        } else if (action.kind === "batch") {
          batched += 1;
          applied += 1;
        }
      } catch (err) {
        console.error("[copilot] apply failed", action, err);
      }
    }
    return { applied, batched };
  }

  function buildPicks(): {
    picks: MorningCopilotAction[];
    indexes: number[];
  } {
    const picks: MorningCopilotAction[] = [];
    const indexes: number[] = [];
    actions.forEach((a, i) => {
      if (picked[i]) {
        picks.push(a);
        indexes.push(i);
      }
    });
    return { picks, indexes };
  }

  async function handleApply() {
    if (busy) return;
    setBusy(true);
    try {
      const { picks, indexes } = buildPicks();
      const { applied, batched } =
        picks.length > 0
          ? await applyTaskMutations(picks)
          : { applied: 0, batched: 0 };
      await respond.mutateAsync({
        action: "apply",
        applied_action_indexes: indexes,
      });
      const msg = t(lang, "copilot.appliedToast").replace(
        "{n}",
        String(applied)
      );
      toast.success(msg);
      if (batched > 0) {
        toast.message(
          "Marked for batching — group these manually in Sift."
        );
      }
    } catch (err: any) {
      console.error("[copilot] apply error", err);
      toast.error(err?.message ?? "Couldn't apply");
    } finally {
      setBusy(false);
    }
  }

  async function handleSnooze() {
    if (busy) return;
    setBusy(true);
    try {
      await respond.mutateAsync({ action: "snooze" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDismiss() {
    if (busy) return;
    setBusy(true);
    try {
      await respond.mutateAsync({ action: "dismiss" });
    } finally {
      setBusy(false);
    }
  }

  // ---- render -------------------------------------------------------
  const dateLabel = format(new Date(data.local_date), "EEEE, MMMM d", {
    locale,
  });

  
  return (
    <article className="rounded-xl border border-border surface p-4 md:p-5 mb-4">
      {/* Clickable header — always visible, toggles collapse */}
      <header
        className="flex items-baseline justify-between gap-3 mb-0 cursor-pointer select-none"
        onClick={() => setCollapsed((c) => !c)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setCollapsed((c) => !c);
          }
        }}
        aria-expanded={!collapsed}
      >
        <div className="flex items-baseline gap-2 min-w-0">
          <Newspaper className="size-3.5 text-muted-fg translate-y-0.5 shrink-0" />
          <span className="editorial-number text-[10px] md:text-xs truncate uppercase tracking-wider">
            {brief.kicker}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-fg shrink-0">
          <span className="hidden sm:inline">{dateLabel}</span>
          <span className="sm:hidden">
            {format(new Date(data.local_date), "MMM d", { locale })}
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform duration-200",
              collapsed && "-rotate-90"
            )}
          />
        </div>
      </header>

      {/* Headline — always visible even when collapsed */}
      <h2
        className={cn(
          "font-display text-lg md:text-2xl leading-tight tracking-tight",
          collapsed ? "mt-1.5 mb-0" : "mt-2.5 mb-2 md:mb-3"
        )}
      >
        {brief.headline}
      </h2>

      {/* Collapsible body */}
      {!collapsed && (
        <>
          {/* Intro */}
          {brief.intro ? (
            <p className="text-[14px] md:text-[15px] leading-relaxed text-fg/90 mb-4">
              {brief.intro}
            </p>
          ) : null}

          {/* Clarifying question */}
          {brief.clarifying_question ? (
            <section className="mb-4 border-l-2 border-border pl-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-fg mb-1.5">
                {t(lang, "copilot.askLabel")}
              </p>
              <p className="text-[14px] md:text-[15px] text-fg/90 mb-3 leading-snug">
                {brief.clarifying_question}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs px-2.5 h-7 rounded-md border border-border hover:border-fg/40 hover:text-fg disabled:opacity-50"
                  onClick={handleApply}
                  disabled={busy}
                >
                  {t(lang, "copilot.askApply")}
                </button>
                <button
                  type="button"
                  className="text-xs px-2.5 h-7 rounded-md text-muted-fg hover:text-fg disabled:opacity-50"
                  onClick={handleSnooze}
                  disabled={busy}
                >
                  {t(lang, "copilot.askSkip")}
                </button>
              </div>
            </section>
          ) : null}

          {/* Suggested actions — checkbox list */}
          {actions.length > 0 ? (
            <section className="mb-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-fg mb-2">
                {t(lang, "copilot.actionsLabel")}
              </p>
              <ul className="space-y-1.5">
                {actions.map((action, i) => (
                  <li
                    key={`${action.task_id}-${i}`}
                    className="flex items-start gap-2.5 text-[13px] leading-snug"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-3.5 accent-fg cursor-pointer"
                      checked={picked[i] ?? false}
                      onChange={(e) => {
                        const next = [...picked];
                        next[i] = e.target.checked;
                        setPicked(next);
                      }}
                      aria-label={t(lang, KIND_LABEL[action.kind])}
                    />
                    <span className="inline-flex items-center gap-1.5 text-muted-fg shrink-0 mt-0.5">
                      <ActionIcon kind={action.kind} />
                      <span className="text-[11px] uppercase tracking-wide">
                        {t(lang, KIND_LABEL[action.kind])}
                      </span>
                    </span>
                    <span className="text-fg/85 flex-1 min-w-0">
                      {action.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Closing intent */}
          {brief.closing_intent ? (
            <p className="text-[12px] italic text-muted-fg border-t border-border pt-3 mt-2 mb-3">
              {brief.closing_intent}
            </p>
          ) : null}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 text-xs px-3 h-8 rounded-md",
                "bg-fg text-bg hover:opacity-90 disabled:opacity-50"
              )}
              onClick={handleApply}
              disabled={busy}
            >
              <Check className="size-3.5" />
              {busy ? t(lang, "copilot.applying") : t(lang, "copilot.apply")}
            </button>
            <button
              type="button"
              className="text-xs px-2.5 h-8 rounded-md text-muted-fg hover:text-fg disabled:opacity-50"
              onClick={handleSnooze}
              disabled={busy}
            >
              {t(lang, "copilot.snooze")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs px-2 h-8 rounded-md text-muted-fg hover:text-fg disabled:opacity-50 ml-auto"
              onClick={handleDismiss}
              disabled={busy}
              aria-label={t(lang, "copilot.dismiss")}
            >
              <X className="size-3.5" />
              <span className="hidden sm:inline">{t(lang, "copilot.dismiss")}</span>
            </button>
          </div>
        </>
      )}
    </article>
  );
}