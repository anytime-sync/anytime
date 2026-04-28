"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/client";

/**
 * Admin Insights — cohort retention, signup growth, feature usage.
 *
 * Charts are pure SVG/CSS so we don't drag in a charting library; the
 * dataset is small (≤ 30 bars) and readability matters more than fancy
 * tooltips here.
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
  const [retention, setRetention] = useState<
    Array<{ day: number; pct: number }>
  >([]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: s } = await supabase.rpc("admin_dashboard_summary");
      setSummary(s as Summary);

      // D1/D3/D7/D14/D30 retention proxy: % of all members who touched
      // a task within the past N days.
      const { data: users } = await supabase
        .from("profiles")
        .select("id, created_at");
      if (users) {
        const cohorts = await Promise.all(
          [1, 3, 7, 14, 30].map(async (n) => {
            const { count } = await supabase
              .from("tasks")
              .select("user_id", { count: "exact", head: true })
              .gte("updated_at", subDays(new Date(), n).toISOString());
            const total = users.length;
            return {
              day: n,
              pct: total > 0 ? Math.round(((count ?? 0) / total) * 100) : 0,
            };
          })
        );
        setRetention(cohorts);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      <header className="mb-8">
        <p className="editorial-number text-xs mb-1">Admin</p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight">
          Insights
        </h1>
        <p className="text-sm text-muted-fg mt-1">
          Cohort retention, growth, and feature usage.
        </p>
      </header>

      {loading && <p className="text-sm text-muted-fg">Loading…</p>}

      {summary && (
        <div className="space-y-8">
          {/* Signups over time */}
          <Section
            title="Signups · last 30 days"
            subtitle={`${summary.signups_7d} new in the past week`}
          >
            <SignupsBars data={summary.signups_by_day} />
          </Section>

          {/* Retention */}
          <Section
            title="Activity retention"
            subtitle="% of all members who touched a task within N days"
          >
            <RetentionBars data={retention} />
          </Section>

          {/* Feature usage matrix */}
          <Section
            title="Feature usage"
            subtitle="Total interactions across the product"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              <Pill label="Pomodoros run" value={summary.total_pomodoros} />
              <Pill label="Habits created" value={summary.total_habits} />
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <p className="editorial-number text-[10px] mb-0.5">{title}</p>
        {subtitle && <p className="text-xs text-muted-fg">{subtitle}</p>}
      </div>
      <div className="surface border border-border rounded-lg p-4">
        {children}
      </div>
    </section>
  );
}

function SignupsBars({
  data,
}: {
  data: Array<{ day: string; count: number }>;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="flex items-end gap-1 h-32">
        {data.length === 0 && (
          <p className="text-xs text-muted-fg">No signups in this window.</p>
        )}
        {data.map((d) => (
          <div
            key={d.day}
            title={`${format(new Date(d.day), "MMM d")} · ${d.count} signups`}
            className="flex-1 bg-accent/70 hover:bg-accent rounded-sm min-h-[2px] transition-colors"
            style={{ height: `${(d.count / max) * 100}%` }}
          />
        ))}
      </div>
      {data.length > 0 && (
        <div className="flex justify-between text-[10px] text-muted-fg tabular-nums mt-2">
          <span>{format(new Date(data[0]!.day), "MMM d")}</span>
          <span>{format(new Date(data[data.length - 1]!.day), "MMM d")}</span>
        </div>
      )}
    </div>
  );
}

function RetentionBars({
  data,
}: {
  data: Array<{ day: number; pct: number }>;
}) {
  if (data.length === 0)
    return <p className="text-sm text-muted-fg">No data yet.</p>;
  return (
    <div className="space-y-2">
      {data.map((r) => (
        <div key={r.day} className="flex items-center gap-3">
          <span className="w-10 text-xs uppercase tracking-wider text-muted-fg tabular-nums">
            D{r.day}
          </span>
          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${r.pct}%` }}
            />
          </div>
          <span className="w-12 text-right text-xs tabular-nums text-muted-fg">
            {r.pct}%
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
    <div className="surface border border-border rounded-md p-3">
      <p className="editorial-number text-[10px] mb-1">{label}</p>
      <p className="font-display text-xl tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-muted-fg mt-1">{hint}</p>}
    </div>
  );
}
