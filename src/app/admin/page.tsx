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
    <div className="px-8 md:px-12 py-12 max-w-6xl">
      <header className="mb-12">
        <p className="editorial-number text-[11px] mb-3">
          The Admin Edition · Issue No. 01
        </p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1.05]">
          Overview<em className="font-display">, today.</em>
        </h1>
        <p className="text-sm text-muted-fg mt-4 italic font-display">
          Last updated {format(new Date(), "EEEE, MMMM d · h:mm a")}
        </p>
        <div className="mt-8 h-px bg-accent/40 w-24" />
      </header>

      {error && (
        <p className="text-sm text-danger mb-6">
          Failed to load summary: {error.message}
        </p>
      )}

      {summary && (
        <>
          <Section kicker="The Numbers" title="By the readership">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Kpi label="Members" value={summary.total_users} />
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
            </div>
          </Section>

          <Rule />

          <Section kicker="Growth" title="A month of arrivals">
            <SparkBars data={summary.signups_by_day} />
          </Section>

          <Rule />

          <Section kicker="Languages" title="In which tongues">
            <LanguageBars data={summary.language_breakdown} />
          </Section>
        </>
      )}
    </div>
  );
}

function Section({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-5">
        <p className="editorial-number text-[10px] mb-1">{kicker}</p>
        <h2 className="font-display text-2xl md:text-3xl tracking-tight">
          <em>{title}</em>
        </h2>
      </div>
      {children}
    </section>
  );
}

function Rule() {
  return <div className="h-px bg-border my-12" />;
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
    <div className="surface border border-border rounded-lg p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-accent/60" />
      <p className="editorial-number text-[10px] mb-2">{label}</p>
      <p className="font-display text-3xl md:text-4xl tabular-nums leading-none">
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

function SparkBars({
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

function LanguageBars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, c]) => sum + c, 0);
  if (total === 0)
    return (
      <p className="text-sm text-muted-fg italic font-display">
        No member data yet.
      </p>
    );
  return (
    <div className="surface border border-border rounded-lg p-6 space-y-3 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-accent/60" />
      {entries.map(([lang, count]) => {
        const pct = Math.round((count / total) * 100);
        return (
          <div key={lang} className="flex items-center gap-4">
            <span className="w-14 editorial-number text-[10px]">{lang}</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-accent"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-20 text-right text-xs tabular-nums text-muted-fg">
              {count.toLocaleString()} · {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
