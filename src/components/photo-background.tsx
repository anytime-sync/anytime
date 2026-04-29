"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import { useDesign } from "@/lib/design/provider";
import { cn } from "@/lib/utils";

/**
 * PhotoBackground — single source of truth for the app's ambient
 * photographic backdrop. Renders as a fixed full-viewport layer at
 * z-index -10, so every UI surface above it can be made translucent
 * (.surface) to let the photo bleed through.
 *
 * The image, framing, and transforms are persisted under design slot
 * `app.background.photo` so the /admin/design editor can adjust them.
 * Defaults below are the *current visible state* — if no override is
 * stored, the photo renders exactly as it always has, and editing
 * starts from that baseline.
 *
 *   light: /light-bg.jpg, center, min(78vmin, 1900px) auto, scale 1
 *   dark : /dark-bg.jpg, center, min(78vmin, 1900px) auto, scale 2.4
 *
 * Edit-mode (`?design=edit` on the iframe URL): we strip
 * `pointer-events-none` and tag the photo layer with `data-design-id`
 * so the editor's existing click-to-select + drag-to-pan logic in
 * edit-mode.tsx picks up the photo as a normal slot. Outside edit
 * mode the layer remains pointer-events-none so the rest of the UI
 * is unaffected.
 */

const SLOT_ID = "app.background.photo";
const DEFAULT_PHOTO_LIGHT = "/light-bg.jpg?v=16";
const DEFAULT_PHOTO_DARK = "/dark-bg.jpg?v=2";
const DEFAULT_BG_POS = "center";
const DEFAULT_BG_SIZE = "min(78vmin, 1900px) auto";
const DARK_DEFAULT_SCALE = 2.4;

export function PhotoBackground() {
  const { resolvedTheme } = useTheme();
  const ov = useDesign(SLOT_ID);
  const sp = useSearchParams();
  const editMode = sp?.get("design") === "edit";

  // SSR/CSR mismatch guard.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Editor preview-mode marker class.
  const [previewNight, setPreviewNight] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () =>
      setPreviewNight(
        document.documentElement.classList.contains("fl-night-preview")
      );
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  const isDark = (mounted && resolvedTheme === "dark") || previewNight;

  const overlay = isDark
    ? "linear-gradient(180deg, hsla(0, 0%, 0%, 0.45) 0%, hsla(0, 0%, 0%, 0.32) 40%, hsla(0, 0%, 0%, 0.50) 100%)"
    : "linear-gradient(180deg, hsla(36, 36%, 96%, 0.05) 0%, hsla(36, 36%, 96%, 0.00) 40%, hsla(36, 36%, 96%, 0.05) 100%)";

  // Resolve image / position / size — night override → legacy dark
  // field → day override → static default.
  const photo = isDark
    ? ov.night?.bgImageUrl ||
      ov.bgImageUrlDark ||
      ov.bgImageUrl ||
      DEFAULT_PHOTO_DARK
    : ov.bgImageUrl || DEFAULT_PHOTO_LIGHT;
  const pos = isDark
    ? ov.night?.bgPosition ||
      ov.bgPositionDark ||
      ov.bgPosition ||
      DEFAULT_BG_POS
    : ov.bgPosition || DEFAULT_BG_POS;
  const size = isDark
    ? ov.night?.bgSize || ov.bgSizeDark || ov.bgSize || DEFAULT_BG_SIZE
    : ov.bgSize || DEFAULT_BG_SIZE;

  // Per-mode transform — night.X ?? top-level X ?? mode default.
  const tx = (isDark ? ov.night?.translateX : undefined) ?? ov.translateX ?? 0;
  const ty = (isDark ? ov.night?.translateY : undefined) ?? ov.translateY ?? 0;
  const scale =
    (isDark ? ov.night?.scale : undefined) ??
    ov.scale ??
    (isDark ? DARK_DEFAULT_SCALE : 1);
  const rotate = (isDark ? ov.night?.rotate : undefined) ?? ov.rotate ?? 0;
  const opacity = (isDark ? ov.night?.opacity : undefined) ?? ov.opacity ?? 1;

  const tParts: string[] = [];
  if (tx !== 0 || ty !== 0) tParts.push(`translate(${tx}px, ${ty}px)`);
  if (scale !== 1) tParts.push(`scale(${scale})`);
  if (rotate !== 0) tParts.push(`rotate(${rotate}deg)`);
  const transform = tParts.length > 0 ? tParts.join(" ") : "none";

  return (
    <div
      aria-hidden={!editMode}
      className={cn(
        "fixed inset-0 -z-10 overflow-hidden",
        !editMode && "pointer-events-none"
      )}
      style={{ backgroundColor: "hsl(var(--bg))" }}
    >
      <div
        // In edit mode the inner div is the actual draggable target —
        // the editor's onClick/onMouseDown handlers walk up looking
        // for `data-design-id`, so tagging here lets the user click
        // to select and drag-to-pan the bg position directly.
        {...(editMode ? { "data-design-id": SLOT_ID } : {})}
        className={cn(
          "absolute inset-0 transition-transform duration-300",
          editMode && "cursor-grab"
        )}
        style={{
          backgroundImage: `${overlay}, url('${photo}')`,
          backgroundSize: `cover, ${size}`,
          backgroundPosition: `center, ${pos}`,
          backgroundRepeat: "no-repeat, no-repeat",
          transform,
          opacity,
          transformOrigin: "center center",
        }}
      />
    </div>
  );
}
