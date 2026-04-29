"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useDesign, useIsDark } from "@/lib/design/provider";

/**
 * PhotoBackground — single source of truth for the app's ambient
 * photographic backdrop. Renders as a fixed full-viewport layer at
 * z-index -10, so every UI surface above it can be made translucent
 * (.surface) to let the photo bleed through.
 *
 * Two photos: a soft warm one for light theme and a moody dim one for
 * dark theme. The visible image follows next-themes' resolvedTheme so
 * the toggle button in the sidebar swaps the photo with the palette.
 *
 * Sizing: photo capped at 78vmin / 1900px native — never upscales,
 * always sharp; bg-color frames it softly. Gradient overlay sits in
 * its own non-interactive layer above the photo, so direct drag-pan
 * inside the editor only affects the photo's backgroundPosition.
 *
 * The /admin/design editor can override the photo, the position and
 * the size — independently per day/night via the `night` sub-object
 * on the override row. The slot id is "page.background.photo".
 *
 * Edit mode: when the page is loaded inside the editor's iframe
 * (`?design=edit`), the photo layer becomes interactive. Click to
 * select, then drag to pan — edit-mode.tsx persists the new
 * backgroundPosition back to the active mode (day or night).
 *
 * Swap a photo any time: replace /public/{light,dark}-bg.jpg AND bump
 * the ?v= number below so caches invalidate.
 */

const SLOT_ID = "page.background.photo";
const DEFAULT_PHOTO_LIGHT = "/light-bg.jpg?v=16";
const DEFAULT_PHOTO_DARK = "/dark-bg.jpg?v=2";
const DARK_DEFAULT_SCALE = 2.4;

export function PhotoBackground() {
  const { resolvedTheme } = useTheme();
  const overrides = useDesign(SLOT_ID);
  const isDarkPreview = useIsDark();

  // Avoid SSR/CSR mismatch + bypass useSearchParams (which would opt
  // the layout out of static rendering). Read ?design=edit from the
  // URL after mount; before mount we render the non-interactive layer.
  const [mounted, setMounted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setEditMode(params.get("design") === "edit");
    }
  }, []);

  const isDark = mounted && (resolvedTheme === "dark" || isDarkPreview);

  // Light: ivory veil. Dark: charcoal veil with warm contrast.
  const overlay = isDark
    ? "linear-gradient(180deg, hsla(0, 0%, 0%, 0.45) 0%, hsla(0, 0%, 0%, 0.32) 40%, hsla(0, 0%, 0%, 0.50) 100%)"
    : "linear-gradient(180deg, hsla(36, 36%, 96%, 0.05) 0%, hsla(36, 36%, 96%, 0.00) 40%, hsla(36, 36%, 96%, 0.05) 100%)";

  // Resolve photo / position / size per-mode with day fallback.
  const dayPhoto = overrides.bgImageUrl ?? DEFAULT_PHOTO_LIGHT;
  const nightPhoto =
    overrides.night?.bgImageUrl ?? overrides.bgImageUrl ?? DEFAULT_PHOTO_DARK;
  const photo = isDark ? nightPhoto : dayPhoto;

  const dayPosition = overrides.bgPosition ?? "center";
  const nightPosition =
    overrides.night?.bgPosition ?? overrides.bgPosition ?? "center";
  const position = isDark ? nightPosition : dayPosition;

  const daySize = overrides.bgSize ?? "min(78vmin, 1900px) auto";
  const nightSize =
    overrides.night?.bgSize ?? overrides.bgSize ?? "min(78vmin, 1900px) auto";
  const size = isDark ? nightSize : daySize;

  // Transform: per-mode translate / scale / rotate / opacity.
  const tx =
    (isDark ? overrides.night?.translateX : undefined) ??
    overrides.translateX ??
    0;
  const ty =
    (isDark ? overrides.night?.translateY : undefined) ??
    overrides.translateY ??
    0;
  const scaleOverride =
    (isDark ? overrides.night?.scale : undefined) ?? overrides.scale;
  // Default night zoom is 2.4x (legacy) until an explicit scale is set.
  const scale = scaleOverride ?? (isDark ? DARK_DEFAULT_SCALE : 1);
  const rotate =
    (isDark ? overrides.night?.rotate : undefined) ?? overrides.rotate ?? 0;
  const opacity =
    (isDark ? overrides.night?.opacity : undefined) ?? overrides.opacity ?? 1;

  const transformParts: string[] = [];
  if (tx || ty) transformParts.push(`translate(${tx}px, ${ty}px)`);
  if (scale !== 1) transformParts.push(`scale(${scale})`);
  if (rotate) transformParts.push(`rotate(${rotate}deg)`);
  const transform = transformParts.length ? transformParts.join(" ") : "none";

  // Edit mode: outer container becomes interactive (pointer-events on)
  // and the photo layer carries data-design-id so it can be selected
  // and dragged. The overlay layer always stays pointer-events-none.
  return (
    <div
      aria-hidden
      {...(editMode ? { "data-fl-photo-wrapper": "1" } : {})}
      className={
        editMode
          ? "fl-photo-wrapper fixed inset-0 -z-10 overflow-hidden"
          : "pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      }
      style={{ backgroundColor: "hsl(var(--bg))" }}
    >
      {/* Photo layer — the only thing the user drags. */}
      <div
        {...(editMode ? { "data-design-id": SLOT_ID } : {})}
        className={
          editMode
            ? "absolute inset-0 transition-transform duration-300 cursor-grab"
            : "absolute inset-0 transition-transform duration-300"
        }
        style={{
          backgroundImage: `url('${photo}')`,
          backgroundSize: size,
          backgroundPosition: position,
          backgroundRepeat: "no-repeat",
          transform,
          transformOrigin: "center center",
          opacity,
        }}
      />
      {/* Overlay layer — gradient veil, never interactive. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: overlay,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
    </div>
  );
}
