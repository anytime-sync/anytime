import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";

type Summary = {
  total_users: number;
  signups_7d: number;
  signups_30d: number;
  active_7d: number;
  total_tasks: number;
  completed_tasks: number;
  total_pomodoros: number;
  total_habits: number;
  language_breakdown: Record<string, number>;
  signups_by_day: Array<{ day: string; count: number }>;
};

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_dashboard_summary");
  const summary = (data ?? null) as Summary | null;

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      <header className="mb-8">
        <p className="editorial-number text-xs mb-1">Admin</p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight">
          Overview
        </h1>
        <p className="text-sm text-muted-fg mt-1">
          Last updated {format(new Date(), "EEEE, MMMM d · h:mm a")}
        </p>
      </header>

      {error && (
        <p className="text-sm text-danger">
          Failed to load summary: {error.message}
        </p>
      )}

      {summary && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <Kpi label="Total members" value={summary.total_users} />
            <Kpi label="Signups · 7d" value={summary.signups_7d} />
            <Kpi label="Active · 7d" value={summary.active_7d} />
            <Kpi label="Signups · 30d" value={summary.signups_30d} />
            <Kpi label="Tasks created" value={summary.total_tasks} />
            <Kpi
              label="Tasks completed"
              value={summary.completed_tasks}
              hint={`${
                summary.total_tasks > 0
                  ? Math.round(
                      (summary.completed_tasks / summary.total_tasks) * 100
                    )
                  : 0
              }% rate`}
            />
            <Kpi label="Pomodoros" value={summary.total_pomodoros} />
            <Kpi label="Habits" value={summary.total_habits} />
          </section>

          <section className="space-y-2 mb-8">
            <p className="editorial-number text-[10px]">Signups · last 30 days</p>
            <SparkBars data={summary.signups_by_day} />
          </section>

          <section className="space-y-3">
            <p className="editorial-number text-[10px]">Language breakdown</p>
            <LanguageBars data={summary.language_breakdown} />
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="surface border border-border rounded-lg p-4">
      <p className="editorial-number text-[10px] mb-1">{label}</p>
      <p className="font-display text-2xl tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-muted-fg mt-1">{hint}</p>}
    </div>
  );
}

function SparkBars({
  data,
}: {
  data: Array<{ day: string; count: number }>;
}) {
  // Lightweight bar sparkline — no chart library needed for 30 bars.
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="surface border border-border rounded-lg p-4">
      <div className="flex items-end gap-1 h-24">
        {data.length === 0 && (
          <p className="text-xs text-muted-fg">No signups in this window.</p>
        )}
        {data.map((d) => (
          <div
            key={d.day}
            title={`${format(new Date(d.day), "MMM d")} · ${d.count} signups`}
            className="flex-1 bg-accent/70 hover:bg-accent rounded-sm min-h-[2px]"
            style={{ height: `${(d.count / max) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function LanguageBars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, c]) => sum + c, 0);
  if (total === 0)
    return (
      <p className="text-sm text-muted-fg">No member data yet.</p>
    );
  return (
    <div className="surface border border-border rounded-lg p-4 space-y-2">
      {entries.map(([lang, count]) => {
        const pct = Math.round((count / total) * 100);
        return (
          <div key={lang} className="flex items-center gap-3">
            <span className="w-12 text-xs uppercase tracking-wider text-muted-fg">
              {lang}
            </span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-accent"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-16 text-right text-xs tabular-nums text-muted-fg">
              {count} · {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
