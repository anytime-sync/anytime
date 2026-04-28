"use client";

import { useEffect, useState } from "react";
import { format, subDays, startOfDay } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";

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
  const [retention, setRetention] = useState<Array<{ day: number; pct: number }>>([]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: s } = await supabase.rpc("admin_dashboard_summary");
      setSummary(s as Summary);

      // Build a simple D1/D7/D30 retention proxy from auth.users.created_at
      // and tasks.updated_at (most recent activity per user).
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
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={summary.signups_by_day.map((d) => ({
                    day: format(new Date(d.day), "MMM d"),
                    count: d.count,
                  }))}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-fg))" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-fg))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--bg))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Retention */}
          <Section
            title="Activity retention"
            subtitle="% of all members who touched a task within N days"
          >
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={retention.map((r) => ({ day: `D${r.day}`, pct: r.pct }))}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-fg))" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-fg))" }}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v}%`, "Retention"]}
                    contentStyle={{
                      background: "hsl(var(--bg))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="pct" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
