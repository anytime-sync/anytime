"use client";

import { useEffect, useState } from "react";
import { Sparkles, Target, ListChecks, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUIStore } from "@/store/ui";
import { useCreateTask } from "@/hooks/use-tasks";
import { useLanguage } from "@/lib/use-language";
import { t as tr } from "@/lib/i18n";

/**
 * First-run welcome — shows once, on the first visit to /app/today after
 * a brand-new sign-in. Two ways to start:
 *
 *   1. "Add three things" — pre-fills three inline inputs that map to
 *      tasks_today via useCreateTask. The "minimum viable First Light".
 *
 *   2. "Plan a goal" — opens the existing Goal modal (which already does
 *      the AI-decompose dance) so the user lands in a populated weekly
 *      plan immediately.
 *
 * The modal is fully dismissible (X button or "Skip"); we still set the
 * `fl.onboardingSeen` flag in either case so it never re-shows. If the
 * user wants it again, /app/settings has a "Replay the welcome tour"
 * button that clears the flag.
 *
 * Why localStorage and not a server flag:
 *   - First-visit is per-device; new device = re-show is fine.
 *   - No round-trip on every page load.
 *   - If the user wipes storage we just show it again — harmless.
 */

const SEEN_KEY = "fl.onboardingSeen";

export function OnboardingModal() {
  const lang = useLanguage();
  const setGoalModal = useUIStore((s) => s.setGoalModalOpen);
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
    markSeen();
    setOpen(false);
  }

  async function addThree() {
    const cleaned = tasks.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      // Empty submission — just close without creating anything.
      close();
      return;
    }
    setBusy(true);
    try {
      // Sequential, not parallel — keeps the optimistic cache stable
      // and avoids a thundering herd against the create endpoint on
      // accounts with no rate-limit headroom yet.
      for (const title of cleaned) {
        await createTask.mutateAsync({
          title,
          // Default to today so they land on this exact page.
          due_at: new Date().toISOString(),
        });
      }
      toast.success(
        tr(lang, "onboarding.toast.created").replace("{n}", String(cleaned.length))
      );
      close();
    } catch (e) {
      toast.error(tr(lang, "onboarding.toast.failed"));
      console.error("[onboarding] addThree failed", e);
    } finally {
      setBusy(false);
    }
  }

  function startGoalPath() {
    markSeen();
    setOpen(false);
    // Defer one tick so the close animation completes before the Goal
    // modal animates in — otherwise both backdrops fight for z-index.
    window.setTimeout(() => setGoalModal(true), 120);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
      <div className="surface border border-border rounded-xl max-w-lg w-full p-0 relative shadow-xl overflow-hidden">
        {/* Editorial top rule — matches the rest of the app's chrome. */}
        <div className="absolute top-0 left-0 right-0 h-px bg-accent/60" />

        <button
          onClick={close}
          aria-label={tr(lang, "common.close")}
          className="absolute top-3 right-3 btn-ghost size-8 p-0 grid place-items-center text-muted-fg"
        >
          <X className="size-4" />
        </button>

        {mode === "intro" ? (
          <div className="px-8 py-9">
            <p className="editorial-number text-[11px] mb-3">
              {tr(lang, "onboarding.kicker")}
            </p>
            <h2 className="font-display text-3xl tracking-tight leading-[1.1]">
              {tr(lang, "onboarding.headline")}
              <em className="font-display">.</em>
            </h2>
            <p className="text-sm text-muted-fg mt-3 font-display italic">
              {tr(lang, "onboarding.subhead")}
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
                      {tr(lang, "onboarding.pathTasks.title")}
                    </p>
                    <p className="text-xs text-muted-fg mt-1">
                      {tr(lang, "onboarding.pathTasks.body")}
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={startGoalPath}
                className="text-left surface border border-border rounded-lg p-4 hover:border-accent/60 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="size-9 rounded-md bg-accent/15 text-accent grid place-items-center shrink-0 group-hover:bg-accent/25 transition-colors">
                    <Target className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-base leading-tight">
                      {tr(lang, "onboarding.pathGoal.title")}
                    </p>
                    <p className="text-xs text-muted-fg mt-1">
                      {tr(lang, "onboarding.pathGoal.body")}
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
                {tr(lang, "onboarding.skip")}
              </button>
              <span className="editorial-number text-[10px] text-muted-fg inline-flex items-center gap-1.5">
                <Sparkles className="size-3" />
                {tr(lang, "onboarding.footnote")}
              </span>
            </div>
          </div>
        ) : (
          <div className="px-8 py-9">
            <p className="editorial-number text-[11px] mb-3">
              {tr(lang, "onboarding.tasks.kicker")}
            </p>
            <h2 className="font-display text-3xl tracking-tight leading-[1.1]">
              {tr(lang, "onboarding.tasks.headline")}
              <em className="font-display">.</em>
            </h2>
            <p className="text-sm text-muted-fg mt-3 font-display italic">
              {tr(lang, "onboarding.tasks.subhead")}
            </p>

            <ol className="mt-6 space-y-2">
              {tasks.map((value, i) => (
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
                      if (e.key === "Enter" && i === tasks.length - 1) addThree();
                    }}
                    placeholder={tr(lang, `onboarding.tasks.placeholder.${i}`)}
                    className="input flex-1 h-9 text-sm"
                    maxLength={140}
                  />
                </li>
              ))}
            </ol>

            <div className="mt-7 flex items-center justify-between gap-3">
              <button
                onClick={() => setMode("intro")}
                className="text-xs text-muted-fg hover:text-fg underline underline-offset-2"
              >
                {tr(lang, "common.back")}
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={close}
                  className="btn-ghost h-9 px-3 text-sm"
                >
                  {tr(lang, "onboarding.skip")}
                </button>
                <button
                  onClick={addThree}
                  disabled={busy || tasks.every((s) => !s.trim())}
                  className={cn(
                    "btn-primary h-9 px-4 text-sm inline-flex items-center gap-1.5",
                    busy && "opacity-70"
                  )}
                >
                  {busy ? tr(lang, "onboarding.tasks.saving") : tr(lang, "onboarding.tasks.cta")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
