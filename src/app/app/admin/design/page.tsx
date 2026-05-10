"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, RotateCcw } from "lucide-react";
import { withDefaults, type LandingConfig } from "@/lib/landing-config";

type ApiResponse = {
  raw: LandingConfig | null;
  merged: Required<LandingConfig>;
  defaults: Required<LandingConfig>;
  updated_at: string | null;
};

/**
 * /app/admin/design — owner-only landing-page CMS.
 *
 * Edits the JSON in public.landing_config. Pages /pricing and /app/features
 * render this on top of code defaults, so the CMS only needs the diffs.
 *
 * The form is intentionally simple: a textarea per editable field. Lists
 * (free.features, pro.features, faq, demos) are line-separated for fast edits.
 */
export default function AdminDesignPage() {
  const qc = useQueryClient();
  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const [draft, setDraft] = useState<LandingConfig>({});

  useEffect(() => {
    fetch("/api/admin/landing-config")
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          setAuthState("denied");
          return null;
        }
        setAuthState("ok");
        return r.json();
      })
      .then((j: ApiResponse | null) => {
        if (j) setDraft(j.merged);
      })
      .catch(() => setAuthState("denied"));
  }, []);

  const cfgQ = useQuery<ApiResponse>({
    queryKey: ["admin", "landing-config"],
    enabled: authState === "ok",
    queryFn: async () => {
      const r = await fetch("/api/admin/landing-config");
      if (!r.ok) throw new Error(`http_${r.status}`);
      return (await r.json()) as ApiResponse;
    },
  });

  const save = useMutation({
    mutationFn: async (cfg: LandingConfig) => {
      const r = await fetch("/api/admin/landing-config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: cfg }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `http_${r.status}`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "landing-config"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(`Couldn't save: ${e.message}`),
  });

  const merged = cfgQ.data?.merged ?? draft;
  const set = (path: string[], value: unknown) => {
    setDraft((d) => {
      const next = structuredClone(d) as Record<string, unknown>;
      let obj = next as Record<string, unknown>;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (!obj[key] || typeof obj[key] !== "object") obj[key] = {};
        obj = obj[key] as Record<string, unknown>;
      }
      obj[path[path.length - 1]] = value;
      return next as LandingConfig;
    });
  };

  if (authState === "loading") {
    return <div className="p-8 text-sm text-muted-fg">Checking access…</div>;
  }
  if (authState === "denied") {
    return (
      <div className="p-8 max-w-md">
        <h1 className="font-display text-2xl mb-2">Owner only</h1>
        <p className="text-sm text-muted-fg mb-4">
          Only the owner email (set via <code>ADMIN_OWNER_EMAIL</code>) can edit
          landing-page content.
        </p>
        <Link href="/app/today" className="btn-ghost h-9 px-3">
          Back to app
        </Link>
      </div>
    );
  }

  // Working values: merged config from server (with defaults applied) overlaid
  // with the local draft. Saves push the local draft (raw, not merged) so we
  // don't accidentally store a copy of the defaults.
  const m = cfgQ.data?.merged ?? withDefaults(draft);
  const dPricing = draft.pricing ?? {};

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <p className="editorial-number text-[11px]">ADMIN</p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight">
          Landing-page content
        </h1>
        <p className="text-sm text-muted-fg mt-1">
          Edit the copy that appears on{" "}
          <Link href="/pricing" className="text-accent hover:underline inline-flex items-center gap-1">
            /pricing <ExternalLink className="size-3" />
          </Link>
          {" "}and{" "}
          <Link href="/app/features" className="text-accent hover:underline">
            /app/features
          </Link>
          . Changes go live within a minute. Empty fields fall back to code defaults.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-3xl space-y-10">
          <section className="space-y-4">
            <h2 className="font-display text-2xl tracking-tight">Hero</h2>
            <Field
              label="Eyebrow"
              value={dPricing.hero?.eyebrow ?? m.pricing?.hero?.eyebrow ?? ""}
              placeholder={m.pricing?.hero?.eyebrow}
              onChange={(v) => set(["pricing", "hero", "eyebrow"], v || undefined)}
            />
            <Field
              label="Title"
              value={dPricing.hero?.title ?? m.pricing?.hero?.title ?? ""}
              placeholder={m.pricing?.hero?.title}
              onChange={(v) => set(["pricing", "hero", "title"], v || undefined)}
            />
            <Field
              label="Subtitle"
              multiline
              value={dPricing.hero?.subtitle ?? m.pricing?.hero?.subtitle ?? ""}
              placeholder={m.pricing?.hero?.subtitle}
              onChange={(v) => set(["pricing", "hero", "subtitle"], v || undefined)}
            />
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl tracking-tight">Free plan card</h2>
            <Field
              label="Tagline"
              value={dPricing.free?.tagline ?? m.pricing?.free?.tagline ?? ""}
              placeholder={m.pricing?.free?.tagline}
              onChange={(v) => set(["pricing", "free", "tagline"], v || undefined)}
            />
            <Field
              label="Bullet list (one per line)"
              multiline
              value={(dPricing.free?.features ?? m.pricing?.free?.features ?? []).join("\n")}
              placeholder={m.pricing?.free?.features.join("\n")}
              onChange={(v) =>
                set(["pricing", "free", "features"], v ? v.split("\n").filter(Boolean) : undefined)
              }
            />
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl tracking-tight">Pro plan card</h2>
            <Field
              label="Badge"
              value={dPricing.pro?.badge ?? m.pricing?.pro?.badge ?? ""}
              placeholder={m.pricing?.pro?.badge}
              onChange={(v) => set(["pricing", "pro", "badge"], v || undefined)}
            />
            <Field
              label="Tagline"
              value={dPricing.pro?.tagline ?? m.pricing?.pro?.tagline ?? ""}
              placeholder={m.pricing?.pro?.tagline}
              onChange={(v) => set(["pricing", "pro", "tagline"], v || undefined)}
            />
            <Field
              label="Bullet list (one per line)"
              multiline
              value={(dPricing.pro?.features ?? m.pricing?.pro?.features ?? []).join("\n")}
              placeholder={m.pricing?.pro?.features.join("\n")}
              onChange={(v) =>
                set(["pricing", "pro", "features"], v ? v.split("\n").filter(Boolean) : undefined)
              }
            />
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl tracking-tight">Demo strip</h2>
            <p className="text-xs text-muted-fg">
              One block per line: <code>title|subtitle|asset</code>. Asset is a
              public path like <code>/screenshots/daily-edition.png</code>.
            </p>
            <Field
              label="Demos"
              multiline
              rows={8}
              value={(dPricing.demos ?? m.pricing.demos ?? [])
                .map((d) => `${d.title}|${d.subtitle ?? ""}|${d.asset}`)
                .join("\n")}
              placeholder={(m.pricing?.demos ?? []).map((d) => `${d.title}|${d.subtitle ?? ""}|${d.asset}`).join("\n")}
              onChange={(v) => {
                const parsed = v
                  ? v.split("\n").filter(Boolean).map((line) => {
                      const [title, subtitle, asset] = line.split("|").map((s) => s.trim());
                      return { title: title ?? "", subtitle: subtitle || undefined, asset: asset ?? "" };
                    })
                  : undefined;
                set(["pricing", "demos"], parsed);
              }}
            />
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl tracking-tight">FAQ</h2>
            <p className="text-xs text-muted-fg">
              One Q/A per pair of lines: <code>Q: …</code> on first, <code>A: …</code> on next.
            </p>
            <Field
              label="FAQ"
              multiline
              rows={10}
              value={(dPricing.faq ?? m.pricing.faq ?? [])
                .flatMap((f) => [`Q: ${f.q}`, `A: ${f.a}`])
                .join("\n")}
              placeholder={(m.pricing?.faq ?? []).flatMap((f) => [`Q: ${f.q}`, `A: ${f.a}`]).join("\n")}
              onChange={(v) => {
                if (!v) {
                  set(["pricing", "faq"], undefined);
                  return;
                }
                const lines = v.split("\n").map((s) => s.trim()).filter(Boolean);
                const out: Array<{ q: string; a: string }> = [];
                for (let i = 0; i < lines.length; i += 2) {
                  const q = lines[i]?.replace(/^Q:\s*/i, "") ?? "";
                  const a = lines[i + 1]?.replace(/^A:\s*/i, "") ?? "";
                  if (q || a) out.push({ q, a });
                }
                set(["pricing", "faq"], out);
              }}
            />
          </section>

          <section className="border-t border-border pt-6 flex items-center gap-3 sticky bottom-0 bg-bg/95 backdrop-blur -mx-4 md:-mx-8 px-4 md:px-8 py-4">
            <button
              onClick={() => save.mutate(draft)}
              disabled={save.isPending}
              className="btn-primary h-10 px-4"
            >
              {save.isPending ? "Saving…" : "Save changes"}
            </button>
            <button
              onClick={() => setDraft({})}
              className="btn-ghost h-10 px-4"
              title="Clear all overrides; falls back to code defaults"
            >
              <RotateCcw className="size-4 mr-1" /> Reset to defaults
            </button>
            {cfgQ.data?.updated_at ? (
              <span className="text-xs text-muted-fg ml-auto">
                Last saved {new Date(cfgQ.data.updated_at).toLocaleString()}
              </span>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-muted-fg block mb-1">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          rows={rows ?? 3}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="input w-full text-sm leading-relaxed"
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="input h-10 w-full text-sm"
        />
      )}
    </label>
  );
}
