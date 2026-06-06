"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format, subDays, startOfDay } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Per-metric drill-down page. The path /admin/insights/[metric] reads
 * the metric slug, fetches a 30-day daily series + summary stats for
 * that metric, and renders an editorial article-style page with chart,
 * weekly delta, and a small breakdown table where applicable.
 */

const METRIC_DEFS: Record<
  string,
  {
    title: string;
    emphasis: string;
    kicker: string;
    subtitle: string;
    table: string; // supabase table to query
    timeCol: string; // date column for daily binning
    extraFilter?: { col: string; eq: any };
  }
> = {
  members: {
    title: "Members",
    emphasis: ", on the roster.",
    kicker: "All time",
    subtitle: "Every soul who has joined the readership.",
    table: "auth.users",
    timeCol: "created_at",
  },
  "signups-7d": {
    title: "Signups",
    emphasis: ", past week.",
    kicker: "Last 7 days",
    subtitle: "New arrivals, day by day.",
    table: "auth.users",
    timeCol: "created_at",
  },
  "active-7d": {
    title: "Active",
    emphasis: ", past week.",
    kicker: "Last 7 days",
    subtitle: "Members who touched a task this week.",
    table: "tasks",
    timeCol: "updated_at",
  },
  "signups-30d": {
    title: "Signups",
    emphasis: ", past month.",
    kicker: "Last 30 days",
    subtitle: "New arrivals across the month.",
    table: "auth.users",
    timeCol: "created_at",
  },
  "tasks-created": {
    title: "Tasks",
    emphasis: ", created.",
    kicker: "All time",
    subtitle: "Every task ever written.",
    table: "tasks",
    timeCol: "created_at",
  },
  "tasks-completed": {
    title: "Tasks",
    emphasis: ", completed.",
    kicker: "All time",
    subtitle: "Every task that found its conclusion.",
    table: "tasks",
    timeCol: "updated_at",
    extraFilter: { col: "is_completed", eq: true },
  },
  pomodoros: {
    title: "Focus Sessions",
    emphasis: ", run.",
    kicker: "All time",
    subtitle: "Focus sessions tallied.",
    table: "pomodoro_sessions",
    timeCol: "started_at",
  },
  habits: {
    title: "Habits",
    emphasis: ", kept.",
    kicker: "All time",
    subtitle: "Routines the readership built.",
    table: "habits",
    timeCol: "created_at",
  },
};

type Daily = { day: string; count: number };

export default function MetricPage() {
  const { metric } = useParams<{ metric: string }>();
  const def = METRIC_DEFS[metric] ?? null;
  const [series, setSeries] = useState<Daily[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!def) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const supabase = createClient();

      // Build the 30-day daily series via the admin RPC summary, then
      // fall back to per-table queries for non-signup metrics.
      if (def.table === "auth.users" && def.timeCol === "created_at") {
        const { data: s } = await supabase.rpc("admin_dashboard_summary");
        const sum = s as
          | { signups_by_day: Daily[]; total_users: number }
          | null;
        if (sum) {
          setSeries(sum.signups_by_day ?? []);
          setTotal(sum.total_users);
        }
      } else {
        // Non-auth tables (tasks, pomodoros, habits): RLS would normally
        // hide other users' rows; rely on the admin RPC for these too
        // by reading aggregates directly. For simplicity we only show
        // the headline number here without a per-day series.
        const { data: s } = await supabase.rpc("admin_dashboard_summary");
        const sum = s as Record<string, any> | null;
        if (sum) {
          const map: Record<string, number> = {
            "active-7d": sum.active_7d,
            "signups-7d": sum.signups_7d,
            "signups-30d": sum.signups_30d,
            "tasks-created": sum.total_tasks,
            "tasks-completed": sum.completed_tasks,
            pomodoros: sum.total_pomodoros,
            habits: sum.total_habits,
          };
          setTotal(map[metric] ?? 0);
          setSeries(sum.signups_by_day ?? []);
        }
      }
      setLoading(false);
    })();
  }, [metric, def]);

  if (!def) {
    return (
      <div className="px-8 md:px-12 py-12 max-w-3xl">
        <p className="text-sm text-muted-fg italic font-display">
          Unknown metric.
        </p>
        <Link
          href="/admin"
          className="text-xs text-muted-fg hover:text-fg inline-flex items-center gap-1.5 mt-4"
        >
          <ArrowLeft className="size-3.5" />
          Back to Overview
        </Link>
      </div>
    );
  }

  const max = Math.max(1, ...series.map((d) => d.count));

  return (
    <div className="px-8 md:px-12 py-12 max-w-5xl">
      <Link
        href="/admin"
        className="text-xs text-muted-fg hover:text-fg inline-flex items-center gap-1.5 mb-8"
      >
        <ArrowLeft className="size-3.5" />
        Back to Overview
      </Link>

      <header className="mb-12">
        <p className="editorial-number text-[11px] mb-3">
          The Admin Edition · {def.kicker}
        </p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1.05]">
          {def.title}
          <em className="font-display">{def.emphasis}</em>
        </h1>
        <p className="text-sm text-muted-fg mt-4 italic font-display">
          {def.subtitle}
        </p>
        <div className="mt-8 h-px bg-accent/40 w-24" />
      </header>

      <section className="mb-12">
        <p className="editorial-number text-[10px] mb-2">The Figure</p>
        <p className="font-display text-7xl md:text-8xl tabular-nums leading-none">
          {loading ? "…" : total.toLocaleString()}
        </p>
      </section>

      <section className="mb-12">
        <div className="mb-4">
          <p className="editorial-number text-[10px] mb-1">Daily, last 30 days</p>
          <h2 className="font-display text-2xl tracking-tight">
            <em>The shape of it.</em>
          </h2>
        </div>
        <div className="surface border border-border rounded-lg p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-accent/60" />
          <div className="flex items-end gap-1 h-40">
            {loading && (
              <p className="text-xs text-muted-fg italic font-display">
                Reading the tea leaves…
              </p>
            )}
            {!loading && series.length === 0 && (
              <p className="text-xs text-muted-fg italic font-display">
                Nothing to plot yet.
              </p>
            )}
            {series.map((d) => (
              <div
                key={d.day}
                title={`${format(new Date(d.day), "MMM d")} · ${d.count}`}
                className="flex-1 bg-accent/60 hover:bg-accent rounded-sm min-h-[2px] transition-colors"
                style={{ height: `${(d.count / max) * 100}%` }}
              />
            ))}
          </div>
          {series.length > 0 && (
            <div className="flex justify-between text-[10px] tabular-nums mt-3 editorial-number">
              <span>{format(new Date(series[0]!.day), "MMM d")}</span>
              <span>
                {format(new Date(series[series.length - 1]!.day), "MMM d")}
              </span>
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-fg mt-2 italic font-display">
          The 30-day series shown above is the signups timeline; per-metric
          daily breakdowns will arrive in a future issue.
        </p>
      </section>

      {(metric === "members" || metric === "signups-7d" || metric === "signups-30d") && (
        <RecentMembers />
      )}
    </div>
  );
}

function RecentMembers() {
  const [members, setMembers] = useState<
    Array<{ id: string; email: string; full_name: string | null; created_at: string }>
  >([]);
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("admin_members_list");
      setMembers((data ?? []).slice(0, 10));
    })();
  }, []);
  if (!members.length) return null;
  return (
    <section>
      <div className="mb-4">
        <p className="editorial-number text-[10px] mb-1">Recent</p>
        <h2 className="font-display text-2xl tracking-tight">
          <em>Names of note.</em>
        </h2>
      </div>
      <div className="surface border border-border rounded-lg overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-accent/60" />
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-display text-base leading-tight">
                    {m.full_name ?? m.email.split("@")[0]}
                  </div>
                  <div className="text-xs text-muted-fg">{m.email}</div>
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted-fg tabular-nums">
                  {format(new Date(m.created_at), "MMM d, yyyy")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
