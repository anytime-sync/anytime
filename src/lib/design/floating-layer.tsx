"use client";

import { useDesignMap } from "./provider";
import { DesignSlot } from "./slot";

/**
 * Renders all floating-text overlays for a given page path.
 * Floating elements are stored in `site_design` with overrides
 * containing `_kind: 'floating'` + `_page`. They're rendered on top
 * of regular page content as absolutely-positioned slots.
 *
 * The text content stored on each entry (`_text`) is shared across
 * locales for now; per-locale floating text is Phase 3b.
 */
export function FloatingLayer({ page }: { page: string }) {
  const map = useDesignMap();
  const items = Object.entries(map).filter(
    ([, ov]) => ov?._kind === "floating" && ov?._page === page
  );
  if (items.length === 0) return null;
  return (
    <>
      {items.map(([id, ov]) => (
        <DesignSlot key={id} id={id} as="div">
          {ov._text ?? ""}
        </DesignSlot>
      ))}
    </>
  );
}
