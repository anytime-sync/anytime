"use client";

import { useEffect, useMemo, useState } from "react";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import { Plus, Trash2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type KeywordRow = {
  id: string;
  locale: string;
  phrase: string;
  priority: 0 | 1 | 3 | 5;
  quadrant: "q1" | "q2" | "q3" | "q4" | null;
  enabled: boolean;
};

type QuadrantRow = {
  locale: string;
  quadrant: "q1" | "q2" | "q3" | "q4";
  label: string;
  fg_color: string | null;
  bg_color: string | null;
  border_color: string | null;
};

const PRIORITY_LABEL: Record<number, string> = {
  5: "High (Q1)",
  3: "Medium (Q2)",
  1: "Low (Q3)",
  0: "None (Q4)",
};

const QUADRANT_DEFAULTS: Record<"q1" | "q2" | "q3" | "q4", { label: string; fg: string; bg: string; border: string }> = {
  q1: { label: "Do first",   fg: "#7f1d1d", bg: "#fee2e2", border: "#fca5a5" },
  q2: { label: "Schedule",   fg: "#1e3a8a", bg: "#dbeafe", border: "#93c5fd" },
  q3: { label: "Delegate",   fg: "#854d0e", bg: "#fef9c3", border: "#fde047" },
  q4: { label: "Eliminate",  fg: "#374151", bg: "#f3f4f6", border: "#d1d5db" },
};

export default function KeywordsAdminPage() {
  const [locale, setLocale] = useState<LanguageCode>("en");
  const [tab, setTab] = useState<"phrases" | "quadrants">("phrases");
  const [running, setRunning] = useState(false);

  return (
    <div className="px-8 md:px-12 py-12 max-w-6xl">
      <header className="mb-10">
        <p className="editorial-number text-[11px] mb-3">
          The Admin Edition · Issue No. 06
        </p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1.05]">
          Keywords<em className="font-display">, the language of urgency.</em>
        </h1>
        <p className="text-sm text-muted-fg mt-4 italic font-display max-w-2xl">
          The phrases your members type that decide a task&rsquo;s priority and
          the Eisenhower cell it lands in. Edit the labels, the colors, and
          the language of the matrix itself.
        </p>
        <div className="mt-8 h-px bg-accent/40 w-24" />
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="editorial-number text-[10px] text-muted-fg">Locale</span>
          <select
            className="input"
            value={locale}
            onChange={(e) => setLocale(e.target.value as LanguageCode)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <TabButton active={tab === "phrases"} onClick={() => setTab("phrases")}>
            Phrases
          </TabButton>
          <TabButton active={tab === "quadrants"} onClick={() => setTab("quadrants")}>
            Quadrants
          </TabButton>
        </div>

        <button
          className="btn-ghost h-9 px-3 text-sm inline-flex items-center gap-1.5"
          disabled={running}
          onClick={async () => {
            setRunning(true);
            const res = await fetch("/api/admin/keywords/reclassify", { method: "POST" });
            setRunning(false);
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              toast.error(j.error ?? "Re-classify failed");
              return;
            }
            const j = await res.json().catch(() => ({}));
            toast.success(`Re-classified ${j.updated ?? 0} tasks`);
          }}
          title="Re-classify all tasks against the current keyword set"
        >
          <RotateCw className={cn("size-4", running && "animate-spin")} />
          Re-classify all tasks
        </button>
      </div>

      {tab === "phrases" ? (
        <PhrasesPanel locale={locale} />
      ) : (
        <QuadrantsPanel locale={locale} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-9 px-4 text-sm rounded-md border transition-colors",
        active
          ? "bg-fg text-bg border-fg"
          : "bg-transparent border-border text-muted-fg hover:text-fg"
      )}
    >
      {children}
    </button>
  );
}

/* --------------- Phrases panel --------------- */

function PhrasesPanel({ locale }: { locale: LanguageCode }) {
  const [rows, setRows] = useState<KeywordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [phrase, setPhrase] = useState("");
  const [priority, setPriority] = useState<0 | 1 | 3 | 5>(5);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    const res = await fetch(`/api/admin/keywords?locale=${encodeURIComponent(locale)}`);
    const j = await res.json().catch(() => ({}));
    if (res.ok) setRows((j.rows ?? []) as KeywordRow[]);
    else toast.error(j.error ?? "Load failed");
    setLoading(false);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!phrase.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/keywords", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale, phrase: phrase.trim(), priority }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Add failed");
      return;
    }
    setPhrase("");
    reload();
  }

  async function patch(id: string, patch: Partial<KeywordRow>) {
    const res = await fetch(`/api/admin/keywords/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Save failed");
      return;
    }
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Remove this phrase?")) return;
    const res = await fetch(`/api/admin/keywords/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Delete failed");
      return;
    }
    reload();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={add}
        className="surface border border-border rounded-lg p-4 flex flex-wrap items-end gap-3"
      >
        <label className="flex-1 min-w-[240px] block">
          <span className="editorial-number text-[10px] mb-1.5 block">Phrase</span>
          <input
            className="input w-full"
            placeholder={locale === "en" ? "e.g. fire drill" : "e.g. 緊急"}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="editorial-number text-[10px] mb-1.5 block">Priority</span>
          <select
            className="input"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value, 10) as 0 | 1 | 3 | 5)}
          >
            {[5, 3, 1, 0].map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={busy || !phrase.trim()}
          className="btn-primary h-9 px-3 text-sm inline-flex items-center gap-1.5"
        >
          <Plus className="size-4" />
          Add phrase
        </button>
      </form>

      <div className="surface border border-border rounded-lg overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-accent/60" />
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left">
              <th className="px-4 py-3 editorial-number text-[10px] font-normal">Phrase</th>
              <th className="px-4 py-3 editorial-number text-[10px] font-normal">Priority / Quadrant</th>
              <th className="px-4 py-3 editorial-number text-[10px] font-normal">Enabled</th>
              <th className="px-4 py-3 editorial-number text-[10px] font-normal w-[80px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-muted-fg italic font-display">
                  Reading the lexicon&hellip;
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-muted-fg italic font-display">
                  No phrases yet for this locale &mdash; add the first one above.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/20">
                <td className="px-4 py-2 font-display">{r.phrase}</td>
                <td className="px-4 py-2">
                  <select
                    className="input h-8 text-xs"
                    value={r.priority}
                    onChange={(e) =>
                      patch(r.id, {
                        priority: parseInt(e.target.value, 10) as 0 | 1 | 3 | 5,
                      })
                    }
                  >
                    {[5, 3, 1, 0].map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => patch(r.id, { enabled: e.target.checked })}
                    />
                    {r.enabled ? "On" : "Off"}
                  </label>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => remove(r.id)}
                    className="btn-ghost size-8 p-0 grid place-items-center text-danger"
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------- Quadrants panel --------------- */

function QuadrantsPanel({ locale }: { locale: LanguageCode }) {
  const [rows, setRows] = useState<QuadrantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    const res = await fetch(`/api/admin/quadrants?locale=${encodeURIComponent(locale)}`);
    const j = await res.json().catch(() => ({}));
    if (res.ok) setRows((j.rows ?? []) as QuadrantRow[]);
    else toast.error(j.error ?? "Load failed");
    setLoading(false);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const byQuadrant = useMemo(() => {
    const out: Record<"q1" | "q2" | "q3" | "q4", QuadrantRow> = {} as any;
    (["q1", "q2", "q3", "q4"] as const).forEach((q) => {
      const found = rows.find((r) => r.quadrant === q);
      out[q] =
        found ?? {
          locale,
          quadrant: q,
          label: QUADRANT_DEFAULTS[q].label,
          fg_color: QUADRANT_DEFAULTS[q].fg,
          bg_color: QUADRANT_DEFAULTS[q].bg,
          border_color: QUADRANT_DEFAULTS[q].border,
        };
    });
    return out;
  }, [rows, locale]);

  async function save(quadrant: "q1" | "q2" | "q3" | "q4", patch: Partial<QuadrantRow>) {
    setBusy(true);
    const cur = byQuadrant[quadrant];
    const res = await fetch(`/api/admin/quadrants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        locale,
        quadrant,
        label: patch.label ?? cur.label,
        fg_color: patch.fg_color ?? cur.fg_color,
        bg_color: patch.bg_color ?? cur.bg_color,
        border_color: patch.border_color ?? cur.border_color,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Save failed");
      return;
    }
    reload();
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-fg italic font-display">
        Reading the matrix&hellip;
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {(["q1", "q2", "q3", "q4"] as const).map((q) => {
        const r = byQuadrant[q];
        return (
          <div
            key={q}
            className="border rounded-lg p-4"
            style={{
              backgroundColor: r.bg_color ?? undefined,
              borderColor: r.border_color ?? undefined,
              color: r.fg_color ?? undefined,
            }}
          >
            <div className="flex items-baseline gap-2 mb-3">
              <span className="editorial-number text-[10px] opacity-70">
                {q.toUpperCase()}
              </span>
              <input
                className="input flex-1 bg-white/70"
                value={r.label}
                onChange={(e) =>
                  setRows((prev) => {
                    const next = prev.filter((x) => x.quadrant !== q);
                    return [...next, { ...r, label: e.target.value }];
                  })
                }
                onBlur={(e) => save(q, { label: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ColorField
                label="Text"
                value={r.fg_color ?? "#000000"}
                onChange={(v) =>
                  setRows((prev) => {
                    const next = prev.filter((x) => x.quadrant !== q);
                    return [...next, { ...r, fg_color: v }];
                  })
                }
                onCommit={(v) => save(q, { fg_color: v })}
              />
              <ColorField
                label="Bg"
                value={r.bg_color ?? "#ffffff"}
                onChange={(v) =>
                  setRows((prev) => {
                    const next = prev.filter((x) => x.quadrant !== q);
                    return [...next, { ...r, bg_color: v }];
                  })
                }
                onCommit={(v) => save(q, { bg_color: v })}
              />
              <ColorField
                label="Border"
                value={r.border_color ?? "#d1d5db"}
                onChange={(v) =>
                  setRows((prev) => {
                    const next = prev.filter((x) => x.quadrant !== q);
                    return [...next, { ...r, border_color: v }];
                  })
                }
                onCommit={(v) => save(q, { border_color: v })}
              />
            </div>
            <button
              className="text-[11px] opacity-70 underline mt-3"
              disabled={busy}
              onClick={() => {
                const def = QUADRANT_DEFAULTS[q];
                save(q, {
                  label: def.label,
                  fg_color: def.fg,
                  bg_color: def.bg,
                  border_color: def.border,
                });
              }}
            >
              Reset to defaults
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
}) {
  return (
    <label className="block text-[10px]">
      <span className="opacity-70">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit(e.target.value)}
        className="block w-full h-8 rounded border border-black/10 bg-white"
      />
    </label>
  );
}
