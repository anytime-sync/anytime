/**
 * PhotoBackground — single source of truth for the app's ambient
 * photographic backdrop. Renders as a fixed full-viewport layer at
 * z-index -10, so every UI surface above it can be made translucent
 * (.surface) to let the photo bleed through.
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
          "linear-gradient(180deg, hsla(36, 36%, 96%, 0.06) 0%, hsla(36, 36%, 96%, 0.00) 40%, hsla(36, 36%, 96%, 0.06) 100%), url('/light-bg.jpg?v=12')",
        backgroundSize: "cover, cover",
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat, no-repeat",
        backgroundAttachment: "fixed, fixed",
      }}
    />
  );
}
