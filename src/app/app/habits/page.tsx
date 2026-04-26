"use client";

import { useState } from "react";
import { addDays, format, startOfWeek, eachDayOfInterval } from "date-fns";
import { useHabits, useHabitLogs, useToggleHabitLog, useCreateHabit } from "@/hooks/use-habits";
import { Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function HabitsPage() {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🎯");
  const create = useCreateHabit();

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  const rangeStart = format(weekStart, "yyyy-MM-dd");
  const rangeEnd = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: habits = [] } = useHabits();
  const { data: logs = [] } = useHabitLogs(rangeStart, rangeEnd);
  const toggle = useToggleHabitLog();

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-3 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight">Habits</h1>
          <p className="text-xs text-muted-fg">Build streaks. Click a day to log.</p>
        </div>
        <button className="btn-primary gap-2" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New habit
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        <div className="card p-3">
          <div className="grid" style={{ gridTemplateColumns: "minmax(160px,1fr) repeat(7, 48px)" }}>
            <div />
            {days.map((d) => (
              <div key={d.toISOString()} className="text-center text-xs text-muted-fg">
                <div>{format(d, "EEE")}</div>
                <div className="font-medium text-fg">{format(d, "d")}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1">
            {habits.length === 0 && (
              <p className="text-sm text-muted-fg">No habits yet — try "Drink 8 cups water" or "Read 20 min".</p>
            )}
            {habits.map((h) => (
              <div key={h.id} className="grid items-center" style={{ gridTemplateColumns: "minmax(160px,1fr) repeat(7, 48px)" }}>
                <div className="flex items-center gap-2 px-2">
                  <span className="text-lg">{h.icon}</span>
                  <span className="text-sm">{h.name}</span>
                </div>
                {days.map((d) => {
                  const iso = format(d, "yyyy-MM-dd");
                  const log = logs.find((l) => l.habit_id === h.id && l.log_date === iso);
                  const isFuture = d > new Date();
                  return (
                    <button
                      key={iso}
                      disabled={isFuture}
                      onClick={() => toggle.mutate({ habitId: h.id, dateIso: iso, current: log })}
                      className={cn(
                        "mx-auto size-8 rounded-md grid place-items-center border",
                        log ? "border-success bg-success/15 text-success"
                            : "border-border hover:bg-muted",
                        isFuture && "opacity-30 cursor-not-allowed"
                      )}
                      style={log ? { borderColor: h.color, backgroundColor: `${h.color}22`, color: h.color } : {}}
                    >
                      {log ? <Check className="size-4" /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 animate-fade-in" onClick={() => setCreating(false)}>
          <div className="card w-[90vw] max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">New habit</h3>
            <div className="flex gap-2">
              <input className="input w-16 text-center" maxLength={2} value={icon} onChange={(e) => setIcon(e.target.value)} />
              <input className="input flex-1" placeholder="e.g. Read 20 minutes" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
              <button
                className="btn-primary"
                disabled={!name.trim()}
                onClick={async () => {
                  await create.mutateAsync({ name: name.trim(), icon });
                  setName("");
                  setCreating(false);
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
