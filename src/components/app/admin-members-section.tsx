"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Search } from "lucide-react";

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  plan: "free" | "pro" | "team";
  plan_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  is_manual_override: boolean;
  override_reason: string | null;
  override_expires_at: string | null;
};

/**
 * Admin members section. Lists every user with their effective plan and a
 * dropdown to apply a manual override. The Stripe-derived plan is shown read
 * only as the "from Stripe" tag so the admin can see what would happen if
 * the override were removed.
 */
export function AdminMembersSection() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const usersQ = useQuery<AdminUser[]>({
    queryKey: ["admin", "users", q],
    queryFn: async () => {
      const url = q ? `/api/admin/users?q=${encodeURIComponent(q)}` : "/api/admin/users";
      const r = await fetch(url);
      if (!r.ok) throw new Error(`http_${r.status}`);
      const j = await r.json();
      return (j.users ?? []) as AdminUser[];
    },
  });

  const setPlan = useMutation({
    mutationFn: async (vars: {
      id: string;
      plan: "free" | "pro" | "team" | null;
      reason?: string;
    }) => {
      const r = await fetch(`/api/admin/users/${vars.id}/plan`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: vars.plan, reason: vars.reason ?? null }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `http_${r.status}`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Plan updated");
    },
    onError: (e: Error) => toast.error(`Couldn't save: ${e.message}`),
  });

  return (
    <section>
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl tracking-tight">Members</h2>
          <p className="text-sm text-muted-fg mt-1">
            Override a user's plan independent of Stripe. Manual overrides win.
          </p>
        </div>
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email…"
            className="input h-9 pl-9 w-64 text-sm"
          />
        </div>
      </div>

      {usersQ.isLoading ? (
        <p className="text-sm text-muted-fg">Loading members…</p>
      ) : usersQ.error ? (
        <p className="text-sm text-danger">
          Couldn't load: {String(usersQ.error)}
        </p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <header className="grid grid-cols-[2fr_140px_1fr_140px_60px] items-center bg-muted/30 px-4 py-2 text-xs uppercase tracking-wide text-muted-fg">
            <span>Member</span>
            <span>From Stripe</span>
            <span>Manual override</span>
            <span>Last sign-in</span>
            <span className="text-center">Effective</span>
          </header>
          <ul className="divide-y divide-border">
            {(usersQ.data ?? []).map((u) => {
              const stripePlan: "free" | "pro" | "team" =
                u.plan_status && ["active", "trialing", "past_due"].includes(u.plan_status)
                  ? (u.plan as "free" | "pro" | "team")
                  : "free";
              return (
                <li
                  key={u.id}
                  className="grid grid-cols-[2fr_140px_1fr_140px_60px] items-center px-4 py-3 text-sm gap-3"
                >
                  <div>
                    <p className="font-medium">
                      {u.full_name ?? u.email ?? u.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-fg">{u.email}</p>
                  </div>
                  <div className="text-xs">
                    <span className="uppercase">{stripePlan}</span>
                    {u.plan_status && stripePlan !== "free" ? (
                      <span className="text-muted-fg ml-1">· {u.plan_status}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={u.is_manual_override ? u.plan : ""}
                      disabled={setPlan.isPending}
                      onChange={(e) => {
                        const v = e.target.value as "" | "free" | "pro" | "team";
                        setPlan.mutate({ id: u.id, plan: v === "" ? null : v });
                      }}
                      className="input h-8 text-xs flex-1"
                    >
                      <option value="">— (use Stripe)</option>
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="team">Team</option>
                    </select>
                    {u.is_manual_override ? (
                      <Sparkles
                        className="size-3 text-accent shrink-0"
                        aria-label="Manual override"
                      />
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-fg">
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleDateString()
                      : "—"}
                  </div>
                  <div className="text-xs uppercase text-center font-semibold">
                    {u.plan}
                  </div>
                </li>
              );
            })}
            {(usersQ.data ?? []).length === 0 ? (
              <li className="px-4 py-8 text-sm text-muted-fg text-center">
                No members{q ? ` matching "${q}"` : " yet"}.
              </li>
            ) : null}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-fg mt-3">
        Tip: setting a manual override to "—" removes it; the user reverts to
        whatever Stripe says (or Free if they don't have a subscription).
      </p>
    </section>
  );
}
