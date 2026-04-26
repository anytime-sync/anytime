/**
 * PhotoBackground — single source of truth for the app's ambient
 * photographic backdrop. Renders as a fixed full-viewport layer at
 * z-index -10, so every UI surface above it can be made translucent
 * (.surface) to let the photo bleed through.
 *
 * Sizing: photo capped at 78vmin / 1900px native — never upscales,
 * always sharp; bg-color frames it softly. Gradient overlay at cover
 * fills the whole viewport.
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
          "linear-gradient(180deg, hsla(36, 36%, 96%, 0.05) 0%, hsla(36, 36%, 96%, 0.00) 40%, hsla(36, 36%, 96%, 0.05) 100%), url('/light-bg.jpg?v=15')",
        backgroundSize: "min(78vmin, 1900px) auto, cover",
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat, no-repeat",
        backgroundAttachment: "fixed, fixed",
        backgroundColor: "hsl(var(--bg))",
      }}
    />
  );
}
