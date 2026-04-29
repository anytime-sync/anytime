"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  RotateCcw,
  Save,
  Upload,
  Image as ImageIcon,
  Type,
  Move,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignOverrides, DesignMap } from "@/lib/design/types";

/**
 * /admin/design — visual editor.
 *
 * Layout: page-picker top bar + iframe preview on the left + side
 * panel on the right. The iframe loads each editable page with
 * `?design=edit` query, which makes the runtime listen for parent
 * postMessages (selection, override updates) and shoots back the
 * element_id of any clicked DesignSlot.
 *
 * Style overrides are SHARED across all locales — text per-locale
 * still lives in the existing /admin/content CMS.
 */

type EditablePage = { path: string; label: string; kicker: string };

const PAGES: EditablePage[] = [
  { kicker: "01", path: "/",            label: "Landing" },
  { kicker: "02", path: "/login",       label: "Login" },
  { kicker: "03", path: "/signup",      label: "Sign up" },
  { kicker: "04", path: "/app/today",   label: "Today" },
  { kicker: "05", path: "/app/matrix",  label: "The Sift" },
  { kicker: "06", path: "/app/calendar",label: "Calendar" },
  { kicker: "07", path: "/app/pomodoro",label: "Focus" },
  { kicker: "08", path: "/app/habits",  label: "Habits" },
  { kicker: "09", path: "/app/settings",label: "Settings" },
];

const FONT_FAMILIES = [
  { label: "Display (Cormorant)", value: "var(--font-cormorant), serif" },
  { label: "Body (Inter)",        value: "var(--font-inter), sans-serif" },
  { label: "Wordmark (Outfit)",   value: "var(--font-outfit), sans-serif" },
  { label: "System sans",         value: "system-ui, sans-serif" },
  { label: "Georgia",             value: "Georgia, serif" },
];

const WEIGHTS = ["300", "400", "500", "600", "700", "900"] as const;

export default function DesignPage() {
  const [page, setPage] = useState<string>("/");
  const [map, setMap] = useState<DesignMap>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ---------- load full design map on mount ----------
  useEffect(() => {
    (async () => {
      const r = await fetch("/api/design", { cache: "no-store" });
      if (r.ok) {
        const j = (await r.json()) as { map: DesignMap };
        setMap(j.map ?? {});
      }
    })();
  }, []);

  // ---------- listen to selection messages from iframe ----------
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const data = ev.data as
        | { type: "fl.design.select"; elementId: string }
        | { type: "fl.design.ready" }
        | undefined;
      if (!data || typeof data !== "object" || !("type" in data)) return;
      if (data.type === "fl.design.select") setSelected(data.elementId);
      if (data.type === "fl.design.ready") {
        // After iframe boots, push the full map so its DesignProvider
        // mirrors our local edits.
        const w = iframeRef.current?.contentWindow;
        if (w) w.postMessage({ type: "fl.design.bulk", map }, "*");
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [map]);

  const overrides = selected ? map[selected] ?? {} : {};

  function setOverride(patch: Partial<DesignOverrides>) {
    if (!selected) return;
    setMap((prev) => {
      const next = { ...prev };
      const merged = { ...(next[selected] ?? {}), ...patch };
      // Strip undefined so the JSON stays clean.
      for (const k of Object.keys(merged) as Array<keyof DesignOverrides>) {
        if (merged[k] === undefined) delete merged[k];
      }
      next[selected] = merged;
      return next;
    });
    // Echo into the iframe immediately for live preview.
    const w = iframeRef.current?.contentWindow;
    if (w && selected) {
      const merged: DesignOverrides = { ...(map[selected] ?? {}), ...patch };
      w.postMessage(
        { type: "fl.design.update", elementId: selected, overrides: merged },
        "*"
      );
    }
  }

  async function save() {
    if (!selected) return;
    setSavingId(selected);
    const overrides = map[selected] ?? {};
    const r = await fetch(`/api/design/${encodeURIComponent(selected)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ overrides }),
    });
    setSavingId(null);
    if (!r.ok) {
      toast.error("Save failed");
      return;
    }
    toast.success("Saved");
  }

  async function reset() {
    if (!selected) return;
    setSavingId(selected);
    const r = await fetch(`/api/design/${encodeURIComponent(selected)}`, {
      method: "DELETE",
    });
    setSavingId(null);
    if (!r.ok) return toast.error("Reset failed");
    setMap((prev) => {
      const next = { ...prev };
      delete next[selected!];
      return next;
    });
    const w = iframeRef.current?.contentWindow;
    if (w && selected) {
      w.postMessage(
        { type: "fl.design.update", elementId: selected, overrides: null },
        "*"
      );
    }
    toast.success("Reverted");
  }

  async function uploadBg(file: File) {
    if (!selected) return;
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/design/upload", { method: "POST", body: fd });
    if (!r.ok) {
      toast.error("Upload failed");
      return;
    }
    const j = (await r.json()) as { url: string };
    setOverride({ bgImageUrl: j.url, bgSize: "cover", bgPosition: "center" });
    toast.success("Image set");
  }

  const pageMeta = useMemo(() => PAGES.find((p) => p.path === page) ?? PAGES[0]!, [page]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="px-8 py-5 border-b border-border flex items-center gap-6">
        <div>
          <p className="editorial-number text-[10px]">The Admin Edition · Issue No. 05</p>
          <h1 className="font-display text-2xl tracking-tight"><em>Design</em>, by hand.</h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <select
            value={page}
            onChange={(e) => {
              setPage(e.target.value);
              setSelected(null);
              setIframeKey((k) => k + 1);
            }}
            className="input h-9 text-sm"
          >
            {PAGES.map((p) => (
              <option key={p.path} value={p.path}>
                {p.kicker} · {p.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setIframeKey((k) => k + 1)}
            className="btn-ghost h-9 text-xs"
          >
            Reload preview
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[1fr_360px] overflow-hidden">
        {/* iframe preview */}
        <div className="bg-muted/30 overflow-hidden">
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={`${pageMeta.path}?design=edit`}
            title={`Preview: ${pageMeta.label}`}
            className="w-full h-full border-0"
          />
        </div>

        {/* Side panel */}
        <aside className="border-l border-border surface overflow-y-auto">
          {!selected ? (
            <EmptyHint />
          ) : (
            <div className="p-5 space-y-5">
              <div>
                <p className="editorial-number text-[10px]">Selected</p>
                <code className="text-[11px] font-mono break-all">{selected}</code>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={save}
                    disabled={savingId === selected}
                    className="btn-primary h-8 text-xs px-3 inline-flex items-center gap-1.5"
                  >
                    <Save className="size-3" />
                    {savingId === selected ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={reset}
                    disabled={savingId === selected}
                    className="btn-ghost h-8 text-xs px-3 inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="size-3" />
                    Reset
                  </button>
                  <button
                    onClick={() => setOverride({ hidden: !overrides.hidden })}
                    className="btn-ghost h-8 text-xs px-3 inline-flex items-center gap-1.5 ml-auto"
                  >
                    {overrides.hidden ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                    {overrides.hidden ? "Show" : "Hide"}
                  </button>
                </div>
              </div>

              {/* Typography */}
              <Section icon={Type} title="Typography">
                <Row label="Font face">
                  <select
                    value={overrides.fontFamily ?? ""}
                    onChange={(e) =>
                      setOverride({ fontFamily: e.target.value || undefined })
                    }
                    className="input h-8 text-xs w-full"
                  >
                    <option value="">(default)</option>
                    {FONT_FAMILIES.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </Row>
                <Row label="Size">
                  <input
                    type="text"
                    placeholder="e.g. 5rem, 72px"
                    value={overrides.fontSize ?? ""}
                    onChange={(e) =>
                      setOverride({ fontSize: e.target.value || undefined })
                    }
                    className="input h-8 text-xs w-full"
                  />
                </Row>
                <Row label="Weight">
                  <div className="flex flex-wrap gap-1">
                    {WEIGHTS.map((w) => (
                      <button
                        key={w}
                        onClick={() =>
                          setOverride({
                            fontWeight: overrides.fontWeight === w ? undefined : w,
                          })
                        }
                        className={cn(
                          "h-7 px-2 text-[11px] rounded border border-border",
                          overrides.fontWeight === w
                            ? "bg-fg text-bg"
                            : "btn-ghost"
                        )}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row label="Style">
                  <div className="flex gap-1">
                    {(["normal", "italic"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() =>
                          setOverride({
                            fontStyle: overrides.fontStyle === s ? undefined : s,
                          })
                        }
                        className={cn(
                          "h-7 px-3 text-[11px] rounded border border-border",
                          overrides.fontStyle === s
                            ? "bg-fg text-bg"
                            : "btn-ghost"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row label="Color">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={overrides.color ?? "#000000"}
                      onChange={(e) => setOverride({ color: e.target.value })}
                      className="size-8 rounded border border-border bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="any CSS color"
                      value={overrides.color ?? ""}
                      onChange={(e) =>
                        setOverride({ color: e.target.value || undefined })
                      }
                      className="input h-8 text-xs flex-1"
                    />
                  </div>
                </Row>
                <Row label="Line height">
                  <input
                    type="text"
                    placeholder="1.05"
                    value={overrides.lineHeight ?? ""}
                    onChange={(e) =>
                      setOverride({ lineHeight: e.target.value || undefined })
                    }
                    className="input h-8 text-xs w-full"
                  />
                </Row>
                <Row label="Letter spacing">
                  <input
                    type="text"
                    placeholder="-0.02em"
                    value={overrides.letterSpacing ?? ""}
                    onChange={(e) =>
                      setOverride({ letterSpacing: e.target.value || undefined })
                    }
                    className="input h-8 text-xs w-full"
                  />
                </Row>
                <Row label="Align">
                  <div className="flex gap-1">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() =>
                          setOverride({
                            textAlign: overrides.textAlign === a ? undefined : a,
                          })
                        }
                        className={cn(
                          "h-7 px-3 text-[11px] rounded border border-border",
                          overrides.textAlign === a
                            ? "bg-fg text-bg"
                            : "btn-ghost"
                        )}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </Row>
              </Section>

              {/* Transform */}
              <Section icon={Move} title="Transform">
                <Row label="Translate X">
                  <NumberSlider
                    value={overrides.translateX ?? 0}
                    min={-500} max={500} step={1}
                    onChange={(v) =>
                      setOverride({ translateX: v === 0 ? undefined : v })
                    }
                    suffix="px"
                  />
                </Row>
                <Row label="Translate Y">
                  <NumberSlider
                    value={overrides.translateY ?? 0}
                    min={-500} max={500} step={1}
                    onChange={(v) =>
                      setOverride({ translateY: v === 0 ? undefined : v })
                    }
                    suffix="px"
                  />
                </Row>
                <Row label="Scale">
                  <NumberSlider
                    value={overrides.scale ?? 1}
                    min={0.2} max={3} step={0.05}
                    onChange={(v) =>
                      setOverride({ scale: v === 1 ? undefined : v })
                    }
                  />
                </Row>
                <Row label="Rotate">
                  <NumberSlider
                    value={overrides.rotate ?? 0}
                    min={-180} max={180} step={1}
                    onChange={(v) =>
                      setOverride({ rotate: v === 0 ? undefined : v })
                    }
                    suffix="°"
                  />
                </Row>
                <Row label="Opacity">
                  <NumberSlider
                    value={overrides.opacity ?? 1}
                    min={0} max={1} step={0.05}
                    onChange={(v) =>
                      setOverride({ opacity: v === 1 ? undefined : v })
                    }
                  />
                </Row>
              </Section>

              {/* Background image */}
              <Section icon={ImageIcon} title="Background image">
                <div className="space-y-2">
                  {overrides.bgImageUrl ? (
                    <div className="relative">
                      <img
                        src={overrides.bgImageUrl}
                        alt=""
                        className="w-full rounded border border-border"
                      />
                      <button
                        onClick={() => setOverride({ bgImageUrl: null })}
                        className="absolute top-1 right-1 btn-ghost text-[10px] h-6 px-2 bg-bg/80"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-fg italic font-display">
                      No image. Upload one below.
                    </p>
                  )}
                  <label className="btn-ghost h-8 text-xs px-3 inline-flex items-center gap-1.5 cursor-pointer">
                    <Upload className="size-3" />
                    Upload image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadBg(f);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                <Row label="Position">
                  <input
                    type="text"
                    placeholder="center / 50% 30%"
                    value={overrides.bgPosition ?? ""}
                    onChange={(e) =>
                      setOverride({ bgPosition: e.target.value || undefined })
                    }
                    className="input h-8 text-xs w-full"
                  />
                </Row>
                <Row label="Size">
                  <input
                    type="text"
                    placeholder="cover / contain / 120%"
                    value={overrides.bgSize ?? ""}
                    onChange={(e) =>
                      setOverride({ bgSize: e.target.value || undefined })
                    }
                    className="input h-8 text-xs w-full"
                  />
                </Row>
              </Section>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="p-8 space-y-3">
      <p className="editorial-number text-[10px]">Click any element</p>
      <h2 className="font-display text-xl"><em>Pick something</em></h2>
      <p className="text-xs text-muted-fg leading-relaxed">
        Hover over the preview — every editable element will outline. Click
        to select. Then tune typography, transform, or upload a background
        image. Style overrides apply across all languages; per-locale text
        still lives in <code>/admin/content</code>.
      </p>
      <p className="text-[10px] text-muted-fg italic font-display pt-3">
        New element ids inherit the page&rsquo;s defaults until you save an override.
      </p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-accent" />
        <p className="editorial-number text-[10px]">{title}</p>
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-center gap-2">
      <label className="text-[11px] text-muted-fg">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function NumberSlider({
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-accent"
      />
      <span className="tabular-nums text-[10px] text-muted-fg w-12 text-right">
        {value.toFixed(step < 1 ? 2 : 0)}
        {suffix ?? ""}
      </span>
    </div>
  );
}
