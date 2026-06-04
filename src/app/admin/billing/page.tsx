"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/plans";

type SubRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  plan: Plan;
  status: string;
  ls_customer_id: string | null;
  ls_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  variant_id: string | null;
  created_at: string;
};

type PlanCount = { plan: string; count: number };

export default function BillingPage() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [planCounts, setPlanCounts] = useState<PlanCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();

      // Get all subscriptions with user info
      const { data: subsData } = await supabase
        .from("subscriptions")
        .select("*, profiles!inner(email, full_name)")
        .order("created_at", { ascending: false });

      if (subsData) {
        setSubs(
          subsData.map((s: any) => ({
            ...s,
            email: s.profiles?.email ?? "—",
            full_name: s.profiles?.full_name ?? null,
          }))
        );
      }

      // Plan distribution from user_plans view
      const { data: plans } = await supabase.rpc("admin_plan_distribution");
      if (plans) setPlanCounts(plans as PlanCount[]);

      setLoading(false);
    })();
  }, []);

  const activeSubs = subs.filter((s) => s.status === "active" || s.status === "trialing");
  const cancelingSubs = subs.filter((s) => s.cancel_at_period_end);
  const churnedSubs = subs.filter((s) => s.status === "canceled" || s.status === "incomplete_expired");

  return (
    <div className="px-8 md:px-12 py-12 max-w-6xl">
      <header className="mb-12">
        <p className="editorial-number text-[11px] mb-3">
          The Admin Edition · No. 08
        </p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1.05]">
          Billing<em className="font-display">, at a glance.</em>
        </h1>
        <div className="mt-8 h-px bg-accent/40 w-24" />
      </header>

      {loading ? (
        <p className="text-sm text-muted-fg italic">Loading billing data…</p>
      ) : (
        <>
          {/* KPIs */}
          <section className="mb-12">
            <p className="editorial-number text-[10px] mb-4">The Numbers</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Kpi label="Active subscribers" value={activeSubs.length} />
              <Kpi label="Canceling" value={cancelingSubs.length} warn={cancelingSubs.length > 0} />
              <Kpi label="Churned" value={churnedSubs.length} />
              <Kpi
                label="Conversion rate"
                value={
                  planCounts.length > 0
                    ? `${(
                        ((activeSubs.length) /
                          Math.max(
                            planCounts.reduce((a, b) => a + b.count, 0),
                            1
                          )) *
                        100
                      ).toFixed(1)}%`
                    : "—"
                }
              />
            </div>
          </section>

          {/* Plan distribution */}
          <section className="mb-12">
            <p className="editorial-number text-[10px] mb-4">Plan Distribution</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {planCounts.map((p) => (
                <div
                  key={p.plan}
                  className="surface rounded-md border border-border px-4 py-3"
                >
                  <p className="text-xs text-muted-fg uppercase tracking-wider">
                    {p.plan}
                  </p>
                  <p className="text-2xl font-display mt-1">{p.count}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Subscriber list */}
          <section>
            <p className="editorial-number text-[10px] mb-4">All Subscriptions</p>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-left text-xs text-muted-fg uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Renews</th>
                    <th className="px-4 py-3 font-medium">LS Customer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subs.map((s) => (
                    <tr key={s.user_id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-fg">{s.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <PlanBadge plan={s.plan} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={s.status}
                          canceling={s.cancel_at_period_end}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-fg">
                        {s.current_period_end
                          ? formatDistanceToNow(new Date(s.current_period_end), {
                              addSuffix: true,
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-fg">
                        {s.ls_customer_id ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {subs.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-muted-fg italic"
                      >
                        No subscriptions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  warn,
}: {
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div className="surface rounded-md border border-border px-4 py-3">
      <p className="text-xs text-muted-fg">{label}</p>
      <p className={cn("text-2xl font-display mt-1", warn && "text-amber-500")}>
        {value}
      </p>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const color: Record<string, string> = {
    free: "bg-zinc-100 text-zinc-600",
    plus: "bg-blue-50 text-blue-700",
    pro: "bg-amber-50 text-amber-700",
    vip: "bg-purple-50 text-purple-700",
    team: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded text-xs font-medium uppercase",
        color[plan] ?? "bg-muted text-muted-fg"
      )}
    >
      {plan}
    </span>
  );
}

function StatusBadge({
  status,
  canceling,
}: {
  status: string;
  canceling: boolean;
}) {
  if (canceling)
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">
        Canceling
      </span>
    );
  const color: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700",
    trialing: "bg-blue-50 text-blue-700",
    past_due: "bg-red-50 text-red-700",
    canceled: "bg-zinc-100 text-zinc-500",
    paused: "bg-zinc-100 text-zinc-500",
  };
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded text-xs font-medium",
        color[status] ?? "bg-muted text-muted-fg"
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
