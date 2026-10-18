"use client";

import { useEffect, useRef, useState } from "react";
import { ListChecks, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { useLanguage } from "@/lib/use-language";
import { onboardingCopy } from "@/lib/onboarding-copy";
import { useCreateTask } from "@/hooks/use-tasks";

/** A dismissible first-run task capture flow. Saved fields clear before retry. */
const SEEN_KEY = "fl.onboardingSeen";

export function OnboardingModal() {
  const copy = onboardingCopy(useLanguage());
  const saving = useRef(false);
  const createTask = useCreateTask();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"intro" | "tasks">("intro");
  const [tasks, setTasks] = useState<[string, string, string]>(["", "", ""]);
  const [busy, setBusy] = useState(false);

  // Show on mount if the flag isn't set. Defer one tick so the page
  // skeleton renders behind the modal instead of next to it.
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const seen = window.localStorage.getItem(SEEN_KEY);
      if (!seen) {
        const id = window.setTimeout(() => setOpen(true), 250);
        return () => window.clearTimeout(id);
      }
    } catch {
      // localStorage blocked — fail open (don't show), don't crash.
    }
  }, []);

  function markSeen() {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }

  function close() {
    if (saving.current) return;
    markSeen();
    setOpen(false);
  }

  async function addThree() {
    if (saving.current) return;
    const pending = tasks.map((title, index) => ({ title: title.trim(), index })).filter(t => t.title);
    if (!pending.length) return;
    saving.current = true;
    setBusy(true);
    try {
      for (const { title, index } of pending) {
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        await createTask.mutateAsync({ title, due_at: endOfToday.toISOString(), start_at: null, is_all_day: true });
        setTasks(previous => {
          const remaining = [...previous] as [string, string, string];
          remaining[index] = "";
          return remaining;
        });
      }
      toast.success(copy.saved);
      markSeen();
      setOpen(false);
    } catch (e) {
      toast.error(copy.error);
      console.error("[onboarding] addThree failed", e);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const dialogRef = useDialogFocus(open, close);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={copy.welcome} tabIndex={-1} className="surface border border-border rounded-xl max-w-lg w-full p-0 relative shadow-xl max-h-[90dvh] overflow-y-auto">
        {/* Editorial top rule — matches the rest of the app's chrome. */}
        <div className="absolute top-0 left-0 right-0 h-px bg-accent/60" />

        <button
          onClick={close}
          aria-label={copy.close}
          disabled={busy}
          className="absolute top-3 right-3 btn-ghost size-8 p-0 grid place-items-center text-muted-fg"
        >
          <X className="size-4" />
        </button>

        {mode === "intro" ? (
          <div className="px-5 sm:px-8 py-9">
            <p className="editorial-number text-[11px] mb-3">
              {copy.welcome}
            </p>
            <h2 className="font-display text-3xl tracking-tight leading-[1.1]">
              {copy.title}
            </h2>
            <p className="text-sm text-muted-fg mt-3 font-display italic">
              {copy.subtitle}
            </p>

            <div className="mt-7 grid gap-3">
              <button
                onClick={() => setMode("tasks")}
                className="text-left surface border border-border rounded-lg p-4 hover:border-accent/60 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="size-9 rounded-md bg-accent/15 text-accent grid place-items-center shrink-0 group-hover:bg-accent/25 transition-colors">
                    <ListChecks className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-base leading-tight">
                      {copy.action}
                    </p>
                    <p className="text-xs text-muted-fg mt-1">
                      {copy.detail}
                    </p>
                  </div>
                </div>
              </button>


            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={close}
                className="text-xs text-muted-fg hover:text-fg underline underline-offset-2"
              >
                {copy.skip}
              </button>

            </div>
          </div>
        ) : (
          <div className="px-5 sm:px-8 py-9">
            <p className="editorial-number text-[11px] mb-3">
              {copy.welcome}
            </p>
            <h2 className="font-display text-3xl tracking-tight leading-[1.1]">
              {copy.tasksTitle}
            </h2>
            <p className="text-sm text-muted-fg mt-3 font-display italic">
              {copy.hint}
            </p>

            <ol className="mt-6 space-y-2">
              {tasks.map((value, i) => {
                const placeholders = copy.examples;
                return (
                  <li key={i} className="flex items-center gap-3">
                    <span className="editorial-number text-[10px] text-muted-fg w-4 text-right shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <input
                      autoFocus={i === 0}
                      value={value}
                      onChange={(e) =>
                        setTasks((prev) => {
                          const next = [...prev] as [string, string, string];
                          next[i] = e.target.value;
                        return next;
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); void addThree(); }
                      }}
                      placeholder={placeholders[i]}
                      aria-label={placeholders[i]}
                      disabled={busy}
                      className="input min-w-0 flex-1 h-9 text-sm"
                      maxLength={140}
                    />
                  </li>
                );
              })}
            </ol>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              <button
                disabled={busy}
                onClick={() => setMode("intro")}
                className="text-xs text-muted-fg hover:text-fg underline underline-offset-2"
              >
                {copy.back}
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={close}
                  disabled={busy}
                  className="btn-ghost h-9 px-3 text-sm"
                >
                  {copy.skip}
                </button>
                <button
                  onClick={addThree}
                  disabled={busy || tasks.every((s) => !s.trim())}
                  className={cn(
                    "btn-primary h-9 px-4 text-sm inline-flex items-center gap-1.5",
                    busy && "opacity-70"
                  )}
                >
                  {busy ? copy.adding : copy.add}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
