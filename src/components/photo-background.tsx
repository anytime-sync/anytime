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
 * Default photos: /light-bg.jpg + /dark-bg.jpg in /public. The
 * /admin/design editor can override either (or both) and tune their
 * scale and position via the design slot id below — overrides land
 * in the same site_design table as every other DesignSlot, so nothing
 * special is needed to persist them.
 *
 * The editor previews night styling via the `.fl-night-preview`
 * marker class on <html>; we listen for that as a third signal
 * alongside next-themes' resolvedTheme.
 */

const SLOT_ID = "app.background.photo";

export function PhotoBackground() {
  const { resolvedTheme } = useTheme();
  const ov = useDesign(SLOT_ID);

  // SSR/CSR mismatch guard: render light on first paint, then upgrade.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Editor preview: when /admin/design's iframe sets `fl-night-preview`
  // on <html> we want to render the night photo even though
  // next-themes hasn't actually flipped.
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

  // Light: ivory veil + warm photo. Dark: charcoal veil + moody photo
  // with a touch of warm contrast so it doesn't fall flat.
  const overlay = isDark
    ? "linear-gradient(180deg, hsla(0, 0%, 0%, 0.45) 0%, hsla(0, 0%, 0%, 0.32) 40%, hsla(0, 0%, 0%, 0.50) 100%)"
    : "linear-gradient(180deg, hsla(36, 36%, 96%, 0.05) 0%, hsla(36, 36%, 96%, 0.00) 40%, hsla(36, 36%, 96%, 0.05) 100%)";

  // Resolve photo URL: editor override → default static asset.
  const lightPhoto = ov.bgImageUrl || "/light-bg.jpg?v=16";
  const darkPhoto = ov.bgImageUrlDark || ov.bgImageUrl || "/dark-bg.jpg?v=2";
  const photo = isDark ? darkPhoto : lightPhoto;

  // Sizing + position: editor override → sensible defaults that match
  // the original "single focal slice" framing.
  const lightSize = ov.bgSize || "min(78vmin, 1900px) auto";
  const darkSize = ov.bgSizeDark || ov.bgSize || "min(78vmin, 1900px) auto";
  const size = isDark ? darkSize : lightSize;

  const lightPos = ov.bgPosition || "center";
  const darkPos = ov.bgPositionDark || ov.bgPosition || "center";
  const pos = isDark ? darkPos : lightPos;

  // Old behaviour: in dark mode the dark photo was scaled up 2.4x to
  // crop into a single focal slice. Once the user uploads their own
  // dark photo we drop that transform — they're picking the framing
  // themselves now.
  const transform =
    isDark && !ov.bgImageUrlDark ? "scale(2.4)" : "none";

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
          transformOrigin: "center center",
        }}
      />
    </div>
  );
}
