"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTasks } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLanguage } from "@/lib/use-language";
import { t as tr } from "@/lib/i18n";

type Phase = "focus" | "short_break" | "long_break";

const DEFAULTS: Record<Phase, number> = {
  focus: 25 * 60,
  short_break: 5 * 60,
  long_break: 15 * 60,
};

export default function PomodoroPage() {
  const lang = useLanguage();
  const [phase, setPhase] = useState<Phase>("focus");
  const [seconds, setSeconds] = useState(DEFAULTS.focus);
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [completedToday, setCompletedToday] = useState(0);
  const startedAtRef = useRef<Date | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: tasks = [] } = useTasks();

  // tick
  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            window.clearInterval(tickRef.current!);
            tickRef.current = null;
            handleFinish();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase]);

  // load today's count
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("pomodoro_sessions")
        .select("id")
        .eq("kind", "focus")
        .eq("completed", true)
        .gte("started_at", start.toISOString());
      if (!error) setCompletedToday(data?.length ?? 0);
    })();
  }, [phase]);

  const total = DEFAULTS[phase];
  const pct = ((total - seconds) / total) * 100;
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");

  function start() {
    if (!running) startedAtRef.current = new Date();
    setRunning(true);
  }
  function pause() {
    setRunning(false);
  }
  function reset() {
    setRunning(false);
    setSeconds(DEFAULTS[phase]);
    startedAtRef.current = null;
  }
  function stop() {
    setRunning(false);
    setSeconds(DEFAULTS[phase]);
    startedAtRef.current = null;
  }
  function switchPhase(p: Phase) {
    setRunning(false);
    setPhase(p);
    setSeconds(DEFAULTS[p]);
    startedAtRef.current = null;
  }

  async function handleFinish() {
    setRunning(false);
    if (startedAtRef.current) {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        await supabase.from("pomodoro_sessions").insert({
          user_id: u.user.id,
          task_id: taskId,
          kind: phase,
          started_at: startedAtRef.current.toISOString(),
          ended_at: new Date().toISOString(),
          duration_seconds: DEFAULTS[phase],
          completed: true,
        });
        if (phase === "focus" && taskId) {
          const t = tasks.find((x) => x.id === taskId);
          if (t) {
            await supabase
              .from("tasks")
              .update({ spent_pomodoros: (t.spent_pomodoros ?? 0) + 1 })
              .eq("id", taskId);
          }
        }
      }
    }
    toast.success(phase === "focus" ? tr(lang, "view.pomodoro.toastFocusComplete") : tr(lang, "view.pomodoro.toastBreakDone"));
    // auto-advance
    const next: Phase = phase === "focus"
      ? (completedToday + 1) % 4 === 0 ? "long_break" : "short_break"
      : "focus";
    setPhase(next);
    setSeconds(DEFAULTS[next]);
    startedAtRef.current = null;
    if (phase === "focus") setCompletedToday((n) => n + 1);
  }

  const sortedTasks = useMemo(
    () => tasks.filter((t) => !t.is_completed).slice(0, 10),
    [tasks]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-3 border-b border-border">
        <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight">{tr(lang, "sidebar.pomodoro")}</h1>
        <p className="text-xs text-muted-fg">{tr(lang, "view.pomodoro.sessionsToday").replace("{n}", String(completedToday))}</p>
      </div>
      <div className="flex-1 overflow-y-auto grid place-items-center p-6">
        <div className="card w-full max-w-md p-8 space-y-6 text-center">
          <div className="flex justify-center gap-2">
            {(["focus", "short_break", "long_break"] as Phase[]).map((p) => (
              <button
                key={p}
                onClick={() => switchPhase(p)}
                className={cn("btn h-8 px-3 text-xs", phase === p ? "bg-accent text-accent-fg" : "btn-ghost")}
              >
                {p === "focus" ? tr(lang, "view.pomodoro.modeFocus") : p === "short_break" ? tr(lang, "view.pomodoro.modeShortBreak") : tr(lang, "view.pomodoro.modeLongBreak")}
              </button>
            ))}
          </div>
          <div className="relative size-56 mx-auto">
            <svg viewBox="0 0 100 100" className="size-56 -rotate-90">
              <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="44" fill="none"
                stroke="hsl(var(--accent))"
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${(pct * 276.46) / 100} 276.46`}
                style={{ transition: "stroke-dasharray 1s linear" }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div>
                <div className="text-5xl font-mono">{mm}:{ss}</div>
                <div className="text-xs text-muted-fg uppercase tracking-wider mt-1">
                  {phase === "focus" ? tr(lang, "view.pomodoro.modeFocus") : phase === "short_break" ? tr(lang, "view.pomodoro.modeShortBreak") : tr(lang, "view.pomodoro.modeLongBreak")}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-2">
            {!running ? (
              <button className="btn-primary gap-2" onClick={start}>
                <Play className="size-4" /> {tr(lang, "view.pomodoro.start")}
              </button>
            ) : (
              <button className="btn-outline gap-2" onClick={pause}>
                <Pause className="size-4" /> {tr(lang, "view.pomodoro.pause")}
              </button>
            )}
            <button className="btn-ghost gap-2" onClick={reset}>
              <RotateCcw className="size-4" /> {tr(lang, "view.pomodoro.reset")}
            </button>
            <button className="btn-ghost gap-2" onClick={stop}>
              <Square className="size-4" /> {tr(lang, "view.pomodoro.stop")}
            </button>
          </div>
          <div className="text-left">
            <div className="text-xs text-muted-fg mb-1">{tr(lang, "view.pomodoro.workingOn")}</div>
            <select
              className="input"
              value={taskId ?? ""}
              onChange={(e) => setTaskId(e.target.value || null)}
            >
              <option value="">{tr(lang, "view.pomodoro.noneOption")}</option>
              {sortedTasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
