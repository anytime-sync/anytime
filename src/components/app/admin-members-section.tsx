"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Search, Crown } from "lucide-react";

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
  override_plan_raw: "free" | "pro" | "vip" | "team" | null;
  override_reason: string | null;
  override_expires_at: string | null;
};

type UsersResponse = {
  users: AdminUser[];
  total: number;
  viewer_is_owner: boolean;
};

/**
 * Admin members section. Lists every user with their effective plan and a
 * dropdown to apply a manual override.
 *
 * Override options:
 *   - Default → no override; user falls back to whatever Stripe says (or Free).
 *   - Free    → forces the user to Free regardless of Stripe.
 *   - VIP     → grants Pro-level access without payment. Owner-only.
 *   - Team    → reserved.
 *
 * Pro is *not* a manual option — Pro must come from a real Stripe subscription.
 * The "From Stripe" column shows the user's payment-derived plan.
 */
export function AdminMembersSection() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const usersQ = useQuery<UsersResponse>({
    queryKey: ["admin", "users", q],
    queryFn: async () => {
      const url = q ? `/api/admin/users?q=${encodeURIComponent(q)}` : "/api/admin/users";
      const r = await fetch(url);
      if (!r.ok) throw new Error(`http_${r.status}`);
      return (await r.json()) as UsersResponse;
    },
  });

  const setPlan = useMutation({
    mutationFn: async (vars: {
      id: string;
      plan: "free" | "vip" | "team" | null;
      reason?: string;
    }) => {
      const r = await fetch(`/api/admin/users/${vars.id}/plan`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: vars.plan, reason: vars.reason ?? null }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.hint ?? j.error ?? `http_${r.status}`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Plan updated");
    },
    onError: (e: Error) => toast.error(`Couldn't save: ${e.message}`),
  });

  const isOwner = usersQ.data?.viewer_is_owner ?? false;

  return (
    <section>
      <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl tracking-tight">Members</h2>
          <p className="text-sm text-muted-fg mt-1">
            {isOwner
              ? "Override a user's plan independent of Stripe. Manual overrides win. Pro must come from Stripe — use VIP to comp Pro access."
              : "Override a user's plan to Free. Pro must come from Stripe."}
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
            {(usersQ.data?.users ?? []).map((u) => {
              const stripePlan: "free" | "pro" | "team" =
                u.plan_status && ["active", "trialing", "past_due"].includes(u.plan_status)
                  ? (u.plan as "free" | "pro" | "team")
                  : "free";
              const isVip = u.override_plan_raw === "vip";
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
                      value={u.override_plan_raw ?? ""}
                      disabled={setPlan.isPending}
                      onChange={(e) => {
                        const v = e.target.value as
                          | ""
                          | "free"
                          | "vip"
                          | "team";
                        setPlan.mutate({
                          id: u.id,
                          plan: v === "" ? null : v,
                        });
                      }}
                      className="input h-8 text-xs flex-1"
                    >
                      <option value="">— (use Stripe)</option>
                      <option value="free">Free</option>
                      {isOwner ? <option value="vip">VIP (comp Pro)</option> : null}
                      <option value="team">Team</option>
                    </select>
                    {isVip ? (
                      <Crown
                        className="size-3.5 text-accent shrink-0"
                        aria-label="VIP comp"
                      />
                    ) : u.is_manual_override ? (
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
            {(usersQ.data?.users ?? []).length === 0 ? (
              <li className="px-4 py-8 text-sm text-muted-fg text-center">
                No members{q ? ` matching "${q}"` : " yet"}.
              </li>
            ) : null}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-fg mt-3">
        Setting "—" removes the override; the user reverts to Stripe (or Free).{" "}
        {isOwner
          ? "VIP is invisible to the user — they appear as Pro internally."
          : null}
      </p>
    </section>
  );
}
