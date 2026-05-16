"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
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
  enabled_free: boolean | null;
  enabled_plus: boolean | null;
  enabled_pro: boolean | null;
  enabled_vip: boolean | null;
};

/**
 * /admin/feature-flags — runtime overrides for the FEATURES matrix in plans.ts.
 *
 * Auth is already enforced by /admin/layout.tsx (isAdminEmail server-side
 * redirect), so this page can assume the viewer is admin. The API still
 * double-checks on every call.
 *
 * Each row offers two knobs:
 *   - Override plan: bumps the min tier required (free → pro, etc).
 *   - OFF: hides the feature entirely (consumed by sidebar + page guards).
 *
 * Edits are optimistic in TanStack's sense — onSuccess re-fetches; on error
 * we surface a toast. The /api/feature-flags/effective endpoint is what
 * other users' clients hit, with a 30s cache window.
 */
export default function AdminFeatureFlagsPage() {
  const qc = useQueryClient();

  const flagsQ = useQuery<FlagRow[]>({
    queryKey: ["admin", "feature-flags"],
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
      enabled_free?: boolean | null;
      enabled_plus?: boolean | null;
      enabled_pro?: boolean | null;
      enabled_vip?: boolean | null;
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
  const cats: FeatureCategory[] = [
    "tasks",
    "calendar",
    "ai",
    "review",
    "data",
    "platform",
  ];
  const flagFor = (id: string): FlagRow | undefined =>
    flagsQ.data?.find((f) => f.feature_id === id);

  return (
    <div className="px-8 md:px-12 py-12 max-w-5xl">
      <header className="mb-12">
        <p className="editorial-number text-[11px] mb-3">
          The Admin Edition · Issue No. 07
        </p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1.05]">
          Feature flags<em className="font-display">, by the row.</em>
        </h1>
        <p className="text-sm text-muted-fg mt-4 italic font-display">
          Flip a feature's tier or turn it off — without redeploying.
        </p>
        <div className="mt-8 h-px bg-accent/40 w-24" />
      </header>

      {flagsQ.isLoading ? (
        <p className="text-sm text-muted-fg italic font-display">
          Reading the manifest…
        </p>
      ) : flagsQ.error ? (
        <p className="text-sm text-danger">
          Couldn't load: {String(flagsQ.error)}
        </p>
      ) : (
        <div className="space-y-10">
          {cats.map((cat) => (
            <section key={cat}>
              <h2 className="editorial-number text-[11px] mb-3">
                {CATEGORY_LABELS[cat]}
              </h2>
              <div className="surface border border-border rounded-lg overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-px bg-accent/60" />
                <header className="grid grid-cols-[1fr_64px_72px_72px_72px_72px_44px] items-center bg-muted/40 px-4 py-2 editorial-number text-[10px] gap-1">
                  <span>Feature</span>
                  <span className="text-center">Default</span>
                  <span className="text-center">Free</span>
                  <span className="text-center">Plus</span>
                  <span className="text-center">Pro</span>
                  <span className="text-center">VIP</span>
                  <span className="text-center">Off</span>
                </header>
                <ul className="divide-y divide-border">
                  {groups[cat].map((f) => {
                    const flag = flagFor(f.id);
                    const triValue = (v: boolean | null | undefined): string =>
                      v === true ? "on" : v === false ? "off" : "";
                    const triParse = (s: string): boolean | null =>
                      s === "on" ? true : s === "off" ? false : null;
                    function savePlan(planKey: "enabled_free"|"enabled_plus"|"enabled_pro"|"enabled_vip", v: boolean | null) {
                      setFlag.mutate({
                        feature_id: f.id,
                        override_plan: flag?.override_plan ?? null,
                        disabled: !!flag?.disabled,
                        note: flag?.note ?? null,
                        enabled_free: planKey === "enabled_free" ? v : (flag?.enabled_free ?? null),
                        enabled_plus: planKey === "enabled_plus" ? v : (flag?.enabled_plus ?? null),
                        enabled_pro:  planKey === "enabled_pro"  ? v : (flag?.enabled_pro  ?? null),
                        enabled_vip:  planKey === "enabled_vip"  ? v : (flag?.enabled_vip  ?? null),
                      });
                    }
                    return (
                      <li
                        key={f.id}
                        className="grid grid-cols-[1fr_64px_72px_72px_72px_72px_44px] items-center px-4 py-3 text-sm gap-1"
                      >
                        <div>
                          <p className="font-display text-base leading-tight">{f.label}</p>
                          <p className="text-xs text-muted-fg mt-0.5 font-mono">{f.id}</p>
                        </div>
                        <div className="text-[10px] text-muted-fg uppercase text-center">{f.minPlan}</div>
                        {(["enabled_free","enabled_plus","enabled_pro","enabled_vip"] as const).map((col) => {
                          const cur = flag?.[col] ?? null;
                          return (
                            <select
                              key={col}
                              value={triValue(cur)}
                              disabled={setFlag.isPending}
                              onChange={(e) => savePlan(col, triParse(e.target.value))}
                              className="input h-7 text-[11px] w-full px-1"
                              title={`Override ${col.replace("enabled_","")} access for this feature. "—" falls back to the default tier rule.`}
                            >
                              <option value="">—</option>
                              <option value="on">On</option>
                              <option value="off">Off</option>
                            </select>
                          );
                        })}
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
                                enabled_free: flag?.enabled_free ?? null,
                                enabled_plus: flag?.enabled_plus ?? null,
                                enabled_pro:  flag?.enabled_pro  ?? null,
                                enabled_vip:  flag?.enabled_vip  ?? null,
                              });
                            }}
                            className="size-4"
                            title="Disable this feature globally (overrides all per-plan toggles)"
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
  );
}
