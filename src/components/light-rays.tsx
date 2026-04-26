/**
 * LightRays — a fixed-position SVG layer that paints crisp light beams
 * radiating from the upper-right corner of the viewport.
 *
 * Each ray is a long thin triangle (vertex at the source, narrow base
 * far away) filled with a linear gradient: bright warm-gold at the
 * source, fading to transparent over the length of the beam. The
 * polygon edges themselves stay sharp, so the rays read as real
 * shafts of light — not ambient haze.
 *
 * Sits at z-index -10 with pointer-events: none so it never blocks
 * interaction. preserveAspectRatio="xMidYMid slice" makes the rays
 * scale to fill any viewport without distorting the geometry.
 */
export function LightRays() {
  // Each entry: angle (in degrees, clockwise from straight-down),
  // length (in viewBox units), half-width at the far end (in viewBox units).
  // Asymmetric values keep the fan organic — wider/narrower rays at
  // uneven angles read as real morning light, not a stencilled pattern.
  const rays: Array<{ a: number; l: number; w: number; o: number }> = [
    { a:  35, l: 2400, w:  18, o: 0.55 },
    { a:  55, l: 2300, w:  10, o: 0.42 },
    { a:  78, l: 2500, w:  22, o: 0.60 },
    { a:  98, l: 2200, w:  12, o: 0.40 },
    { a: 118, l: 2400, w:  16, o: 0.50 },
    { a: 142, l: 2100, w:   8, o: 0.32 },
  ];

  return (
    <svg
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        {/* Bright at the source, fading along the ray length.
            Defined in objectBoundingBox space so it follows each
            polygon's local axis after rotation. */}
        <linearGradient id="ray-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#FFE6BD" stopOpacity="0.95" />
          <stop offset="6%"   stopColor="#F5CD9A" stopOpacity="0.85" />
          <stop offset="35%"  stopColor="#E6B87A" stopOpacity="0.30" />
          <stop offset="70%"  stopColor="#C89B5A" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#C89B5A" stopOpacity="0" />
        </linearGradient>
        {/* Soft warm halo around the source point, so the rays
            appear to emerge from a luminous spot rather than a
            geometric vertex. */}
        <radialGradient id="ray-source" cx="0" cy="0" r="220" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FFE6BD" stopOpacity="0.55" />
          <stop offset="40%"  stopColor="#E6B87A" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#E6B87A" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Source halo at upper-right corner. */}
      <g transform="translate(1400 -20)">
        <circle r="220" fill="url(#ray-source)" />
        {/* Each ray: thin triangle pointing down by default,
            then rotated clockwise by `a` degrees. */}
        {rays.map(({ a, l, w, o }, i) => (
          <polygon
            key={i}
            points={`0,0 ${-w},${l} ${w},${l}`}
            fill="url(#ray-gradient)"
            opacity={o}
            transform={`rotate(${a})`}
          />
        ))}
      </g>
    </svg>
  );
}
