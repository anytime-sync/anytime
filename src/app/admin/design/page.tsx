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
  Plus,
  Trash2,
  SunMedium,
  Moon,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { DesignOverrides, DesignMap } from "@/lib/design/types";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";

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
  // Day/Night editing mode for background-image fields. Drives a
  // preview-mode marker on the iframe (.fl-night-preview) so the user
  // can see night styling without flipping the actual theme, and routes
  // bg-image edits to the right side of the override pair.
  const [bgMode, setBgMode] = useState<"day" | "night">("day");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Forward bgMode -> iframe whenever it changes (or after iframe reload).
  useEffect(() => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage(
      { type: "fl.design.preview-mode", mode: bgMode === "night" ? "night" : "day" },
      "*"
    );
  }, [bgMode, iframeKey]);

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

  // ---------- listen to selection / inline-text messages from iframe ----------
  useEffect(() => {
    async function saveText(textKey: string, value: string, locale: string) {
      const supabase = createClient();
      const trimmed = value.trim();
      if (!trimmed) {
        await supabase.from("site_content").delete().eq("locale", locale).eq("key", textKey);
        toast.success(`Reverted to default (${locale})`);
      } else {
        const { error } = await supabase.from("site_content").upsert({
          locale,
          key: textKey,
          value: trimmed,
          updated_at: new Date().toISOString(),
        });
        if (error) { toast.error("Save failed: " + error.message); return; }
        toast.success(`Saved (${locale})`);
      }
    }
    function onMsg(ev: MessageEvent) {
      const data = ev.data as
        | { type: "fl.design.select"; elementId: string }
        | { type: "fl.design.ready" }
        | { type: "fl.design.text"; textKey: string; value: string; locale: string }
        | { type: "fl.design.move"; elementId: string; x: number; y: number }
        | { type: "fl.design.floating-text"; elementId: string; value: string; locale: string }
        | { type: "fl.design.bg-pan"; elementId: string; bgPosition: string; mode?: "light" | "dark" }
        | undefined;
      if (!data || typeof data !== "object" || !("type" in data)) return;
      if (data.type === "fl.design.select") setSelected(data.elementId);
      if (data.type === "fl.design.ready") {
        const w = iframeRef.current?.contentWindow;
        if (w) w.postMessage({ type: "fl.design.bulk", map }, "*");
      }
      if (data.type === "fl.design.text") {
        void saveText(data.textKey, data.value, data.locale);
      }
      if (data.type === "fl.design.move") {
        void persistMove(data.elementId, data.x, data.y);
      }
      if (data.type === "fl.design.floating-text") {
        void persistFloatingText(data.elementId, data.value, data.locale);
      }
      if (data.type === "fl.design.bg-pan") {
        void persistBgPan(data.elementId, data.bgPosition, data.mode === "dark" ? "dark" : "light");
      }
    }
    async function persistFloatingText(elementId: string, value: string, locale: string) {
      const current = map[elementId] ?? {};
      const trimmed = value.trim();
      let merged: DesignOverrides;
      if (locale === "en") {
        merged = { ...current, _text: trimmed };
      } else {
        const _texts = { ...(current._texts ?? {}) };
        if (trimmed) _texts[locale] = trimmed;
        else delete _texts[locale];
        merged = { ...current, _texts: Object.keys(_texts).length ? _texts : undefined };
      }
      setMap((prev) => ({ ...prev, [elementId]: merged }));
      const r = await fetch(`/api/design/${encodeURIComponent(elementId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ overrides: merged }),
      });
      if (!r.ok) toast.error("Save failed");
      else toast.success(`Saved (${locale})`);
    }
    async function persistBgPan(elementId: string, bgPosition: string, mode: "light" | "dark") {
      const current = map[elementId] ?? {};
      const merged: DesignOverrides = mode === "dark"
        ? { ...current, bgPositionDark: bgPosition }
        : { ...current, bgPosition };
      setMap((prev) => ({ ...prev, [elementId]: merged }));
      const r = await fetch(`/api/design/${encodeURIComponent(elementId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ overrides: merged }),
      });
      if (!r.ok) toast.error("Save failed");
    }
    async function persistMove(elementId: string, x: number, y: number) {
      const current = map[elementId] ?? {};
      const merged = { ...current, _x: x, _y: y };
      setMap((prev) => ({ ...prev, [elementId]: merged }));
      const r = await fetch(`/api/design/${encodeURIComponent(elementId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ overrides: merged }),
      });
      if (!r.ok) toast.error("Move failed");
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

  async function persistFloatingTextDirect(
    elementId: string,
    value: string,
    locale: string
  ) {
    const current = map[elementId] ?? {};
    const trimmed = value.trim();
    let merged: DesignOverrides;
    if (locale === "en") {
      merged = { ...current, _text: trimmed };
    } else {
      const _texts = { ...(current._texts ?? {}) };
      if (trimmed) _texts[locale] = trimmed;
      else delete _texts[locale];
      merged = { ...current, _texts: Object.keys(_texts).length ? _texts : undefined };
    }
    setMap((prev) => ({ ...prev, [elementId]: merged }));
    const w = iframeRef.current?.contentWindow;
    if (w) w.postMessage({ type: "fl.design.update", elementId, overrides: merged }, "*");
    const r = await fetch(`/api/design/${encodeURIComponent(elementId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ overrides: merged }),
    });
    if (!r.ok) toast.error("Save failed");
    else toast.success(`Saved (${locale})`);
  }

  async function addFloating() {
    const slug = page.replace(/\//g, "_") || "_root";
    const uuid = (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
    ).slice(0, 8);
    const elementId = `floating.${slug}.${uuid}`;
    const overrides: DesignOverrides = {
      _kind: "floating",
      _page: page,
      _text: "New text",
      _x: 120,
      _y: 200,
      fontFamily: "var(--font-display)",
      fontSize: "1.5rem",
      color: "#000000",
    };
    const r = await fetch(`/api/design/${encodeURIComponent(elementId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ overrides }),
    });
    if (!r.ok) { toast.error("Could not add text"); return; }
    setMap((prev) => ({ ...prev, [elementId]: overrides }));
    setSelected(elementId);
    const w = iframeRef.current?.contentWindow;
    if (w) w.postMessage({ type: "fl.design.update", elementId, overrides }, "*");
    toast.success("Text added \u2014 drag to position");
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!confirm("Delete this element?")) return;
    setSavingId(selected);
    const r = await fetch(`/api/design/${encodeURIComponent(selected)}`, { method: "DELETE" });
    setSavingId(null);
    if (!r.ok) { toast.error("Delete failed"); return; }
    setMap((prev) => { const next = { ...prev }; delete next[selected]; return next; });
    const w = iframeRef.current?.contentWindow;
    if (w) w.postMessage({ type: "fl.design.update", elementId: selected, overrides: null }, "*");
    setSelected(null);
    toast.success("Deleted");
  }

  async function uploadBg(file: File, mode: "day" | "night") {
    if (!selected) return;
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/design/upload", { method: "POST", body: fd });
    if (!r.ok) {
      toast.error("Upload failed");
      return;
    }
    const j = (await r.json()) as { url: string };
    if (mode === "night") {
      setOverride({
        bgImageUrlDark: j.url,
        bgSizeDark: "cover",
        bgPositionDark: "center",
      });
    } else {
      setOverride({
        bgImageUrl: j.url,
        bgSize: "cover",
        bgPosition: "center",
      });
    }
    toast.success(`Image set (${mode})`);
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
            onClick={addFloating}
            className="btn-ghost h-9 text-xs inline-flex items-center gap-1.5"
            title="Add a free-positioned text element to this page"
          >
            <Plus className="size-3" />
            Text
          </button>
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
                  {selected.startsWith("floating.") && (
                    <button
                      onClick={deleteSelected}
                      disabled={savingId === selected}
                      className="btn-ghost h-8 text-xs px-3 inline-flex items-center gap-1.5 text-danger"
                      title="Delete this floating element"
                    >
                      <Trash2 className="size-3" />
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Per-locale text content (floating elements only) */}
              {selected.startsWith("floating.") && (
                <FloatingTextEditor
                  overrides={overrides}
                  onSaveLocale={(locale, value) => {
                    void persistFloatingTextDirect(selected, value, locale);
                  }}
                />
              )}

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
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={8}
                      max={200}
                      step={1}
                      value={parseFontSizePx(overrides.fontSize)}
                      onChange={(e) =>
                        setOverride({ fontSize: e.target.value + "px" })
                      }
                      className="flex-1 accent-accent"
                    />
                    <input
                      type="text"
                      placeholder="72px"
                      value={overrides.fontSize ?? ""}
                      onChange={(e) =>
                        setOverride({ fontSize: e.target.value || undefined })
                      }
                      className="input h-8 text-xs w-20"
                    />
                  </div>
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

              {/* Background image — per-mode (day / night) */}
              <Section icon={ImageIcon} title="Background image">
                {/* Day / Night tabs. Selecting Night flips the iframe into
                    .fl-night-preview so the user sees night styling without
                    changing their actual theme; all uploads + sliders below
                    are wired to the active mode's override fields. */}
                <div className="flex items-center gap-1 mb-1">
                  <button
                    onClick={() => setBgMode("day")}
                    className={cn(
                      "h-7 px-2.5 text-[11px] rounded border border-border inline-flex items-center gap-1.5",
                      bgMode === "day" ? "bg-fg text-bg" : "btn-ghost"
                    )}
                  >
                    <SunMedium className="size-3" />
                    Day
                    {overrides.bgImageUrl && (
                      <span className="size-1.5 rounded-full bg-accent inline-block" aria-hidden />
                    )}
                  </button>
                  <button
                    onClick={() => setBgMode("night")}
                    className={cn(
                      "h-7 px-2.5 text-[11px] rounded border border-border inline-flex items-center gap-1.5",
                      bgMode === "night" ? "bg-fg text-bg" : "btn-ghost"
                    )}
                  >
                    <Moon className="size-3" />
                    Night
                    {overrides.bgImageUrlDark && (
                      <span className="size-1.5 rounded-full bg-accent inline-block" aria-hidden />
                    )}
                  </button>
                  {bgMode === "night" && !overrides.bgImageUrlDark && overrides.bgImageUrl && (
                    <span className="text-[10px] text-muted-fg italic font-display ml-auto">
                      Falls back to Day
                    </span>
                  )}
                </div>

                {/* Active-mode preview + remove + upload */}
                <div className="space-y-2">
                  {(bgMode === "day" ? overrides.bgImageUrl : overrides.bgImageUrlDark) ? (
                    <div className="relative">
                      <img
                        src={(bgMode === "day" ? overrides.bgImageUrl : overrides.bgImageUrlDark) ?? ""}
                        alt=""
                        className="w-full rounded border border-border"
                      />
                      <button
                        onClick={() =>
                          setOverride(
                            bgMode === "day"
                              ? { bgImageUrl: null }
                              : { bgImageUrlDark: null }
                          )
                        }
                        className="absolute top-1 right-1 btn-ghost text-[10px] h-6 px-2 bg-bg/80"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-fg italic font-display">
                      No {bgMode} image. Upload one below.
                    </p>
                  )}
                  <label className="btn-ghost h-8 text-xs px-3 inline-flex items-center gap-1.5 cursor-pointer">
                    <Upload className="size-3" />
                    Upload {bgMode} image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadBg(f, bgMode);
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
                    value={
                      bgMode === "day"
                        ? overrides.bgPosition ?? ""
                        : overrides.bgPositionDark ?? ""
                    }
                    onChange={(e) => {
                      const v = e.target.value || undefined;
                      setOverride(
                        bgMode === "day" ? { bgPosition: v } : { bgPositionDark: v }
                      );
                    }}
                    className="input h-8 text-xs w-full"
                  />
                </Row>
                <Row label="Zoom">
                  <NumberSlider
                    value={parseBgZoomPct(
                      bgMode === "day" ? overrides.bgSize : overrides.bgSizeDark
                    )}
                    min={50} max={300} step={5}
                    onChange={(v) => {
                      const next = v === 100 ? undefined : `${v}%`;
                      setOverride(
                        bgMode === "day" ? { bgSize: next } : { bgSizeDark: next }
                      );
                    }}
                    suffix="%"
                  />
                </Row>
                <Row label="Size">
                  <input
                    type="text"
                    placeholder="cover / contain / 120%"
                    value={
                      bgMode === "day"
                        ? overrides.bgSize ?? ""
                        : overrides.bgSizeDark ?? ""
                    }
                    onChange={(e) => {
                      const v = e.target.value || undefined;
                      setOverride(
                        bgMode === "day" ? { bgSize: v } : { bgSizeDark: v }
                      );
                    }}
                    className="input h-8 text-xs w-full"
                  />
                </Row>
              </Section>

              {/* Element dimensions (shared across modes) */}
              <Section icon={Maximize2} title="Dimensions">
                <Row label="Width">
                  <input
                    type="text"
                    placeholder="auto / 100% / 480px"
                    value={overrides.width ?? ""}
                    onChange={(e) =>
                      setOverride({ width: e.target.value || undefined })
                    }
                    className="input h-8 text-xs w-full"
                  />
                </Row>
                <Row label="Height">
                  <input
                    type="text"
                    placeholder="auto / 50vh / 360px"
                    value={overrides.height ?? ""}
                    onChange={(e) =>
                      setOverride({ height: e.target.value || undefined })
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

function FloatingTextEditor({
  overrides,
  onSaveLocale,
}: {
  overrides: DesignOverrides;
  onSaveLocale: (locale: LanguageCode, value: string) => void;
}) {
  const [tab, setTab] = useState<LanguageCode>("en");
  const current = tab === "en" ? overrides._text ?? "" : overrides._texts?.[tab] ?? "";
  const [draft, setDraft] = useState(current);
  useEffect(() => { setDraft(current); }, [tab, overrides._text, overrides._texts]);
  const dirty = draft !== current;
  return (
    <section className="space-y-2.5 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <Type className="size-3.5 text-accent" />
        <p className="editorial-number text-[10px]">Text content</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {LANGUAGES.map((l) => {
          const has = l.code === "en" ? Boolean(overrides._text) : Boolean(overrides._texts?.[l.code]);
          return (
            <button
              key={l.code}
              onClick={() => setTab(l.code)}
              className={cn(
                "h-7 px-2 text-[11px] rounded border border-border inline-flex items-center gap-1",
                tab === l.code ? "bg-fg text-bg" : "btn-ghost"
              )}
            >
              {l.code}
              {has && <span className="size-1.5 rounded-full bg-accent inline-block" aria-hidden />}
            </button>
          );
        })}
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder={tab === "en" ? "Baseline text (English)" : `${tab} override (falls back to English when empty)`}
        className="input w-full text-sm leading-relaxed resize-y min-h-[34px]"
      />
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => onSaveLocale(tab, draft)}
          disabled={!dirty}
          className={cn(
            "btn-ghost px-2 h-7 inline-flex items-center gap-1.5",
            dirty && "text-fg hover:bg-accent/10",
            !dirty && "opacity-40 cursor-not-allowed"
          )}
        >
          Save {tab}
        </button>
        {tab !== "en" && (overrides._texts?.[tab] ?? "") && (
          <button
            onClick={() => onSaveLocale(tab, "")}
            className="btn-ghost px-2 h-7 text-muted-fg"
          >
            Clear override
          </button>
        )}
      </div>
    </section>
  );
}

function parseFontSizePx(s: string | undefined): number {
  if (!s) return 16;
  const m = /^([\d.]+)\s*(px|rem|em|%)?$/.exec(s.trim());
  if (!m) return 16;
  const n = parseFloat(m[1]!);
  const unit = m[2] || "px";
  if (unit === "px") return Math.round(n);
  if (unit === "rem" || unit === "em") return Math.round(n * 16);
  if (unit === "%") return Math.round((n / 100) * 16);
  return 16;
}

function parseBgZoomPct(bgSize: string | undefined): number {
  if (!bgSize) return 100;
  const m = /^(\d+(?:\.\d+)?)%$/.exec(bgSize.trim());
  if (m) return parseFloat(m[1]!);
  return 100;
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
