"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { loadTaskUpdateActivity, type TaskUpdateActivity } from "@/lib/task-update-activity";

/**
 * Admin Insights — signup growth and current task-update activity.
 * Editorial spread: kicker + italic serif title, soft surfaces, gold rule.
 */

type Summary = {
  total_users: number;
  signups_7d: number;
  active_7d: number;
  total_tasks: number;
  completed_tasks: number;
  total_pomodoros: number;
  total_habits: number;
  language_breakdown: Record<string, number>;
  signups_by_day: Array<{ day: string; count: number }>;
};

export default function InsightsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [taskActivity, setTaskActivity] = useState<TaskUpdateActivity[]>([]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: s } = await supabase.rpc("admin_dashboard_summary");
      setSummary(s as Summary);

      setTaskActivity(await loadTaskUpdateActivity(supabase));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="px-8 md:px-12 py-12 max-w-6xl">
      <header className="mb-12">
        <p className="editorial-number text-[11px] mb-3">
          The Admin Edition · Issue No. 03
        </p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1.05]">
          Insights<em className="font-display">, in detail.</em>
        </h1>
        <p className="text-sm text-muted-fg mt-4 italic font-display">
          Signup growth and a snapshot of task activity.
        </p>
        <div className="mt-8 h-px bg-accent/40 w-24" />
      </header>

      {loading && (
        <p className="text-sm text-muted-fg italic font-display">Reading the tea leaves…</p>
      )}

      {summary && (
        <div className="space-y-12">
          <Section
            kicker="Growth"
            title="A month of arrivals"
            subtitle={`${summary.signups_7d} new in the past week`}
          >
            <SignupsBars data={summary.signups_by_day} />
          </Section>

          <Rule />

          <Section
            kicker="Task activity"
            title="Tasks last updated"
            subtitle="Existing tasks whose latest update falls in each rolling window. Includes automated updates; repeated edits count once."
          >
            <TaskActivityBars data={taskActivity} />
            <p className="text-xs text-muted-fg mt-3">
              Member return rates and activation are not measured here. Historical cohort retention requires distinct-user activity history.
            </p>
          </Section>

          <Rule />

          <Section
            kicker="Usage"
            title="What the readership did"
            subtitle="Total interactions across the product"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Pill label="Tasks created" value={summary.total_tasks} />
              <Pill
                label="Tasks completed"
                value={summary.completed_tasks}
                hint={`${
                  summary.total_tasks > 0
                    ? Math.round(
                        (summary.completed_tasks / summary.total_tasks) * 100
                      )
                    : 0
                }% of all`}
              />
              <Pill label="Focus sessions" value={summary.total_pomodoros} />
              <Pill label="Habits created" value={summary.total_habits} />
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5">
        <p className="editorial-number text-[10px] mb-1">{kicker}</p>
        <h2 className="font-display text-2xl md:text-3xl tracking-tight">
          <em>{title}</em>
        </h2>
        {subtitle && (
          <p className="text-xs text-muted-fg mt-1.5 italic font-display">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Rule() {
  return <div className="h-px bg-border" />;
}

function SignupsBars({
  data,
}: {
  data: Array<{ day: string; count: number }>;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="surface border border-border rounded-lg p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-accent/60" />
      <div className="flex items-end gap-1 h-32">
        {data.length === 0 && (
          <p className="text-xs text-muted-fg italic font-display">
            No signups in this window.
          </p>
        )}
        {data.map((d) => (
          <div
            key={d.day}
            title={`${format(new Date(d.day), "MMM d")} · ${d.count} signups`}
            className="flex-1 bg-accent/60 hover:bg-accent rounded-sm min-h-[2px] transition-colors"
            style={{ height: `${(d.count / max) * 100}%` }}
          />
        ))}
      </div>
      {data.length > 0 && (
        <div className="flex justify-between text-[10px] tabular-nums mt-3 editorial-number">
          <span>{format(new Date(data[0]!.day), "MMM d")}</span>
          <span>{format(new Date(data[data.length - 1]!.day), "MMM d")}</span>
        </div>
      )}
    </div>
  );
}

function TaskActivityBars({
  data,
}: {
  data: TaskUpdateActivity[];
}) {
  if (data.length === 0)
    return (
      <p className="text-sm text-muted-fg italic font-display">No data yet.</p>
    );
  const max = Math.max(1, ...data.map(row => row.count ?? 0));
  return (
    <div className="surface border border-border rounded-lg p-6 space-y-3 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-accent/60" />
      {data.map((r) => (
        <div key={r.days} className="flex items-center gap-4">
          <span className="w-20 editorial-number text-[10px] tabular-nums">
            Past {r.days}d
          </span>
          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${((r.count ?? 0) / max) * 100}%` }}
            />
          </div>
          <span className="w-24 text-right text-xs tabular-nums text-muted-fg">
            {r.count === null ? "Unavailable" : `${r.count.toLocaleString()} tasks`}
          </span>
        </div>
      ))}
    </div>
  );
}

function Pill({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="surface border border-border rounded-lg p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-accent/60" />
      <p className="editorial-number text-[10px] mb-2">{label}</p>
      <p className="font-display text-2xl md:text-3xl tabular-nums leading-none">
        {value.toLocaleString()}
      </p>
      {hint && (
        <p className="text-[10px] text-muted-fg mt-2 italic font-display">
          {hint}
        </p>
      )}
    </div>
  );
}
