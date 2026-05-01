"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  readStoredLanguage,
  writeStoredLanguage,
  type LanguageCode,
} from "@/lib/i18n";

/**
 * Mounted at the root layout. When the page is loaded inside the
 * /admin/design editor's iframe (signalled by `?design=edit`), this
 * component:
 *
 *   1. Injects a small CSS that outlines every [data-design-id] on
 *      hover and the currently-selected one with a gold ring.
 *   2. Captures clicks anywhere on the page. If the click lands on a
 *      DesignSlot (via its data-design-id ancestor), select it and
 *      postMessage up. If the click lands on a non-slot interactive
 *      element (language picker button, anchor, etc.), let it through
 *      so the user can still navigate / change locale inside the
 *      preview.
 *   3. On double-click of a slot with `data-design-text-key`, makes
 *      the element contentEditable. On blur, posts the new text +
 *      i18n key + current locale to the parent for persistence.
 */
export function DesignEditMode() {
  const sp = useSearchParams();
  const mode = sp?.get("design");

  useEffect(() => {
    if (mode !== "edit") return;
    if (typeof window === "undefined") return;

    try {
      window.parent?.postMessage({ type: "fl.design.ready" }, "*");
    } catch {}

    // Listen for the parent admin page flipping which mode (day/night)
    // it's editing. We mirror that as an `.fl-night-preview` class on
    // <html> so `useIsDark()` resolves to the right value and every
    // DesignSlot re-styles instantly.
    function onModeMsg(ev: MessageEvent) {
      const data = ev.data as
        | { type: "fl.design.set-mode"; mode: "day" | "night" }
        | { type: "fl.design.set-bg-pan"; on: boolean }
        | { type: "fl.design.set-lang"; lang: LanguageCode }
        | undefined;
      if (!data || typeof data !== "object" || !("type" in data)) return;
      if (data.type === "fl.design.set-mode") {
        const cl = document.documentElement.classList;
        if (data.mode === "night") cl.add("fl-night-preview");
        else cl.remove("fl-night-preview");
        return;
      }
      if (data.type === "fl.design.set-bg-pan") {
        const cl = document.documentElement.classList;
        if (data.on) cl.add("fl-bg-pan");
        else cl.remove("fl-bg-pan");
        return;
      }
      if (data.type === "fl.design.set-lang") {
        // Parent's lang tab changed → flip the iframe's stored language so
        // (1) html[lang="xx"] selectors in <style id="fl-class-overrides">
        // start matching, (2) every DesignSlot's useLanguage() resolves to
        // the new value and re-renders with the right per-locale text +
        // per-language style overrides. LanguageBootstrap inside the
        // iframe listens for fl.language.change and patches html.lang,
        // meta description, etc. — same path the in-iframe language
        // picker uses.
        try {
          if (readStoredLanguage() !== data.lang) {
            writeStoredLanguage(data.lang);
          }
        } catch {}
        return;
      }
    }
    window.addEventListener("message", onModeMsg);

    // Bubble iframe-side language changes back up to the parent so the
    // right sidebar's langMode tab reflects whatever language the user
    // picked using the in-iframe LanguagePicker. Without this, the two
    // controls drift and edits write to the wrong bucket.
    function onIframeLangChange() {
      try {
        window.parent?.postMessage(
          { type: "fl.design.lang-changed", lang: readStoredLanguage() },
          "*"
        );
      } catch {}
    }
    window.addEventListener(
      "fl.language.change",
      onIframeLangChange as EventListener
    );

    let selectedId: string | null = null;
    let editingEl: HTMLElement | null = null;
    let dragState: {
      id: string;
      el: HTMLElement;
      startMx: number;
      startMy: number;
      origX: number;
      origY: number;
    } | null = null;
    let bgPanState: {
      id: string;
      el: HTMLElement;
      startMx: number;
      startMy: number;
      origPx: number;
      origPy: number;
      w: number;
      h: number;
    } | null = null;
    // Drag-to-translate state for any selected non-floating, non-bg-image
    // slot. Reads / writes the inline transform translate so the operator
    // can nudge editorial-number, kickers, headlines, etc. into place
    // without leaving the iframe. On mouseup we post-message the final
    // (x, y) up so the parent persists translateX / translateY into the
    // active (langMode, bgMode) bucket.
    let translateState: {
      id: string;
      el: HTMLElement;
      startMx: number;
      startMy: number;
      origTx: number;
      origTy: number;
    } | null = null;

    const style = document.createElement("style");
    style.dataset.flDesignEdit = "1";
    style.textContent = `
      [data-design-id] {
        outline: 1px dashed transparent;
        outline-offset: 2px;
        transition: outline-color 120ms ease;
      }
      [data-design-id]:hover {
        outline-color: rgba(202, 162, 80, 0.55);
      }
      [data-design-id][data-fl-selected="1"] {
        outline: 2px solid rgba(202, 162, 80, 0.95) !important;
        outline-offset: 3px;
      }
      [data-design-id][data-design-text-key]:hover {
        cursor: text;
      }
      [data-design-id][data-fl-editing="1"] {
        outline: 2px solid rgba(202, 162, 80, 0.95) !important;
        background: rgba(202, 162, 80, 0.08);
        cursor: text;
      }
      /* Pan-backdrop mode — lifts the photo layer above all content
         and dims everything else, so the user can click-and-drag the
         photo from anywhere on screen. The outer fixed wrapper is
         what holds the z-index, so we target it. */
      .fl-bg-pan [data-fl-photo-wrapper="1"] {
        z-index: 99998 !important;
      }
      .fl-bg-pan [data-design-id="page.background.photo"] {
        cursor: grab;
      }
      .fl-bg-pan [data-design-id="page.background.photo"]:active {
        cursor: grabbing;
      }
      .fl-bg-pan body::after {
        content: "Drag the photo to pan · Esc to exit";
        position: fixed;
        top: 12px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 99999;
        background: rgba(20, 18, 14, 0.78);
        color: rgba(255, 246, 220, 0.92);
        font: 500 11px/1.4 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: 0.04em;
        padding: 6px 12px;
        border-radius: 999px;
        backdrop-filter: blur(6px);
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);

    function pickAction(
      target: EventTarget | null
    ): { type: "select"; slot: HTMLElement } | { type: "passthrough" } | null {
      let el = target as HTMLElement | null;
      while (el && el !== document.body) {
        if (el.dataset && el.dataset.designId) {
          return { type: "select", slot: el };
        }
        const tag = el.tagName;
        if (
          tag === "BUTTON" ||
          tag === "A" ||
          tag === "INPUT" ||
          tag === "SELECT" ||
          tag === "TEXTAREA" ||
          el.getAttribute("role") === "button"
        ) {
          return { type: "passthrough" };
        }
        el = el.parentElement;
      }
      // Fell through to body without finding a slot or interactive
      // element. Fall back to the photo backdrop so clicking on
      // "empty" page space selects + drags the photo. The backdrop
      // sits at z-index -10 and would otherwise be unreachable, since
      // body always wins hit testing over a negative-z-index layer.
      const photo = document.querySelector(
        '[data-design-id="page.background.photo"]'
      ) as HTMLElement | null;
      if (photo) return { type: "select", slot: photo };
      return null;
    }

    function clearSelected() {
      if (!selectedId) return;
      document
        .querySelectorAll(`[data-design-id="${cssEscape(selectedId)}"]`)
        .forEach((n) =>
          (n as HTMLElement).removeAttribute("data-fl-selected")
        );
      selectedId = null;
    }

    function commitEditing() {
      if (!editingEl) return;
      const el = editingEl;
      const id = el.dataset.designId ?? "";
      const isFloating = id.startsWith("floating.");
      const textKey = el.dataset.designTextKey;
      const original = el.dataset.flOriginalText ?? "";
      const newText = (el.textContent || "").trim();
      el.removeAttribute("contenteditable");
      el.removeAttribute("data-fl-editing");
      delete el.dataset.flOriginalText;
      editingEl = null;
      if (!textKey && !isFloating) return;
      if (newText === original.trim()) return;
      const locale = readStoredLanguage();
      try {
        if (isFloating) {
          window.parent?.postMessage(
            {
              type: "fl.design.floating-text",
              elementId: id,
              value: newText,
              locale,
            },
            "*"
          );
        } else if (textKey) {
          window.parent?.postMessage(
            { type: "fl.design.text", textKey, value: newText, locale },
            "*"
          );
        }
      } catch {}
    }

    function onClick(ev: MouseEvent) {
      if (editingEl && !editingEl.contains(ev.target as Node)) {
        commitEditing();
      }
      const action = pickAction(ev.target);
      if (!action) return;
      if (action.type === "passthrough") return;
      ev.preventDefault();
      ev.stopPropagation();
      clearSelected();
      selectedId = action.slot.dataset.designId!;
      action.slot.setAttribute("data-fl-selected", "1");
      try {
        window.parent?.postMessage(
          {
            type: "fl.design.select",
            elementId: selectedId,
            textKey: action.slot.dataset.designTextKey,
          },
          "*"
        );
      } catch {}
    }

    function onDblClick(ev: MouseEvent) {
      const action = pickAction(ev.target);
      if (!action || action.type !== "select") return;
      const slot = action.slot;
      const id = slot.dataset.designId ?? "";
      const isFloating = id.startsWith("floating.");
      const textKey = slot.dataset.designTextKey;
      // Floating elements are always text-editable; structured slots
      // need an explicit textKey.
      if (!textKey && !isFloating) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (slot === editingEl) return;
      if (editingEl) commitEditing();
      slot.dataset.flOriginalText = slot.textContent || "";
      slot.setAttribute("contenteditable", "plaintext-only");
      slot.setAttribute("data-fl-editing", "1");
      editingEl = slot;
      slot.focus();
      const range = document.createRange();
      range.selectNodeContents(slot);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    function onKeyDown(ev: KeyboardEvent) {
      // Esc exits bg-pan mode regardless of editing state.
      if (
        ev.key === "Escape" &&
        document.documentElement.classList.contains("fl-bg-pan")
      ) {
        document.documentElement.classList.remove("fl-bg-pan");
        try {
          window.parent?.postMessage(
            { type: "fl.design.bg-pan-exited" },
            "*"
          );
        } catch {}
        return;
      }
      if (!editingEl) return;
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        editingEl.blur();
      } else if (ev.key === "Escape") {
        if (editingEl.dataset.flOriginalText !== undefined) {
          editingEl.textContent = editingEl.dataset.flOriginalText!;
        }
        editingEl.blur();
      }
    }

    function onFocusOut(ev: FocusEvent) {
      if (editingEl && ev.target === editingEl) {
        commitEditing();
      }
    }

    // ---------- Drag-to-move for floating elements ----------
    function parsePct(s: string | null | undefined): number {
      if (!s) return 50;
      const m = /^([\d.]+)%$/.exec(s.trim());
      if (m) return parseFloat(m[1]!);
      return 50;
    }

    function onMouseDown(ev: MouseEvent) {
      if (editingEl) return;
      if (ev.button !== 0) return; // left click only
      const action = pickAction(ev.target);
      if (!action || action.type !== "select") return;
      const slot = action.slot;
      const id = slot.dataset.designId!;

      // Branch A: floating element → drag-to-position.
      if (id.startsWith("floating.")) {
        ev.preventDefault();
        ev.stopPropagation();
        const cs = window.getComputedStyle(slot);
        const origX = parseFloat(cs.left) || 0;
        const origY = parseFloat(cs.top) || 0;
        dragState = {
          id,
          el: slot,
          startMx: ev.clientX,
          startMy: ev.clientY,
          origX,
          origY,
        };
        slot.style.cursor = "grabbing";
        return;
      }

      const cs = window.getComputedStyle(slot);

      // Branch B: slot with a background image → pan it (regardless of
      // selection state for the photo backdrop). Slots with a real bg
      // image get pan-priority because that's the more common edit on
      // them.
      const hasBgImage = cs.backgroundImage && cs.backgroundImage !== "none";

      // Branch C (when no bg image): selected slot → drag-translate.
      // Reads the slot's current matrix translate so we don't snap when
      // the slot already has translateX/translateY overrides applied.
      if (!hasBgImage) {
        if (id !== selectedId) return;
        ev.preventDefault();
        ev.stopPropagation();
        let origTx = 0;
        let origTy = 0;
        const m = /matrix\(([^)]+)\)/.exec(cs.transform || "");
        if (m) {
          const parts = m[1]!.split(",").map((s) => parseFloat(s.trim()));
          if (parts.length >= 6) {
            origTx = parts[4] ?? 0;
            origTy = parts[5] ?? 0;
          }
        }
        translateState = {
          id,
          el: slot,
          startMx: ev.clientX,
          startMy: ev.clientY,
          origTx,
          origTy,
        };
        slot.style.cursor = "grabbing";
        document.documentElement.style.userSelect = "none";
        return;
      }

      // Regular slots require a prior selection click before they
      // become drag-pannable (so a stray click doesn't pan something).
      // The photo backdrop is the exception: it sits at z-index -10
      // and is the obvious target for any "empty space" drag, so we
      // let the user click-and-drag in a single motion. If it's not
      // selected yet, select it now AND start the pan.
      const isBackdrop = id === "page.background.photo";
      if (!isBackdrop && id !== selectedId) return;
      if (id !== selectedId) {
        clearSelected();
        selectedId = id;
        slot.setAttribute("data-fl-selected", "1");
        try {
          window.parent?.postMessage(
            {
              type: "fl.design.select",
              elementId: id,
              textKey: slot.dataset.designTextKey,
            },
            "*"
          );
        } catch {}
      }

      ev.preventDefault();
      ev.stopPropagation();
      const [pxStr, pyStr] = (cs.backgroundPosition || "50% 50%").split(" ");
      const rect = slot.getBoundingClientRect();
      bgPanState = {
        id,
        el: slot,
        startMx: ev.clientX,
        startMy: ev.clientY,
        origPx: parsePct(pxStr),
        origPy: parsePct(pyStr),
        w: rect.width,
        h: rect.height,
      };
      slot.style.cursor = "grabbing";
      // Body wins hit-testing over a z-index -10 layer (the photo
      // backdrop), so set the grabbing cursor here too — otherwise
      // dragging on "empty" space would still show the default cursor.
      document.body.style.cursor = "grabbing";
      document.documentElement.style.userSelect = "none";
    }

    function onMouseMove(ev: MouseEvent) {
      if (dragState) {
        const dx = ev.clientX - dragState.startMx;
        const dy = ev.clientY - dragState.startMy;
        dragState.el.style.left = dragState.origX + dx + "px";
        dragState.el.style.top = dragState.origY + dy + "px";
        return;
      }
      if (translateState) {
        const dx = ev.clientX - translateState.startMx;
        const dy = ev.clientY - translateState.startMy;
        const newTx = translateState.origTx + dx;
        const newTy = translateState.origTy + dy;
        // Override just the translate component; preserve any other
        // transforms (scale / rotate) by writing the full transform
        // value. Simplest approach: append translate so it composes.
        translateState.el.style.transform = `translate(${newTx}px, ${newTy}px)`;
        return;
      }
      if (bgPanState) {
        const dx = ev.clientX - bgPanState.startMx;
        const dy = ev.clientY - bgPanState.startMy;
        // Drag right → image moves left visually, so subtract.
        const dpx = -(dx / bgPanState.w) * 100;
        const dpy = -(dy / bgPanState.h) * 100;
        const px = Math.max(0, Math.min(100, bgPanState.origPx + dpx));
        const py = Math.max(0, Math.min(100, bgPanState.origPy + dpy));
        bgPanState.el.style.backgroundPosition = `${px.toFixed(1)}% ${py.toFixed(1)}%`;
      }
    }

    function onMouseUp() {
      if (dragState) {
        const newX = parseFloat(dragState.el.style.left) || 0;
        const newY = parseFloat(dragState.el.style.top) || 0;
        dragState.el.style.cursor = "";
        try {
          window.parent?.postMessage(
            {
              type: "fl.design.move",
              elementId: dragState.id,
              x: newX,
              y: newY,
            },
            "*"
          );
        } catch {}
        dragState = null;
        return;
      }
      if (translateState) {
        // Re-read final translate from the matrix the browser computed
        // (in case other transforms were composed in).
        const cs = window.getComputedStyle(translateState.el);
        let finalTx = 0;
        let finalTy = 0;
        const m = /matrix\(([^)]+)\)/.exec(cs.transform || "");
        if (m) {
          const parts = m[1]!.split(",").map((s) => parseFloat(s.trim()));
          if (parts.length >= 6) {
            finalTx = parts[4] ?? 0;
            finalTy = parts[5] ?? 0;
          }
        }
        translateState.el.style.cursor = "";
        document.documentElement.style.userSelect = "";
        try {
          window.parent?.postMessage(
            {
              type: "fl.design.translate",
              elementId: translateState.id,
              x: finalTx,
              y: finalTy,
            },
            "*"
          );
        } catch {}
        translateState = null;
        return;
      }
      if (bgPanState) {
        const cs = window.getComputedStyle(bgPanState.el);
        const bgPosition = cs.backgroundPosition;
        bgPanState.el.style.cursor = "";
        document.body.style.cursor = "";
        document.documentElement.style.userSelect = "";
        try {
          window.parent?.postMessage(
            {
              type: "fl.design.bg-pan",
              elementId: bgPanState.id,
              bgPosition,
            },
            "*"
          );
        } catch {}
        bgPanState = null;
      }
    }

    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("dblclick", onDblClick, { capture: true });
    document.addEventListener("keydown", onKeyDown, { capture: true });
    document.addEventListener("focusout", onFocusOut, { capture: true });
    document.addEventListener("mousedown", onMouseDown, { capture: true });
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("dblclick", onDblClick, { capture: true });
      document.removeEventListener("keydown", onKeyDown, { capture: true });
      document.removeEventListener("focusout", onFocusOut, { capture: true });
      document.removeEventListener("mousedown", onMouseDown, { capture: true });
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("message", onModeMsg);
      window.removeEventListener(
        "fl.language.change",
        onIframeLangChange as EventListener
      );
      document.documentElement.classList.remove("fl-night-preview");
      style.remove();
    };
  }, [mode]);

  return null;
}

function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && (CSS as { escape?: (s: string) => string }).escape) {
    return (CSS as { escape: (s: string) => string }).escape(s);
  }
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}
