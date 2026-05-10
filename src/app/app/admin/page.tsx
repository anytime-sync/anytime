"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Lock, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  FEATURES,
  CATEGORY_LABELS,
  featuresByCategory,
  type FeatureCategory,
  type Plan,
} from "@/lib/plans";

type FlagRow = {
  feature_id: string;
  override_plan: Plan | null;
  disabled: boolean;
  note: string | null;
  updated_at: string;
  updated_by: string | null;
};

/**
 * Round Z2 /app/admin override panel.
 *
 * Lets admins flip a feature's tier or disable it without deploying. Reads
 * /api/admin/feature-flags (gated to ADMIN_EMAILS env).
 */
export default function AdminFeatureFlagsPage() {
  const qc = useQueryClient();
  const [authState, setAuthState] = useState<"loading" | "out" | "denied" | "ok">("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setAuthState("out");
        return;
      }
      setEmail(data.user.email ?? null);
      const r = await fetch("/api/admin/feature-flags");
      if (r.status === 403) setAuthState("denied");
      else if (r.status === 401) setAuthState("out");
      else setAuthState("ok");
    });
  }, []);

  const flagsQ = useQuery<FlagRow[]>({
    queryKey: ["admin", "feature-flags"],
    enabled: authState === "ok",
    queryFn: async () => {
      const r = await fetch("/api/admin/feature-flags");
      if (!r.ok) throw new Error(`http_${r.status}`);
      const j = await r.json();
      return (j.flags ?? []) as FlagRow[];
    },
  });

  const setFlag = useMutation({
    mutationFn: async (body: {
      feature_id: string;
      override_plan: Plan | null;
      disabled: boolean;
      note?: string | null;
    }) => {
      const r = await fetch("/api/admin/feature-flags", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `http_${r.status}`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "feature-flags"] });
    },
    onError: (e: Error) => toast.error(`Couldn't save: ${e.message}`),
  });

  const groups = featuresByCategory();
  const cats: FeatureCategory[] = ["tasks", "calendar", "ai", "review", "data", "platform"];

  const flagFor = (id: string): FlagRow | undefined =>
    flagsQ.data?.find((f) => f.feature_id === id);

  if (authState === "loading") {
    return (
      <div className="p-8 text-sm text-muted-fg">Checking access…</div>
    );
  }
  if (authState === "out") {
    return (
      <div className="p-8 max-w-md">
        <h1 className="font-display text-2xl mb-2">Sign in required</h1>
        <p className="text-sm text-muted-fg mb-4">
          The admin override panel is only accessible to signed-in admins.
        </p>
        <Link href="/login" className="btn-primary h-9 px-3">Sign in</Link>
      </div>
    );
  }
  if (authState === "denied") {
    return (
      <div className="p-8 max-w-md">
        <h1 className="font-display text-2xl mb-2">Not authorized</h1>
        <p className="text-sm text-muted-fg mb-4">
          You're signed in as <span className="font-mono">{email}</span>, but
          this email isn't in the <code>ADMIN_EMAILS</code> allowlist. Add it
          on Vercel and redeploy.
        </p>
        <Link href="/app/today" className="btn-ghost h-9 px-3">Back to app</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <p className="editorial-number text-[11px]">ADMIN</p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight">
          Feature flag overrides
        </h1>
        <p className="text-sm text-muted-fg mt-1">
          Flip a feature's tier without redeploying.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-3xl space-y-8">
          {flagsQ.isLoading ? (
            <p className="text-sm text-muted-fg">Loading…</p>
          ) : flagsQ.error ? (
            <p className="text-sm text-danger">Couldn't load: {String(flagsQ.error)}</p>
          ) : (
            <div className="space-y-8">
              {cats.map((cat) => (
                <section key={cat}>
                  <h2 className="editorial-number text-[11px] mb-3">{CATEGORY_LABELS[cat]}</h2>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <header className="grid grid-cols-[1fr_100px_100px_50px] items-center bg-muted/30 px-4 py-2 text-xs uppercase tracking-wide text-muted-fg">
                      <span>Feature</span>
                      <span>Default</span>
                      <span>Override</span>
                      <span className="text-center">Off</span>
                    </header>
                    <ul className="divide-y divide-border">
                      {groups[cat].map((f) => {
                        const flag = flagFor(f.id);
                        const effective: Plan = flag?.override_plan ?? f.minPlan;
                        return (
                          <li
                            key={f.id}
                            className="grid grid-cols-[1fr_100px_100px_50px] items-center px-4 py-3 text-sm gap-2"
                          >
                            <div>
                              <p className="font-medium">{f.label}</p>
                              <p className="text-xs text-muted-fg mt-0.5 font-mono">{f.id}</p>
                            </div>
                            <div className="text-xs text-muted-fg uppercase">{f.minPlan}</div>
                            <div className="flex items-center gap-1">
                              <select
                                value={flag?.override_plan ?? ""}
                                disabled={setFlag.isPending}
                                onChange={(e) => {
                                  const v = e.target.value as "" | Plan;
                                  setFlag.mutate({
                                    feature_id: f.id,
                                    override_plan: v === "" ? null : v,
                                    disabled: !!flag?.disabled,
                                    note: flag?.note ?? null,
                                  });
                                }}
                                className="input h-8 text-xs flex-1"
                              >
                                <option value="">Default</option>
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                                <option value="team">Team</option>
                              </select>
                            </div>
                            <div className="flex justify-center">
                              <input
                                type="checkbox"
                                checked={!!flag?.disabled}
                                disabled={setFlag.isPending}
                                onChange={(e) => {
                                  setFlag.mutate({
                                    feature_id: f.id,
                                    override_plan: flag?.override_plan ?? null,
                                    disabled: e.target.checked,
                                    note: flag?.note ?? null,
                                  });
                                }}
                                className="size-4"
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
