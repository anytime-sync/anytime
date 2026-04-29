"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Mounted at the root layout. When the page is loaded inside the
 * /admin/design editor's iframe (signalled by `?design=edit`), this
 * component:
 *
 *   1. Injects a small CSS that outlines every [data-design-id] on
 *      hover and the currently-selected one with a gold ring.
 *   2. Captures clicks anywhere on the page and, if the click hit a
 *      DesignSlot, postMessages the element_id up to the parent
 *      window so the side panel can swap to that slot.
 *   3. Posts a `fl.design.ready` message so the parent can flush the
 *      latest map back into the iframe's DesignProvider.
 *
 * Outside edit mode this component renders nothing and attaches no
 * listeners — the runtime cost is one render with `mode = null`.
 */
export function DesignEditMode() {
  const sp = useSearchParams();
  const mode = sp?.get("design");

  useEffect(() => {
    if (mode !== "edit") return;
    if (typeof window === "undefined") return;

    // Tell the parent we're alive and ready to receive bulk updates.
    try {
      window.parent?.postMessage({ type: "fl.design.ready" }, "*");
    } catch {}

    let selectedId: string | null = null;

    // Inject overlay styles. Scoped to a stylesheet we own so we can
    // tear it down cleanly.
    const style = document.createElement("style");
    style.dataset.flDesignEdit = "1";
    style.textContent = `
      [data-design-id] {
        outline: 1px dashed transparent;
        outline-offset: 2px;
        transition: outline-color 120ms ease;
        cursor: pointer !important;
      }
      [data-design-id]:hover {
        outline-color: rgba(202, 162, 80, 0.55);
      }
      [data-design-id][data-fl-selected="1"] {
        outline: 2px solid rgba(202, 162, 80, 0.95) !important;
        outline-offset: 3px;
      }
      /* Disable any link/button navigation so clicks land on selection */
      a[data-design-id], button[data-design-id] { pointer-events: auto; }
    `;
    document.head.appendChild(style);

    function findSlot(target: EventTarget | null): HTMLElement | null {
      let el = target as HTMLElement | null;
      while (el && el !== document.body) {
        if (el.dataset && el.dataset.designId) return el;
        el = el.parentElement;
      }
      return null;
    }

    function onClick(ev: MouseEvent) {
      const slot = findSlot(ev.target);
      if (!slot) return;
      ev.preventDefault();
      ev.stopPropagation();
      // Clear previous selection mark.
      if (selectedId) {
        document
          .querySelectorAll(`[data-design-id="${cssEscape(selectedId)}"]`)
          .forEach((n) => (n as HTMLElement).removeAttribute("data-fl-selected"));
      }
      selectedId = slot.dataset.designId!;
      slot.setAttribute("data-fl-selected", "1");
      try {
        window.parent?.postMessage(
          { type: "fl.design.select", elementId: selectedId },
          "*"
        );
      } catch {}
    }

    // Use capture phase so we beat e.g. button onclick handlers.
    document.addEventListener("click", onClick, { capture: true });

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      style.remove();
    };
  }, [mode]);

  return null;
}

function cssEscape(s: string): string {
  // Minimal CSS.escape polyfill — modern browsers have it but we
  // shouldn't assume.
  if (typeof CSS !== "undefined" && (CSS as { escape?: (s: string) => string }).escape) {
    return (CSS as { escape: (s: string) => string }).escape(s);
  }
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}
