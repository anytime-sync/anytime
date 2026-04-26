"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

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
 * always sharp; bg-color frames it softly. Gradient overlay at cover
 * fills the whole viewport.
 *
 * Swap a photo any time: replace /public/{light,dark}-bg.jpg AND bump
 * the ?v= number below so caches invalidate.
 */
export function PhotoBackground() {
  const { resolvedTheme } = useTheme();
  // Avoid SSR/CSR mismatch: render the light photo on first paint, then
  // upgrade to the resolved theme on the client. This keeps the
  // fixed-layer markup identical between server and client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  // Light: ivory veil + warm photo. Dark: charcoal veil + moody photo
  // with a touch of warm contrast so it doesn't fall flat.
  const overlay = isDark
    ? "linear-gradient(180deg, hsla(0, 0%, 0%, 0.18) 0%, hsla(0, 0%, 0%, 0.05) 40%, hsla(0, 0%, 0%, 0.20) 100%)"
    : "linear-gradient(180deg, hsla(36, 36%, 96%, 0.05) 0%, hsla(36, 36%, 96%, 0.00) 40%, hsla(36, 36%, 96%, 0.05) 100%)";
  const photo = isDark ? "/dark-bg.jpg?v=1" : "/light-bg.jpg?v=16";

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 transition-opacity duration-300"
      style={{
        backgroundImage: `${overlay}, url('${photo}')`,
        backgroundSize: "min(78vmin, 1900px) auto, cover",
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat, no-repeat",
        backgroundAttachment: "fixed, fixed",
        backgroundColor: "hsl(var(--bg))",
      }}
    />
  );
}
