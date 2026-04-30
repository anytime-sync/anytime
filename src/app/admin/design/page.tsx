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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignOverrides, DesignMap, StyleFields } from "@/lib/design/types";
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
  // Day vs Night editing — drives BOTH the iframe preview palette AND
  // where each style edit gets persisted (top-level vs `night` sub).
  const [bgMode, setBgMode] = useState<"day" | "night">("day");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [bgPanMode, setBgPanMode] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-save plumbing. We keep the latest map in a ref so the
  // debounced flush can read fresh state without stale closures, and
  // a Set of dirty element ids so multiple in-flight edits coalesce
  // into a single PUT per element.
  const mapRef = useRef<DesignMap>({});
  useEffect(() => {
    mapRef.current = map;
  }, [map]);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function autoSave(id: string) {
    dirtyIdsRef.current.add(id);
    setAutoSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const ids = Array.from(dirtyIdsRef.current);
      dirtyIdsRef.current.clear();
      let anyError = false;
      for (const elementId of ids) {
        const overrides = mapRef.current[elementId];
        if (overrides === undefined) continue;
        try {
          const r = await fetch(
            `/api/design/${encodeURIComponent(elementId)}`,
            {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ overrides }),
            }
          );
          if (!r.ok) anyError = true;
        } catch {
          anyError = true;
        }
      }
      setAutoSaveStatus(anyError ? "error" : "saved");
      if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current);
      savedToastTimerRef.current = setTimeout(
        () => setAutoSaveStatus("idle"),
        1500
      );
    }, 450);
  }

  // When the operator flips Day/Night (or the iframe reloads), tell
  // the iframe to mirror the mode by toggling `.fl-night-preview` on
  // <html>. That class re-styles the entire palette + flips the
  // useIsDark() hook, so DesignSlots resolve their `night` overrides.
  useEffect(() => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage({ type: "fl.design.set-mode", mode: bgMode }, "*");
  }, [bgMode, iframeKey]);

  // Mirror bg-pan mode into the iframe.
  useEffect(() => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage({ type: "fl.design.set-bg-pan", on: bgPanMode }, "*");
  }, [bgPanMode, iframeKey]);

  // Reset pan mode whenever the user switches pages (iframe reload).
  useEffect(() => {
    setBgPanMode(false);
  }, [iframeKey]);

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
      // Route through the admin API instead of writing site_content
      // directly from the browser. RLS on that table references
      // auth.users, and the anon role doesn't have SELECT on `users` —
      // so direct upserts came back as "permission denied for table
      // users". The /api/design/content endpoint runs with the
      // service-role client after verifying admin auth.
      const trimmed = value.trim();
      const r = await fetch("/api/design/content", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale, key: textKey, value: trimmed }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error("Save failed: " + (j.error ?? r.statusText));
        return;
      }
      if (!trimmed) toast.success(`Reverted to default (${locale})`);
      else toast.success(`Saved (${locale})`);
    }

    function onMsg(ev: MessageEvent) {
      const data = ev.data as
        | { type: "fl.design.select"; elementId: string }
        | { type: "fl.design.ready" }
        | { type: "fl.design.text"; textKey: string; value: string; locale: string }
        | { type: "fl.design.move"; elementId: string; x: number; y: number }
        | { type: "fl.design.floating-text"; elementId: string; value: string; locale: string }
        | { type: "fl.design.bg-pan"; elementId: string; bgPosition: string }
        | { type: "fl.design.bg-pan-exited" }
        | undefined;
      if (!data || typeof data !== "object" || !("type" in data)) return;
      if (data.type === "fl.design.select") setSelected(data.elementId);
      if (data.type === "fl.design.ready") {
        // After iframe boots, push the full map so its DesignProvider
        // mirrors our local edits, then re-apply the active mode so the
        // night-preview class gets re-set after a reload.
        const w = iframeRef.current?.contentWindow;
        if (w) {
          w.postMessage({ type: "fl.design.bulk", map }, "*");
          w.postMessage({ type: "fl.design.set-mode", mode: bgMode }, "*");
        }
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
        void persistBgPan(data.elementId, data.bgPosition);
      }
      if (data.type === "fl.design.bg-pan-exited") {
        setBgPanMode(false);
      }
    }
    async function persistFloatingText(elementId: string, value: string, locale: string) {
      const current = map[elementId] ?? {};
      const trimmed = value.trim();
      let merged: DesignOverrides;
      if (locale === "en") {
        // English is the baseline `_text`; we don't store under `_texts.en`.
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
    async function persistBgPan(elementId: string, bgPosition: string) {
      const current = map[elementId] ?? {};
      // Route to the active mode: day → top-level bgPosition, night → night.bgPosition
      let merged: DesignOverrides;
      if (bgMode === "night") {
        const night = { ...(current.night ?? {}), bgPosition };
        merged = { ...current, night };
      } else {
        merged = { ...current, bgPosition };
      }
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
  }, [map, bgMode]);

  const overrides = selected ? map[selected] ?? {} : {};

  // Effective override for READING input values: when in night mode,
  // night-side fields win (with day fallback). When in day mode this
  // is just `overrides` unchanged. Floating + meta fields stay shared.
  const eff: DesignOverrides & Partial<StyleFields> =
    bgMode === "night" && overrides.night
      ? { ...overrides, ...overrides.night }
      : overrides;

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
      // Strip undefined for the echo too.
      for (const k of Object.keys(merged) as Array<keyof DesignOverrides>) {
        if (merged[k] === undefined) delete merged[k];
      }
      w.postMessage(
        { type: "fl.design.update", elementId: selected, overrides: merged },
        "*"
      );
    }
    autoSave(selected);
  }

  /**
   * Style-field setter — routes the patch into the right bucket based
   * on bgMode. In day mode it writes top-level (so existing rows stay
   * shaped exactly as before). In night mode it writes into the
   * `night` sub-object, leaving the day value untouched as the
   * fallback. Setting a field to `undefined` removes it from that
   * bucket; if the night bucket becomes empty, it's stripped entirely.
   */
  function setStyle(patch: Partial<StyleFields>) {
    if (!selected) return;
    if (bgMode === "day") {
      setOverride(patch);
      return;
    }
    setMap((prev) => {
      const next = { ...prev };
      const current = next[selected] ?? {};
      const nextNight: StyleFields = { ...(current.night ?? {}), ...patch };
      for (const k of Object.keys(nextNight) as Array<keyof StyleFields>) {
        if (nextNight[k] === undefined) delete nextNight[k];
      }
      const merged: DesignOverrides = { ...current };
      if (Object.keys(nextNight).length > 0) merged.night = nextNight;
      else delete merged.night;
      next[selected] = merged;
      return next;
    });
    // Echo into iframe.
    const w = iframeRef.current?.contentWindow;
    if (w && selected) {
      const current = map[selected] ?? {};
      const nextNight: StyleFields = { ...(current.night ?? {}), ...patch };
      for (const k of Object.keys(nextNight) as Array<keyof StyleFields>) {
        if (nextNight[k] === undefined) delete nextNight[k];
      }
      const merged: DesignOverrides = { ...current };
      if (Object.keys(nextNight).length > 0) merged.night = nextNight;
      else delete merged.night;
      w.postMessage(
        { type: "fl.design.update", elementId: selected, overrides: merged },
        "*"
      );
    }
    autoSave(selected);
  }

  function clearNightOverrides() {
    if (!selected) return;
    setMap((prev) => {
      const next = { ...prev };
      const current = next[selected] ?? {};
      const merged: DesignOverrides = { ...current };
      delete merged.night;
      next[selected] = merged;
      return next;
    });
    const w = iframeRef.current?.contentWindow;
    if (w && selected) {
      const current = map[selected] ?? {};
      const merged: DesignOverrides = { ...current };
      delete merged.night;
      w.postMessage(
        { type: "fl.design.update", elementId: selected, overrides: merged },
        "*"
      );
    }
    autoSave(selected);
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
    // Mirror into iframe so it reflects without reload.
    const w = iframeRef.current?.contentWindow;
    if (w) {
      w.postMessage({ type: "fl.design.update", elementId, overrides: merged }, "*");
    }
    const r = await fetch(`/api/design/${encodeURIComponent(elementId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ overrides: merged }),
    });
    if (!r.ok) toast.error("Save failed");
    else toast.success(`Saved (${locale})`);
  }

  async function addFloating() {
    // Generate a unique id rooted by current page path so the FloatingLayer
    // for that page picks it up. Default position drops in the visible
    // center-ish area of the iframe.
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
    if (!r.ok) {
      toast.error("Could not add text");
      return;
    }
    setMap((prev) => ({ ...prev, [elementId]: overrides }));
    setSelected(elementId);
    // Mirror into the iframe so it appears immediately.
    const w = iframeRef.current?.contentWindow;
    if (w) {
      w.postMessage(
        { type: "fl.design.update", elementId, overrides },
        "*"
      );
    }
    toast.success("Text added — drag to position");
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!confirm("Delete this element?")) return;
    setSavingId(selected);
    const r = await fetch(`/api/design/${encodeURIComponent(selected)}`, {
      method: "DELETE",
    });
    setSavingId(null);
    if (!r.ok) {
      toast.error("Delete failed");
      return;
    }
    setMap((prev) => {
      const next = { ...prev };
      delete next[selected];
      return next;
    });
    const w = iframeRef.current?.contentWindow;
    if (w) {
      w.postMessage(
        { type: "fl.design.update", elementId: selected, overrides: null },
        "*"
      );
    }
    setSelected(null);
    toast.success("Deleted");
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
    setStyle({ bgImageUrl: j.url, bgSize: "cover", bgPosition: "center" });
    toast.success(`Image set (${bgMode})`);
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
            onClick={() => setBgPanMode((v) => !v)}
            className={cn(
              "h-9 text-xs px-3 inline-flex items-center gap-1.5 rounded-md border",
              bgPanMode
                ? "bg-accent text-accent-fg border-accent"
                : "btn-ghost border-border"
            )}
            title="Lift the photo backdrop above content so you can drag-pan it from anywhere"
          >
            <ImageIcon className="size-3" />
            {bgPanMode ? "Panning… Esc to exit" : "Pan backdrop"}
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
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[10px] tabular-nums px-2 h-7 rounded border border-border",
                      autoSaveStatus === "saving" && "text-muted-fg",
                      autoSaveStatus === "saved" && "text-success",
                      autoSaveStatus === "error" && "text-danger",
                      autoSaveStatus === "idle" && "text-muted-fg italic"
                    )}
                    title="Changes save automatically"
                  >
                    <Save className="size-3" />
                    {autoSaveStatus === "saving" && "Saving…"}
                    {autoSaveStatus === "saved" && "Saved"}
                    {autoSaveStatus === "error" && "Save failed"}
                    {autoSaveStatus === "idle" && "Auto-save on"}
                  </span>
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

              {/* Day / Night editing scope — drives BOTH the iframe preview
                  palette AND where every style edit below gets saved. */}
              <div className="rounded-md border border-border bg-bg/40 p-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="editorial-number text-[10px]">Editing</p>
                  <div className="ml-auto inline-flex rounded-md border border-border overflow-hidden">
                    {(["day", "night"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setBgMode(m)}
                        className={cn(
                          "h-7 px-3 text-[11px] capitalize",
                          bgMode === m
                            ? "bg-fg text-bg"
                            : "btn-ghost"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-muted-fg leading-snug">
                  {bgMode === "day"
                    ? "Edits apply to the daytime appearance."
                    : "Edits apply to nighttime only — empty fields fall back to the day value."}
                </p>
                {bgMode === "night" && overrides.night && (
                  <button
                    onClick={clearNightOverrides}
                    className="btn-ghost h-7 text-[11px] px-2 inline-flex items-center gap-1.5 text-muted-fg"
                  >
                    <Trash2 className="size-3" />
                    Clear all night overrides
                  </button>
                )}
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
              <Section icon={Type} title={`Typography (${bgMode})`}>
                <Row label="Font face">
                  <select
                    value={eff.fontFamily ?? ""}
                    onChange={(e) =>
                      setStyle({ fontFamily: e.target.value || undefined })
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
                    value={eff.fontSize ?? ""}
                    onChange={(e) =>
                      setStyle({ fontSize: e.target.value || undefined })
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
                          setStyle({
                            fontWeight: eff.fontWeight === w ? undefined : w,
                          })
                        }
                        className={cn(
                          "h-7 px-2 text-[11px] rounded border border-border",
                          eff.fontWeight === w
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
                          setStyle({
                            fontStyle: eff.fontStyle === s ? undefined : s,
                          })
                        }
                        className={cn(
                          "h-7 px-3 text-[11px] rounded border border-border",
                          eff.fontStyle === s
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
                      value={eff.color ?? "#000000"}
                      onChange={(e) => setStyle({ color: e.target.value })}
                      className="size-8 rounded border border-border bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="any CSS color"
                      value={eff.color ?? ""}
                      onChange={(e) =>
                        setStyle({ color: e.target.value || undefined })
                      }
                      className="input h-8 text-xs flex-1"
                    />
                  </div>
                </Row>
                <Row label="Line height">
                  <input
                    type="text"
                    placeholder="1.05"
                    value={eff.lineHeight ?? ""}
                    onChange={(e) =>
                      setStyle({ lineHeight: e.target.value || undefined })
                    }
                    className="input h-8 text-xs w-full"
                  />
                </Row>
                <Row label="Letter spacing">
                  <input
                    type="text"
                    placeholder="-0.02em"
                    value={eff.letterSpacing ?? ""}
                    onChange={(e) =>
                      setStyle({ letterSpacing: e.target.value || undefined })
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
                          setStyle({
                            textAlign: eff.textAlign === a ? undefined : a,
                          })
                        }
                        className={cn(
                          "h-7 px-3 text-[11px] rounded border border-border",
                          eff.textAlign === a
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
              <Section icon={Move} title={`Transform (${bgMode})`}>
                <Row label="Translate X">
                  <NumberSlider
                    value={eff.translateX ?? 0}
                    min={-500} max={500} step={1}
                    onChange={(v) =>
                      setStyle({ translateX: v === 0 ? undefined : v })
                    }
                    suffix="px"
                  />
                </Row>
                <Row label="Translate Y">
                  <NumberSlider
                    value={eff.translateY ?? 0}
                    min={-500} max={500} step={1}
                    onChange={(v) =>
                      setStyle({ translateY: v === 0 ? undefined : v })
                    }
                    suffix="px"
                  />
                </Row>
                <Row label="Scale">
                  <NumberSlider
                    value={eff.scale ?? 1}
                    min={0.2} max={3} step={0.05}
                    onChange={(v) =>
                      setStyle({ scale: v === 1 ? undefined : v })
                    }
                  />
                </Row>
                <Row label="Rotate">
                  <NumberSlider
                    value={eff.rotate ?? 0}
                    min={-180} max={180} step={1}
                    onChange={(v) =>
                      setStyle({ rotate: v === 0 ? undefined : v })
                    }
                    suffix="°"
                  />
                </Row>
                <Row label="Opacity">
                  <NumberSlider
                    value={eff.opacity ?? 1}
                    min={0} max={1} step={0.05}
                    onChange={(v) =>
                      setStyle({ opacity: v === 1 ? undefined : v })
                    }
                  />
                </Row>
              </Section>

              {/* Background image */}
              <Section icon={ImageIcon} title={`Background image (${bgMode})`}>
                <div className="space-y-2">
                  {eff.bgImageUrl ? (
                    <div className="relative">
                      <img
                        src={eff.bgImageUrl}
                        alt=""
                        className="w-full rounded border border-border"
                      />
                      <button
                        onClick={() => setStyle({ bgImageUrl: null })}
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
                  <p className="text-[10px] text-muted-fg italic font-display">
                    Tip: in the preview you can click the photo backdrop, then drag with the cursor to reposition it.
                  </p>
                </div>
                <Row label="Position">
                  <input
                    type="text"
                    placeholder="center / 50% 30%"
                    value={eff.bgPosition ?? ""}
                    onChange={(e) =>
                      setStyle({ bgPosition: e.target.value || undefined })
                    }
                    className="input h-8 text-xs w-full"
                  />
                </Row>
                <Row label="Size">
                  <input
                    type="text"
                    placeholder="cover / contain / 120%"
                    value={eff.bgSize ?? ""}
                    onChange={(e) =>
                      setStyle({ bgSize: e.target.value || undefined })
                    }
                    className="input h-8 text-xs w-full"
                  />
                </Row>
                <Row label="Zoom">
                  <NumberSlider
                    value={parseBgZoomPct(eff.bgSize)}
                    min={50}
                    max={300}
                    step={5}
                    onChange={(v) =>
                      setStyle({
                        bgSize: v === 100 ? undefined : `${v}%`,
                      })
                    }
                    suffix="%"
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
  const current =
    tab === "en"
      ? overrides._text ?? ""
      : overrides._texts?.[tab] ?? "";
  const [draft, setDraft] = useState(current);
  // Re-sync when tab changes or selection changes
  useEffect(() => {
    setDraft(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, overrides._text, overrides._texts]);
  const dirty = draft !== current;
  return (
    <section className="space-y-2.5 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <Type className="size-3.5 text-accent" />
        <p className="editorial-number text-[10px]">Text content</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {LANGUAGES.map((l) => {
          const has =
            l.code === "en"
              ? Boolean(overrides._text)
              : Boolean(overrides._texts?.[l.code]);
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
              {has && (
                <span
                  className="size-1.5 rounded-full bg-accent inline-block"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder={
          tab === "en"
            ? "Baseline text (English)"
            : `${tab} override (falls back to English when empty)`
        }
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
