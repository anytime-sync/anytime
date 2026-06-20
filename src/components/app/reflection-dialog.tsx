"use client";

import { useEffect, useState } from "react";
import { Sparkles, Check, ArrowRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addDays } from "date-fns";
import {
  useReflection,
  useSaveReflectionJournal,
  type Reflection,
} from "@/hooks/use-ai";
import { useTasks, useUpdateTask } from "@/hooks/use-tasks";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { t as tr } from "@/lib/i18n";

/**
 * End-of-day reflection. Renders inside a modal triggered from the
 * sidebar/footer or a Today header button. Generates on first open
 * each day, then caches in daily_reflections.
 */
export function ReflectionDialog() {
  const lang = useLanguage();
  const open = useUIStore((s) => s.reflectionOpen);
  const setOpen = useUIStore((s) => s.setReflectionOpen);
  const reflect = useReflection();
  const saveJournal = useSaveReflectionJournal();
  const update = useUpdateTask();
  const { data: allTasks = [] } = useTasks({});
  const [data, setData] = useState<Reflection | null>(null);
  const [journal, setJournal] = useState("");
  const [loading, setLoading] = useState(false);

  // "Connected the dots" — single-sentence pattern across the user's last
  // few reflections. Fetched lazily once the daily reflection has loaded,
  // so the dialog never blocks on this slower call.
  const [patternInsight, setPatternInsight] = useState<string | null>(null);
  const [patternLoading, setPatternLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setData(null);
    reflect
      .mutateAsync()
      .then((r) => {
        if (!r) {
          toast.error(tr(lang, "common.aiDisabled"));
          setOpen(false);
          return;
        }
        setData(r);
        setJournal(r.user_journal ?? "");
        // Fire pattern fetch in the background — purely additive,
        // never blocks the main reflection rendering.
        setPatternLoading(true);
        setPatternInsight(null);
        fetch("/api/ai/reflection-patterns", { cache: "no-store" })
          .then((res) => (res.ok ? res.json() : null))
          .then((j) => {
            if (j && typeof j.insight === "string") setPatternInsight(j.insight);
          })
          .catch(() => {})
          .finally(() => setPatternLoading(false));
      })
      .catch(() => toast.error(tr(lang, "reflect.errLoad")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function carryForward(id: string) {
    const tomorrow = addDays(new Date(), 1);
    tomorrow.setHours(9, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow); tomorrowEnd.setHours(9, 30, 0, 0);
    update.mutate({ id, start_at: tomorrow.toISOString(), due_at: tomorrowEnd.toISOString() } as any);
    toast.message(tr(lang, "reflect.toastRolled"));
  }
  function dropTask(id: string) {
    update.mutate({ id, due_at: null, start_at: null, priority: 0 } as any);
    toast.message(tr(lang, "reflect.toastCleared"));
  }
  function carryAll() {
    if (!data?.carry_forward_ids?.length) return;
    for (const id of data.carry_forward_ids) carryForward(id);
  }
  async function saveJ() {
    try {
      await saveJournal.mutateAsync(journal);
      toast.success(tr(lang, "reflect.toastSaved"));
    } catch {
      toast.error(tr(lang, "reflect.errSaveJournal"));
    }
  }

  const titleFor = (id: string) =>
    allTasks.find((t) => t.id === id)?.title ?? tr(lang, "common.unknown");

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 animate-fade-in px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="card max-w-xl w-full p-5 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-3xl">{tr(lang, "reflect.title")}</h2>
          <span className="editorial-number text-xs text-muted-fg">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        {loading && (
          <p className="text-sm text-muted-fg italic">{tr(lang, "reflect.reading")}</p>
        )}

        {data && (
          <>
            <h3 className="font-display text-xl leading-snug mb-2">
              {data.headline}
            </h3>
            <p className="text-lg text-muted-fg leading-relaxed font-display mb-4">
              {data.body}
            </p>

            {data.carry_forward_ids.length > 0 && (
              <section className="mb-4">
                <div className="flex items-baseline justify-between mb-2">
                  <h4 className="text-xs uppercase tracking-wider text-muted-fg">
                    {tr(lang, "reflect.carryHeading")}
                  </h4>
                  <button
                    onClick={carryAll}
                    className="text-xs text-muted-fg hover:text-fg underline"
                  >
                    {tr(lang, "reflect.rollAll")}
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {data.carry_forward_ids.map((id) => (
                    <li
                      key={id}
                      className="border border-border rounded-md p-2 flex items-center gap-2 text-sm"
                    >
                      <span className="flex-1 min-w-0 truncate">{titleFor(id)}</span>
                      <button
                        onClick={() => carryForward(id)}
                        className="btn-ghost size-7 grid place-items-center text-success"
                        title={tr(lang, "reflect.rollOne")}
                      >
                        <ArrowRight className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.drop_suggestions_ids.length > 0 && (
              <section className="mb-4">
                <h4 className="text-xs uppercase tracking-wider text-muted-fg mb-2">
                  {tr(lang, "reflect.dropHeading")}
                </h4>
                <ul className="space-y-1.5">
                  {data.drop_suggestions_ids.map((id) => (
                    <li
                      key={id}
                      className="border border-border rounded-md p-2 flex items-center gap-2 text-sm"
                    >
                      <span className="flex-1 min-w-0 truncate">{titleFor(id)}</span>
                      <button
                        onClick={() => dropTask(id)}
                        className="btn-ghost size-7 grid place-items-center text-warning"
                        title={tr(lang, "reflect.clearOne")}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(patternLoading || patternInsight) && (
              <section className="mt-4 rounded-md border border-accent/30 bg-accent/5 px-3 py-2.5">
                <p className="text-[10px] tracking-[0.22em] uppercase text-stone-500 mb-1.5">
                  AI · Connected the dots
                </p>
                {patternLoading ? (
                  <p className="text-sm text-muted-fg italic">Reading the last few reflections…</p>
                ) : (
                  <p className="text-base leading-snug text-stone-800 font-display italic">
                    {patternInsight}
                  </p>
                )}
              </section>
            )}

            <section className="mt-4">
              <h4 className="text-xs uppercase tracking-wider text-muted-fg mb-2">
                {tr(lang, "reflect.notesHeading")}
              </h4>
              <textarea
                rows={3}
                className="input w-full text-sm"
                placeholder={tr(lang, "reflect.notesPlaceholder")}
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                onBlur={saveJ}
              />
            </section>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="btn-ghost h-9 px-3 text-xs"
                onClick={() => setOpen(false)}
              >
                {tr(lang, "reflect.close")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
