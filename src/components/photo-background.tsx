/**
 * PhotoBackground — the single source of truth for the app's
 * ambient photographic backdrop. Renders as a fixed full-viewport
 * layer at z-index -10, so every UI surface above it can be made
 * translucent (.surface) to let the photo bleed through.
 *
 * Swap the photo at any time: replace /public/light-bg.jpg.
 * No code changes needed — just commit the new file.
 *
 * Why a real component (not body background-image):
 *   - body bg gets covered by any opaque app-shell wrapper
 *     (h-screen w-screen often paints something).
 *   - A dedicated layer is bullet-proof: it sits at -z-10 and
 *     pointer-events:none, so it can never affect layout or
 *     interaction. The image always shows wherever the layers
 *     above are not solid.
 *   - We can also stack a subtle warm overlay on top of the photo
 *     here (in one place) to keep tonality consistent across the
 *     app no matter what photo the user drops in.
 */
export function PhotoBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        backgroundImage:
          // Subtle warm overlay on top of the user's photo so any
          // image gets pulled toward the First Light palette. Drop
          // the overlay if you want the photo at full saturation.
          // Cache-bust the photo URL on every release so neither
          // the SW nor the browser HTTP cache can serve a stale
          // version. Bump BG_VERSION when you swap the photo.
          "linear-gradient(180deg, hsla(36, 36%, 96%, 0.08) 0%, hsla(36, 36%, 96%, 0.02) 40%, hsla(36, 36%, 96%, 0.08) 100%), url('/light-bg.jpg?v=9')",
       