"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useDesign } from "@/lib/design/provider";

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
 * starts from that baseline so the user is adjusting *from* the
 * current setup rather than from blank fields.
 *
 *   light: /light-bg.jpg, center, min(78vmin, 1900px) auto, scale 1
 *   dark : /dark-bg.jpg, center, min(78vmin, 1900px) auto, scale 2.4
 *
 * The dark-mode 2.4× crop is a baked-in default that gets out of the
 * way the moment the user explicitly sets `scale` in the editor.
 *
 * Editor preview: when /admin/design's iframe sets `fl-night-preview`
 * on <html> we treat that as "render the night photo" even though
 * next-themes hasn't actually flipped.
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

  // Resolve image / position / size — editor override → default.
  const photo = isDark
    ? ov.bgImageUrlDark || ov.bgImageUrl || DEFAULT_PHOTO_DARK
    : ov.bgImageUrl || DEFAULT_PHOTO_LIGHT;
  const pos = isDark
    ? ov.bgPositionDark || ov.bgPosition || DEFAULT_BG_POS
    : ov.bgPosition || DEFAULT_BG_POS;
  const size = isDark
    ? ov.bgSizeDark || ov.bgSize || DEFAULT_BG_SIZE
    : ov.bgSize || DEFAULT_BG_SIZE;

  // Transform: shared overrides apply to the inner photo layer (so the
  // editor's Transform section moves/scales/rotates the photo itself,
  // not the fixed full-viewport wrapper). Dark mode falls back to the
  // baked-in 2.4× crop when no scale override is set, so the moody
  // focal-slice framing keeps working out of the box.
  const tx = ov.translateX ?? 0;
  const ty = ov.translateY ?? 0;
  const scale =
    ov.scale ?? (isDark ? DARK_DEFAULT_SCALE : 1);
  const rotate = ov.rotate ?? 0;
  const opacity = ov.opacity ?? 1;

  const tParts: string[] = [];
  if (tx !== 0 || ty !== 0) tParts.push(`translate(${tx}px, ${ty}px)`);
  if (scale !== 1) tParts.push(`scale(${scale})`);
  if (rotate !== 0) tParts.push(`rotate(${rotate}deg)`);
  const transform = tParts.length > 0 ? tParts.join(" ") : "none";

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: "hsl(var(--bg))" }}
    >
      <div
        className="absolute inset-0 transition-transform duration-300"
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
