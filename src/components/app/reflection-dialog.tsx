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

/**
 * End-of-day reflection. Renders inside a modal triggered from the
 * sidebar/footer or a Today header button. Generates on first open
 * each day, then caches in daily_reflections.
 */
export function ReflectionDialog() {
  const open = useUIStore((s) => s.reflectionOpen);
  const setOpen = useUIStore((s) => s.setReflectionOpen);
  const reflect = useReflection();
  const saveJournal = useSaveReflectionJournal();
  const update = useUpdateTask();
  const { data: allTasks = [] } = useTasks({});
  const [data, setData] = useState<Reflection | null>(null);
  const [journal, setJournal] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setData(null);
    reflect
      .mutateAsync()
      .then((r) => {
        if (!r) {
          toast.error("AI is currently disabled.");
          setOpen(false);
          return;
        }
        setData(r);
        setJournal(r.user_journal ?? "");
      })
      .catch(() => toast.error("Couldn't load reflection"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function carryForward(id: string) {
    const tomorrow = addDays(new Date(), 1);
    tomorrow.setHours(23, 59, 0, 0);
    update.mutate({ id, due_at: tomorrow.toISOString() } as any);
    toast.message("Rolled to tomorrow");
  }
  function dropTask(id: string) {
    update.mutate({ id, due_at: null, priority: 0 } as any);
    toast.message("Cleared from today");
  }
  function carryAll() {
    if (!data?.carry_forward_ids?.length) return;
    for (const id of data.carry_forward_ids) carryForward(id);
  }
  async function saveJ() {
    try {
      await saveJournal.mutateAsync(journal);
      toast.success("Saved");
    } catch {
      toast.error("Couldn't save journal");
    }
  }

  const titleFor = (id: string) =>
    allTasks.find((t) => t.id === id)?.title ?? "(unknown)";

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
          <h2 className="font-display text-3xl">Today, in retrospect</h2>
          <span className="editorial-number text-sm text-muted-fg">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        {loading && (
          <p className="text-lg text-muted-fg italic">Reading the day…</p>
        )}

        {data && (
          <>
            <h3 className="font-display text-2xl leading-snug mb-3">
              {data.headline}
            </h3>
            <p className="text-lg text-fg leading-relaxed italic font-display mb-5">
              {data.body}
            </p>

            {data.carry_forward_ids.length > 0 && (
              <section className="mb-4">
                <div className="flex items-baseline justify-between mb-2">
                  <h4 className="text-sm uppercase tracking-wider text-muted-fg">
                    Carry to tomorrow
                  </h4>
                  <button
                    onClick={carryAll}
                    className="text-base text-muted-fg hover:text-fg underline"
                  >
                    Roll all →
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {data.carry_forward_ids.map((id) => (
                    <li
                      key={id}
                      className="border border-border rounded-md p-3 flex items-center gap-2 text-base leading-relaxed"
                    >
                      <span className="flex-1 min-w-0 truncate">{titleFor(id)}</span>
                      <button
                        onClick={() => carryForward(id)}
                        className="btn-ghost size-7 grid place-items-center text-success"
                        title="Roll to tomorrow"
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
                <h4 className="text-sm uppercase tracking-wider text-muted-fg mb-2">
                  Worth dropping
                </h4>
                <ul className="space-y-1.5">
                  {data.drop_suggestions_ids.map((id) => (
                    <li
                      key={id}
                      className="border border-border rounded-md p-3 flex items-center gap-2 text-base leading-relaxed"
                    >
                      <span className="flex-1 min-w-0 truncate">{titleFor(id)}</span>
                      <button
                        onClick={() => dropTask(id)}
                        className="btn-ghost size-7 grid place-items-center text-warning"
                        title="Clear"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-4">
              <h4 className="text-sm uppercase tracking-wider text-muted-fg mb-2">
                Notes to yourself
              </h4>
              <textarea
                rows={3}
                className="input w-full text-lg leading-relaxed py-2.5"
                placeholder="One sentence about today, if you'd like."
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                onBlur={saveJ}
              />
            </section>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="btn-ghost h-10 px-4 text-base"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
