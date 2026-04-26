/**
 * LightRays — warm, photoreal sunbeams against the ivory background.
 *
 * Why "multiply" not "screen": the page background is near-white
 * (#FAF7F2). Screen blend on near-white is invisible — there's
 * nothing to brighten. In a real photograph of sunlight hitting a
 * white wall, the lit areas read as WARMER than the wall, not
 * brighter. Multiply blend with warm gold tints the bg toward
 * orange exactly where the beams pass — which is what eyes
 * recognise as "sunlight".
 *
 * Construction:
 *   1. Long polygons fanning from the upper-right corner.
 *   2. feTurbulence + feDisplacementMap perturb the polygon edges
 *      so they're soft and organic, not vector-clean.
 *   3. Wide gaussian blur (stdDev=24) dissolves the polygons into
 *      atmospheric shafts of light.
 *   4. mix-blend-mode: multiply tints the page warm where each ray lands.
 *   5. A bright sun-disc + warm bloom anchor the source.
 */
export function LightRays() {
  // angle (deg, clockwise from straight-down), length, half-width at far end, opacity.
  const rays: Array<{ a: number; l: number; w: number; o: number }> = [
    { a:  28, l: 2400, w:  70, o: 0.85 },
    { a:  50, l: 2300, w:  40, o: 0.65 },
    { a:  72, l: 2500, w:  90, o: 0.95 },
    { a:  94, l: 2200, w:  50, o: 0.70 },
    { a: 116, l: 2400, w:  60, o: 0.80 },
    { a: 138, l: 2100, w:  35, o: 0.55 },
  ];

  return (
    <svg
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      style={{ mixBlendMode: "multiply" }}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <filter id="ray-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="50" />
          <feGaussianBlur stdDeviation="24" />
        </filter>

        {/* Warm tinted gradient — under MULTIPLY this paints warm
            gold INTO the ivory bg, producing visible sunbeams. */}
        <linearGradient id="ray-tint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#E89A3C" stopOpacity="0.85" />
          <stop offset="20%"  stopColor="#D78B3D" stopOpacity="0.60" />
          <stop offset="50%"  stopColor="#C68A50" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#C89B5A" stopOpacity="0" />
        </linearGradient>

        {/* Source bloom — wide warm halo around the upper-right corner. */}
        <radialGradient id="bloom" cx="0" cy="0" r="520" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#E89A3C" stopOpacity="0.65" />
          <stop offset="35%"  stopColor="#D9913A" stopOpacity="0.30" />
          <stop offset="70%"  stopColor="#C89B5A" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#C89B5A" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Wide warm bloom around the source. */}
      <g transform="translate(1420 -40)">
        <circle r="520" fill="url(#bloom)" />
      </g>

      {/* The beams. */}
      <g transform="translate(1420 -40)" filter="url(#ray-soft)">
        {rays.map(({ a, l, w, o }, i) => (
          <polygon
            key={i}
            points={`0,0 ${-w},${l} ${w},${l}`}
            fill="url(#ray-tint)"
            opacity={o}
            transform={`rotate(${a})`}
          />
        ))}
      </g>
    </svg>
  );
}
