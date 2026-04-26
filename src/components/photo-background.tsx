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
 * Dark mode uses a CSS `transform: scale` on the bg layer to zoom in
 * past 1x cover, cropping the photo to a tighter focal slice. The
 * uploaded dark photo (a row of lamps in fog) reads as a repeating
 * pattern at 1x; the zoom kills that feel.
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
  const photo = isDark ? "/dark-bg.jpg?v=2" : "/light-bg.jpg?v=16";

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: "hsl(var(--bg))" }}
    >
      {/* Inner layer is bg-cover scaled up so dark mode crops to a single
          focal slice (kills the "repeating row of lamps" feel). Light mode
          stays at 1x — the bedroom photo reads better fully visible. */}
      <div
        className="absolute inset-0 transition-transform duration-300"
        style={{
          backgroundImage: `${overlay}, url('${photo}')`,
          backgroundSize: "min(78vmin, 1900px) auto, cover",
          backgroundPosition: "center, center",
          backgroundRepeat: "no-repeat, no-repeat",
          transform: isDark ? "scale(2)" : "none",
          transformOrigin: "center center",
        }}
      />
    </div>
  );
}
