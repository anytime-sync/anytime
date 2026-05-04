"use client";
// per-language flattened list view + class targets
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
 * /admin/design â visual editor.
 *
 * Layout: page-picker top bar + iframe preview on the left + side
 * panel on the right. The iframe loads each editable page with
 * `?design=edit` query, which makes the runtime listen for parent
 * postMessages (selection, override updates) and shoots back the
 * element_id of any clicked DesignSlot.
 *
 * Style overrides are SHARED across all locales â text per-locale
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
  // i18n key of the selected slot (if any). Set by the iframe whenever a
  // slot with `data-design-text-key` is selected â drives the SlotTextEditor
  // in the side panel.
  const [selectedTextKey, setSelectedTextKey] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  // Day vs Night editing â drives BOTH the iframe preview palette AND
  // where each style edit gets persisted (top-level vs `night` sub).
  const [bgMode, setBgMode] = useState<"day" | "night">("day");
  // Per-language editing scope. "en" is the baseline (writes go to the
  // top-level / `night` buckets, unchanged behaviour). Any other code
  // routes writes into `langs[code]` / `langs[code].night` so the same
  // element can have different fontSize/color/etc. per locale.
  const [langMode, setLangMode] = useState<LanguageCode>("en");
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

  /**
   * Cancel the autosave debounce and flush every dirty element NOW.
   * Wired to the explicit "Save" button in the side panel â useful
   * before navigating away or to force a confirmation toast even when
   * autosave hasn't fired yet.
   */
  async function flushSaveNow() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const ids = Array.from(dirtyIdsRef.current);
    dirtyIdsRef.current.clear();
    if (ids.length === 0) {
      toast.success("Nothing to save");
      return;
    }
    setAutoSaveStatus("saving");
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
    if (anyError) toast.error("Some saves failed");
    else toast.success(`Saved ${ids.length} change${ids.length === 1 ? "" : "s"}`);
    if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current);
    savedToastTimerRef.current = setTimeout(
      () => setAutoSaveStatus("idle"),
      1500
    );
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

  // Sync the sidebar's langMode tab â iframe's stored language. Without
  // this, picking zh-TW in the sidebar wouldn't actually flip the iframe
  // to zh-TW, so class-targeted CSS (`html[lang="zh-TW"] .editorial-number`)
  // would never match in the preview and edits silently looked broken.
  useEffect(() => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage({ type: "fl.design.set-lang", lang: langMode }, "*");
  }, [langMode, iframeKey]);

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

  // Save a per-locale text override for a slot's i18n key. Routes
  // through the admin API (same as inline editing) so RLS is bypassed
  // by the service-role client. Returns true on success.
  async function saveSlotText(
    textKey: string,
    value: string,
    locale: string
  ): Promise<boolean> {
    const trimmed = value.trim();
    const r = await fetch("/api/design/content", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale, key: textKey, value: trimmed }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      toast.error("Save failed: " + (j.error ?? r.statusText));
      return false;
    }
    if (!trimmed) toast.success(`Reverted to default (${locale})`);
    else toast.success(`Saved (${locale})`);
    // Reload iframe so the saved text shows up in the preview without
    // a manual refresh. Cheap because the iframe is just a Next.js
    // page render.
    setIframeKey((k) => k + 1);
    return true;
  }

  // ---------- listen to selection / inline-text messages from iframe ----------
  useEffect(() => {
    async function saveText(textKey: string, value: string, locale: string) {
      // Route through the admin API instead of writing site_content
      // directly from the browser. RLS on that table references
      // auth.users, and the anon role doesn't have SELECT on `users` â
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
      // Reload the iframe so the saved text is reflected in the preview.
      // Without this the DB has the new value but the iframe still shows
      // whatever was rendered on the last load — so edits look "lost".
      setIframeKey((k) => k + 1);
    }

    function onMsg(ev: MessageEvent) {
      const data = ev.data as
        | { type: "fl.design.select"; elementId: string; textKey?: string }
        | { type: "fl.design.ready" }
        | { type: "fl.design.text"; textKey: string; value: string; locale: string }
        | { type: "fl.design.move"; elementId: string; x: number; y: number }
        | { type: "fl.design.translate"; elementId: string; x: number; y: number }
        | { type: "fl.design.floating-text"; elementId: string; value: string; locale: string }
        | { type: "fl.design.bg-pan"; elementId: string; bgPosition: string }
        | { type: "fl.design.bg-pan-exited" }
        | { type: "fl.design.lang-changed"; lang: LanguageCode }
        | undefined;
      if (!data || typeof data !== "object" || !("type" in data)) return;
      if (data.type === "fl.design.select") {
        setSelected(data.elementId);
        setSelectedTextKey(data.textKey ?? null);
      }
      if (data.type === "fl.design.ready") {
        // After iframe boots, push the full map so its DesignProvider
        // mirrors our local edits, then re-apply the active mode + lang
        // so night-preview / html[lang] state survives the reload and
        // matches the sidebar tabs.
        const w = iframeRef.current?.contentWindow;
        if (w) {
          w.postMessage({ type: "fl.design.bulk", map }, "*");
          w.postMessage({ type: "fl.design.set-mode", mode: bgMode }, "*");
          w.postMessage({ type: "fl.design.set-lang", lang: langMode }, "*");
        }
      }
      if (data.type === "fl.design.lang-changed") {
        // The user picked a language inside the iframe (LanguagePicker).
        // Mirror that into the sidebar's langMode so subsequent edits
        // route to the right (langs[xx]) bucket.
        setLangMode(data.lang);
      }
      if (data.type === "fl.design.translate") {
        // Drag-translated a selected slot inside the iframe â persist
        // translateX / translateY through setStyle so the value lands
        // in the active (langMode, bgMode) bucket and autosaves.
        void persistTranslate(data.elementId, data.x, data.y);
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
      // Route to the active mode: day â top-level bgPosition, night â night.bgPosition
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
    async function persistTranslate(elementId: string, x: number, y: number) {
      // Route translateX/Y into the right bucket via applyStylePatch
      // so dragging respects the active (langMode, bgMode) tabs.
      const current = map[elementId] ?? {};
      const merged = applyStylePatch(current, {
        translateX: x === 0 ? undefined : x,
        translateY: y === 0 ? undefined : y,
      });
      setMap((prev) => ({ ...prev, [elementId]: merged }));
      // Echo into iframe for immediate sync.
      const w = iframeRef.current?.contentWindow;
      if (w) {
        w.postMessage(
          { type: "fl.design.update", elementId, overrides: merged },
          "*"
        );
      }
      const r = await fetch(`/api/design/${encodeURIComponent(elementId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ overrides: merged }),
      });
      if (!r.ok) toast.error("Move failed");
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
    // langMode is read by applyStylePatch (called from persistTranslate)
    // and by the ready/select branches that set lang on the iframe â so
    // a fresh closure is required when it changes.
  }, [map, bgMode, langMode]);

  const overrides = selected ? map[selected] ?? {} : {};

  // Effective override for READING input values. We layer in the same
  // precedence the renderer uses (overridesToStyle) so the inputs show
  // exactly what the user will see on the live page in that lang+mode:
  //   1. baseline (top-level)
  //   2. baseline.night          (when bgMode === 'night')
  //   3. langs[lang]              (when langMode !== 'en')
  //   4. langs[lang].night        (when both)
  const eff: DesignOverrides & Partial<StyleFields> = (() => {
    let merged: DesignOverrides & Partial<StyleFields> = { ...overrides };
    if (bgMode === "night" && overrides.night) {
      merged = { ...merged, ...overrides.night };
    }
    if (langMode !== "en" && overrides.langs) {
      const langOv = overrides.langs[langMode];
      if (langOv) {
        merged = { ...merged, ...(langOv as StyleFields) };
        if (bgMode === "night" && langOv.night) {
          merged = { ...merged, ...(langOv.night as StyleFields) };
        }
      }
    }
    return merged;
  })();

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
   * Build the next overrides blob for `selected` after applying a
   * style patch routed by (langMode, bgMode):
   *   - lang=en, mode=day   â top-level fields
   *   - lang=en, mode=night â `night` sub
   *   - langâ en, mode=day   â `langs[lang]` sub
   *   - langâ en, mode=night â `langs[lang].night` sub
   * Empty sub-objects are stripped so the JSON stays clean.
   */
  function applyStylePatch(
    current: DesignOverrides,
    patch: Partial<StyleFields>
  ): DesignOverrides {
    const stripUndef = <T extends Record<string, unknown>>(obj: T): T => {
      const out = { ...obj } as T;
      for (const k of Object.keys(out)) {
        if (out[k] === undefined) delete out[k];
      }
      return out;
    };
    // ---- baseline (English) ----
    if (langMode === "en") {
      if (bgMode === "day") {
        // Merge into top-level StyleFields.
        const merged: DesignOverrides = stripUndef({ ...current, ...patch });
        return merged;
      }
      // night
      const nextNight = stripUndef({ ...(current.night ?? {}), ...patch });
      const merged: DesignOverrides = { ...current };
      if (Object.keys(nextNight).length > 0) merged.night = nextNight;
      else delete merged.night;
      return merged;
    }
    // ---- non-English language override ----
    const langs = { ...(current.langs ?? {}) };
    const cur = langs[langMode] ?? {};
    let nextLang: StyleFields & { night?: StyleFields };
    if (bgMode === "day") {
      nextLang = stripUndef({ ...cur, ...patch }) as StyleFields & {
        night?: StyleFields;
      };
    } else {
      const nextNight = stripUndef({ ...(cur.night ?? {}), ...patch });
      nextLang = { ...cur };
      if (Object.keys(nextNight).length > 0) nextLang.night = nextNight;
      else delete nextLang.night;
    }
    if (
      Object.keys(nextLang).filter((k) => k !== "night").length === 0 &&
      !nextLang.night
    ) {
      // Bucket emptied â drop it entirely.
      delete langs[langMode];
    } else {
      langs[langMode] = nextLang;
    }
    const merged: DesignOverrides = { ...current };
    if (Object.keys(langs).length > 0) merged.langs = langs;
    else delete merged.langs;
    return merged;
  }

  /**
   * Style-field setter â routes the patch into the right bucket based
   * on (langMode, bgMode). Behaviour is unchanged when langMode === 'en'.
   */
  function setStyle(patch: Partial<StyleFields>) {
    if (!selected) return;
    setMap((prev) => {
      const next = { ...prev };
      const cur = next[selected] ?? {};
      next[selected] = applyStylePatch(cur, patch);
      return next;
    });
    // Echo into iframe.
    const w = iframeRef.current?.contentWindow;
    if (w && selected) {
      const merged = applyStylePatch(map[selected] ?? {}, patch);
      w.postMessage(
        { type: "fl.design.update", elementId: selected, overrides: merged },
        "*"
      );
    }
    autoSave(selected);
  }

  function clearLangOverrides() {
    if (!selected || langMode === "en") return;
    setMap((prev) => {
      const next = { ...prev };
      const current = next[selected] ?? {};
      if (!current.langs?.[langMode]) return prev;
      const langs = { ...current.langs };
      delete langs[langMode];
      const merged: DesignOverrides = { ...current };
      if (Object.keys(langs).length > 0) merged.langs = langs;
      else delete merged.langs;
      next[selected] = merged;
      return next;
    });
    const w = iframeRef.current?.contentWindow;
    if (w && selected) {
      const current = map[selected] ?? {};
      const langs = { ...(current.langs ?? {}) };
      delete langs[langMode];
      const merged: DesignOverrides = { ...current };
      if (Object.keys(langs).length > 0) merged.langs = langs;
      else delete merged.langs;
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
    toast.success("Text added â drag to position");
  }

  /**
   * Create or open a class-targeted override entry. Class entries
   * live in the same site_design table under id `class:CLASSNAME` and
   * are resolved at render time by class-css.ts. The same per-language
   * + day/night controls in the side panel below all work because
   * they operate on `map[selected]` regardless of whether `selected`
   * is a per-element id or a `class:...` id.
   */
  async function addOrEditClass() {
    const raw = window.prompt(
      "CSS class name to target (e.g. editorial-number, font-display, wordmark)"
    );
    const cls = (raw ?? "").trim().replace(/^\./, "");
    if (!cls) return;
    if (!/^[\w-]+$/.test(cls)) {
      toast.error("Class names can only contain letters, digits, _ and -");
      return;
    }
    const elementId = `class:${cls}`;
    const existing = map[elementId];
    if (existing) {
      // Already have overrides for this class â just select it for editing.
      setSelected(elementId);
      toast.success(`Editing class .${cls}`);
      return;
    }
    const overrides: DesignOverrides = { _kind: "class", _class: cls };
    const r = await fetch(`/api/design/${encodeURIComponent(elementId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ overrides }),
    });
    if (!r.ok) {
      toast.error("Could not create class override");
      return;
    }
    setMap((prev) => ({ ...prev, [elementId]: overrides }));
    setSelected(elementId);
    // Echo into iframe so its DesignProvider re-generates the
    // <style id="fl-class-overrides"> tag for live preview.
    const w = iframeRef.current?.contentWindow;
    if (w) {
      w.postMessage(
        { type: "fl.design.update", elementId, overrides },
        "*"
      );
    }
    toast.success(`Class .${cls} ready â tweak below`);
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
    toast.success(`Image set (${langMode}, ${bgMode})`);
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
            onClick={addOrEditClass}
            className="btn-ghost h-9 text-xs inline-flex items-center gap-1.5"
            title="Target a CSS class (e.g. editorial-number) â set per-language fontSize, color, weight, etc. once and it applies to every instance everywhere"
          >
            <Plus className="size-3" />
            Class
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
            {bgPanMode ? "Panningâ¦ Esc to exit" : "Pan backdrop"}
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
            <EmptyHint
              map={map}
              onPickClass={(id) => setSelected(id)}
              onPickEntry={(id, lang, mode) => {
                setSelected(id);
                setLangMode(lang);
                setBgMode(mode);
              }}
            />
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
                    {autoSaveStatus === "saving" && "Savingâ¦"}
                    {autoSaveStatus === "saved" && "Saved"}
                    {autoSaveStatus === "error" && "Save failed"}
                    {autoSaveStatus === "idle" && "Auto-save on"}
                  </span>
                  <button
                    onClick={flushSaveNow}
                    disabled={autoSaveStatus === "saving"}
                    className="btn-ghost h-8 text-xs px-3 inline-flex items-center gap-1.5"
                    title="Flush any pending edits to the server immediately"
                  >
                    <Save className="size-3" />
                    Save
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

              {/* Day / Night + Language editing scope â drives BOTH the
                  iframe preview palette AND which bucket every style
                  edit below gets saved into:
                    en + day   â top-level
                    en + night â `night`
                    xx + day   â `langs[xx]`
                    xx + night â `langs[xx].night` */}
              <div className="rounded-md border border-border bg-bg/40 p-2.5 space-y-2">
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
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="editorial-number text-[10px]">Language</p>
                  <div className="ml-auto inline-flex rounded-md border border-border overflow-hidden flex-wrap">
                    {LANGUAGES.map((l) => {
                      const has =
                        l.code === "en"
                          ? false
                          : Boolean(overrides.langs?.[l.code]);
                      return (
                        <button
                          key={l.code}
                          onClick={() => setLangMode(l.code)}
                          className={cn(
                            "h-7 px-2 text-[11px] inline-flex items-center gap-1",
                            langMode === l.code
                              ? "bg-fg text-bg"
                              : "btn-ghost"
                          )}
                          title={
                            l.code === "en"
                              ? "Baseline (English) â applies to every locale until overridden"
                              : `Tweak ${l.displayName} only`
                          }
                        >
                          {l.code === "en" ? "en (base)" : l.code}
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
                </div>
                <p className="text-[10px] text-muted-fg leading-snug">
                  {langMode === "en"
                    ? bgMode === "day"
                      ? "Baseline edits â affect every language unless that language has its own override below."
                      : "Baseline night edits â every language inherits these in dark mode unless overridden."
                    : bgMode === "day"
                    ? `Edits apply only to ${langMode}. Empty fields fall back to the baseline.`
                    : `Edits apply only to ${langMode} in dark mode. Empty fields fall back to ${langMode}'s day value, then the baseline.`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {bgMode === "night" && overrides.night && (
                    <button
                      onClick={clearNightOverrides}
                      className="btn-ghost h-7 text-[11px] px-2 inline-flex items-center gap-1.5 text-muted-fg"
                    >
                      <Trash2 className="size-3" />
                      Clear baseline night
                    </button>
                  )}
                  {langMode !== "en" && overrides.langs?.[langMode] && (
                    <button
                      onClick={clearLangOverrides}
                      className="btn-ghost h-7 text-[11px] px-2 inline-flex items-center gap-1.5 text-muted-fg"
                    >
                      <Trash2 className="size-3" />
                      Clear all {langMode} overrides
                    </button>
                  )}
                </div>
              </div>

              {/* Per-locale text edit for regular slots with an i18n key.
                  Lets the operator edit text from the sidebar instead of
                  having to double-click into the iframe. */}
              {selectedTextKey && !selected.startsWith("floating.") && (
                <SlotTextEditor
                  elementId={selected}
                  textKey={selectedTextKey}
                  langMode={langMode}
                  setLangMode={setLangMode}
                  iframeRef={iframeRef}
                  onSave={saveSlotText}
                />
              )}

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
              <Section icon={Type} title={`Typography (${langMode}, ${bgMode})`}>
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
              <Section icon={Move} title={`Transform (${langMode}, ${bgMode})`}>
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
                    suffix="Â°"
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
              <Section icon={ImageIcon} title={`Background image (${langMode}, ${bgMode})`}>
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

function EmptyHint({
  map,
  onPickClass,
  onPickEntry,
}: {
  map: DesignMap;
  onPickClass: (elementId: string) => void;
  /**
   * Click a flattened per-language row â jump straight into that
   * (entry, language, mode) bucket: selects the entry AND sets
   * langMode + bgMode in the parent so the side panel renders the
   * right tabs and the inputs read the right values.
   */
  onPickEntry: (
    elementId: string,
    lang: LanguageCode,
    mode: "day" | "night"
  ) => void;
}) {
  // List existing class-targeted overrides so the operator can re-open
  // any of them for editing without re-typing the class name.
  const classEntries = Object.entries(map).filter(
    ([id, ov]) => id.startsWith("class:") && ov._kind === "class"
  );

  // Flatten every (entry, lang, mode) bucket into a single list so the
  // operator can see â and click into â each language variant of every
  // element/class at a glance. We don't surface a row when a bucket is
  // empty, so the list stays focused on what's actually been customized.
  type FlatRow = {
    elementId: string;
    cls?: string;
    lang: LanguageCode;
    mode: "day" | "night";
    fieldCount: number;
  };
  const flatRows: FlatRow[] = [];
  for (const [elementId, ov] of Object.entries(map)) {
    const cls = ov._kind === "class" ? ov._class : undefined;
    // Top-level (en, day) â count any non-meta key
    const topFields = Object.keys(ov).filter(
      (k) =>
        k !== "night" &&
        k !== "langs" &&
        k !== "hidden" &&
        !k.startsWith("_")
    );
    if (topFields.length > 0) {
      flatRows.push({
        elementId,
        cls,
        lang: "en" as LanguageCode,
        mode: "day",
        fieldCount: topFields.length,
      });
    }
    // Top-level night
    if (ov.night && Object.keys(ov.night).length > 0) {
      flatRows.push({
        elementId,
        cls,
        lang: "en" as LanguageCode,
        mode: "night",
        fieldCount: Object.keys(ov.night).length,
      });
    }
    // Per-language buckets
    if (ov.langs) {
      for (const [lang, langOv] of Object.entries(ov.langs)) {
        const langDayFields = Object.keys(langOv).filter(
          (k) => k !== "night"
        );
        if (langDayFields.length > 0) {
          flatRows.push({
            elementId,
            cls,
            lang: lang as LanguageCode,
            mode: "day",
            fieldCount: langDayFields.length,
          });
        }
        if (langOv.night && Object.keys(langOv.night).length > 0) {
          flatRows.push({
            elementId,
            cls,
            lang: lang as LanguageCode,
            mode: "night",
            fieldCount: Object.keys(langOv.night).length,
          });
        }
      }
    }
  }
  // Sort: per-element first (by id), then per-language alphabetical,
  // English before other languages, day before night.
  flatRows.sort((a, b) => {
    if (a.elementId !== b.elementId) return a.elementId.localeCompare(b.elementId);
    if (a.lang !== b.lang) {
      if (a.lang === "en") return -1;
      if (b.lang === "en") return 1;
      return a.lang.localeCompare(b.lang);
    }
    return a.mode === "day" ? -1 : 1;
  });
  return (
    <div className="p-8 space-y-3">
      <p className="editorial-number text-[10px]">Click any element</p>
      <h2 className="font-display text-xl"><em>Pick something</em></h2>
      <p className="text-xs text-muted-fg leading-relaxed">
        Hover over the preview â every editable element will outline. Click
        to select. Then tune typography, transform, or upload a background
        image. Style overrides apply across all languages; per-locale text
        still lives in <code>/admin/content</code>.
      </p>
      <p className="text-[10px] text-muted-fg italic font-display pt-3">
        New element ids inherit the page&rsquo;s defaults until you save an override.
      </p>

      {/* Saved overrides â flattened by (entry, language, mode) so the
          operator can see and click each language variant separately.
          Backed by the same nested storage; clicking jumps the side
          panel straight to that lang+mode bucket. */}
      <div className="pt-5 border-t border-border space-y-2">
        <p className="editorial-number text-[10px]">
          Saved overrides{" "}
          <span className="text-muted-fg">· by language</span>
        </p>
        {flatRows.length === 0 ? (
          <p className="text-[11px] text-muted-fg leading-relaxed">
            None yet. Click any element in the preview to start, or use{" "}
            <em>+ Class</em> in the header to target a CSS class.
          </p>
        ) : (
          <ul className="space-y-1 max-h-[40vh] overflow-y-auto">
            {flatRows.map((r, i) => {
              const label = r.cls ? `.${r.cls}` : r.elementId;
              const langBadge =
                r.lang === "en" ? "en (base)" : r.lang;
              return (
                <li key={`${r.elementId}|${r.lang}|${r.mode}|${i}`}>
                  <button
                    onClick={() =>
                      onPickEntry(r.elementId, r.lang, r.mode)
                    }
                    className="btn-ghost w-full text-left px-2 py-1.5 text-xs flex items-center gap-2"
                    title={`${label} · ${r.lang} · ${r.mode} (${r.fieldCount} field${r.fieldCount === 1 ? "" : "s"} set)`}
                  >
                    <code className="font-mono text-[11px] truncate max-w-[140px]">
                      {label}
                    </code>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 h-5 rounded inline-flex items-center",
                        r.lang === "en"
                          ? "bg-bg/40 text-muted-fg"
                          : "bg-accent/15 text-accent"
                      )}
                    >
                      {langBadge}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 h-5 rounded inline-flex items-center",
                        r.mode === "day"
                          ? "bg-bg/40 text-muted-fg"
                          : "bg-fg text-bg"
                      )}
                    >
                      {r.mode}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-fg tabular-nums">
                      {r.fieldCount} field{r.fieldCount === 1 ? "" : "s"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Class-targeted overrides â set once per class per language,
          applies to every instance anywhere. Use the "+ Class" button
          in the header to add a new one. */}
      <div className="pt-5 border-t border-border space-y-2">
        <p className="editorial-number text-[10px]">Class targets</p>
        {classEntries.length === 0 ? (
          <p className="text-[11px] text-muted-fg leading-relaxed">
            None yet. Click <em>+ Class</em> in the header to set
            per-language styles for any CSS class â e.g. tweak{" "}
            <code className="text-[10px]">editorial-number</code>{" "}
            to a different size on zh-TW.
          </p>
        ) : (
          <ul className="space-y-1">
            {classEntries.map(([id, ov]) => {
              const cls = ov._class || id.replace(/^class:/, "");
              const langCount = ov.langs ? Object.keys(ov.langs).length : 0;
              const hasNight = !!ov.night;
              return (
                <li key={id}>
                  <button
                    onClick={() => onPickClass(id)}
                    className="btn-ghost w-full text-left px-2 py-1.5 text-xs flex items-center gap-2"
                  >
                    <code className="font-mono text-[11px]">.{cls}</code>
                    <span className="ml-auto text-[10px] text-muted-fg tabular-nums">
                      {langCount > 0 && `${langCount + 1} langs`}
                      {langCount === 0 && hasNight && "day + night"}
                      {langCount === 0 && !hasNight && "baseline only"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
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

/**
 * Right-sidebar text editor for regular (non-floating) slots that have an
 * i18n key. Lets the operator pick a language tab, see the current text
 * pulled from the iframe, edit it in a textarea, and save back through
 * the admin content API. Saving reloads the iframe so the new value shows
 * up in the preview immediately.
 */
function SlotTextEditor({
  elementId,
  textKey,
  langMode,
  setLangMode,
  iframeRef,
  onSave,
}: {
  elementId: string;
  textKey: string;
  langMode: LanguageCode;
  setLangMode: (l: LanguageCode) => void;
  iframeRef: React.RefObject<HTMLIFrameElement>;
  onSave: (textKey: string, value: string, locale: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const [original, setOriginal] = useState("");
  const [saving, setSaving] = useState(false);

  // Read the slot's currently rendered text out of the iframe whenever
  // the selection or active language changes. Same-origin iframe so
  // contentDocument access just works. We retry briefly because the
  // iframe may not have re-rendered yet after a langMode flip.
  useEffect(() => {
    let cancelled = false;
    function read() {
      if (cancelled) return;
      try {
        const doc = iframeRef.current?.contentDocument;
        if (!doc) return false;
        const sel =
          typeof CSS !== "undefined" && (CSS as { escape?: (s: string) => string }).escape
            ? (CSS as { escape: (s: string) => string }).escape(elementId)
            : elementId.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
        const el = doc.querySelector(`[data-design-id="${sel}"]`);
        if (!el) return false;
        const txt = (el.textContent ?? "").trim();
        setDraft(txt);
        setOriginal(txt);
        return true;
      } catch {
        return false;
      }
    }
    // Try a few times â iframe may still be rendering.
    let attempts = 0;
    const tick = () => {
      if (read()) return;
      attempts += 1;
      if (attempts < 6) setTimeout(tick, 200);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [elementId, langMode, iframeRef]);

  const dirty = draft !== original;

  async function handleSave() {
    setSaving(true);
    const ok = await onSave(textKey, draft, langMode);
    setSaving(false);
    if (ok) setOriginal(draft);
  }

  return (
    <section className="space-y-2.5 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <Type className="size-3.5 text-accent" />
        <p className="editorial-number text-[10px]">Text content</p>
        <code className="ml-auto text-[10px] text-muted-fg font-mono truncate max-w-[160px]" title={textKey}>
          {textKey}
        </code>
      </div>
      <div className="flex flex-wrap gap-1">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            onClick={() => setLangMode(l.code)}
            className={cn(
              "h-7 px-2 text-[11px] rounded border border-border inline-flex items-center gap-1",
              langMode === l.code ? "bg-fg text-bg" : "btn-ghost"
            )}
            title={`Edit ${l.displayName}`}
          >
            {l.code === "en" ? "en (base)" : l.code}
          </button>
        ))}
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        placeholder={
          langMode === "en"
            ? "Baseline text (English)"
            : `${langMode} override (falls back to English when empty)`
        }
        className="input w-full text-sm leading-relaxed resize-y min-h-[60px]"
      />
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={cn(
            "btn-ghost px-3 h-8 inline-flex items-center gap-1.5",
            dirty && !saving && "text-fg hover:bg-accent/10",
            (!dirty || saving) && "opacity-40 cursor-not-allowed"
          )}
        >
          <Save className="size-3" />
          {saving ? "Savingâ¦" : `Save ${langMode}`}
        </button>
        {dirty && !saving && (
          <button
            onClick={() => setDraft(original)}
            className="btn-ghost px-2 h-8 text-muted-fg"
          >
            Discard
          </button>
        )}
        {langMode !== "en" && original && (
          <button
            onClick={() => {
              setDraft("");
              void onSave(textKey, "", langMode).then((ok) => {
                if (ok) setOriginal("");
              });
            }}
            className="btn-ghost px-2 h-8 text-muted-fg ml-auto"
            title={`Clear ${langMode} override (falls back to English)`}
          >
            <Trash2 className="size-3" />
            Clear
          </button>
        )}
      </div>
      <p className="text-[10px] text-muted-fg leading-snug italic">
        Tip: you can also double-click any text in the preview to edit it inline.
      </p>
    </section>
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
