/**
 * PhotoBackground — single source of truth for the app's ambient
 * photographic backdrop. Renders as a fixed full-viewport layer at
 * z-index -10, so every UI surface above it can be made translucent
 * (.surface) to let the photo bleed through.
 *
 * Sizing strategy:
 *   - The PHOTO is sized to ~80% of the viewport (max 2400px), so it
 *     never upscales past its native resolution. Result: always sharp,
 *     never pixelated. The page bg-color frames the photo softly.
 *   - The warm GRADIENT overlay still uses cover, so the framing
 *     edges feel lit, not bare.
 *
 * Swap the photo any time: replace /public/light-bg.jpg AND bump
 * the ?v= number below so caches invalidate.
 */
export function PhotoBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        backgroundImage:
          "linear-gradient(180deg, hsla(36, 36%, 96%, 0.05) 0%, hsla(36, 36%, 96%, 0.00) 40%, hsla(36, 36%, 96%, 0.05) 100%), url('/light-bg.jpg?v=14')",
        // photo: 78% of the smaller axis, never upscales beyond native;
        // gradient: cover, so the soft warm wash fills the whole frame.
        backgroundSize: "min(78vmin, 1900px) auto, cover",
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat, no-repeat",
        backgroundAttachment: "fixed, fixed",
        backgroundColor: "hsl(var(--bg))",
      }}
    />
  );
}
