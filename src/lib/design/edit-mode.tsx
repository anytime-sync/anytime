"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { readStoredLanguage } from "@/lib/i18n";

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
            { type: "fl.design.floating-text", elementId: id, value: newText, locale },
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
          { type: "fl.design.select", elementId: selectedId },
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

    function parsePct(s: string | null | undefined): number {
      if (!s) return 50;
      const m = /^([\d.]+)%$/.exec(s.trim());
      if (m) return parseFloat(m[1]!);
      return 50;
    }
    function onMouseDown(ev: MouseEvent) {
      if (editingEl) return;
      if (ev.button !== 0) return;
      const action = pickAction(ev.target);
      if (!action || action.type !== "select") return;
      const slot = action.slot;
      const id = slot.dataset.designId!;
      if (id.startsWith("floating.")) {
        ev.preventDefault();
        ev.stopPropagation();
        const cs = window.getComputedStyle(slot);
        const origX = parseFloat(cs.left) || 0;
        const origY = parseFloat(cs.top) || 0;
        dragState = { id, el: slot, startMx: ev.clientX, startMy: ev.clientY, origX, origY };
        slot.style.cursor = "grabbing";
        return;
      }
      if (id !== selectedId) return;
      const cs = window.getComputedStyle(slot);
      if (!cs.backgroundImage || cs.backgroundImage === "none") return;
      ev.preventDefault();
      ev.stopPropagation();
      const [pxStr, pyStr] = (cs.backgroundPosition || "50% 50%").split(" ");
      const rect = slot.getBoundingClientRect();
      bgPanState = {
        id, el: slot,
        startMx: ev.clientX, startMy: ev.clientY,
        origPx: parsePct(pxStr), origPy: parsePct(pyStr),
        w: rect.width, h: rect.height,
      };
      slot.style.cursor = "grabbing";
    }
    function onMouseMove(ev: MouseEvent) {
      if (dragState) {
        const dx = ev.clientX - dragState.startMx;
        const dy = ev.clientY - dragState.startMy;
        dragState.el.style.left = dragState.origX + dx + "px";
        dragState.el.style.top = dragState.origY + dy + "px";
        return;
      }
      if (bgPanState) {
        const dx = ev.clientX - bgPanState.startMx;
        const dy = ev.clientY - bgPanState.startMy;
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
          window.parent?.postMessage({ type: "fl.design.move", elementId: dragState.id, x: newX, y: newY }, "*");
        } catch {}
        dragState = null;
        return;
      }
      if (bgPanState) {
        const cs = window.getComputedStyle(bgPanState.el);
        const bgPosition = cs.backgroundPosition;
        bgPanState.el.style.cursor = "";
        try {
          window.parent?.postMessage({ type: "fl.design.bg-pan", elementId: bgPanState.id, bgPosition }, "*");
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
