/**
 * LightRays — photoreal volumetric god rays from the upper-right corner.
 *
 * Approach (closer to a photograph than a vector illustration):
 *   1. Each beam is a long polygon, but heavily blurred and then
 *      perturbed with feTurbulence + feDisplacementMap so the edges
 *      become soft, organic, and slightly noisy — like real light
 *      passing through atmospheric particles.
 *   2. The whole layer uses mix-blend-mode: screen so the beams
 *      brighten the page underneath (the way real photons do)
 *      instead of painting flat polygons over the top of it.
 *   3. A wide warm bloom + a tight bright core sit at the source,
 *      so the rays appear to emerge from a luminous sun-spot.
 *   4. A faint, large-scale turbulence layer simulates dust / haze
 *      catching the light between the beams.
 */
export function LightRays() {
  // angle (deg, clockwise from straight-down), length, half-width at far end, opacity.
  const rays: Array<{ a: number; l: number; w: number; o: number }> = [
    { a:  30, l: 2400, w:  60, o: 0.85 },
    { a:  52, l: 2300, w:  35, o: 0.65 },
    { a:  74, l: 2500, w:  80, o: 0.95 },
    { a:  96, l: 2200, w:  45, o: 0.70 },
    { a: 118, l: 2400, w:  55, o: 0.80 },
    { a: 140, l: 2100, w:  30, o: 0.55 },
  ];

  return (
    <svg
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      style={{ mixBlendMode: "screen" }}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        {/* Volumetric softener: gentle turbulence displaces the polygon
            edges, then a wide blur dissolves them into atmospheric beams. */}
        <filter id="ray-volumetric" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="40" />
          <feGaussianBlur stdDeviation="22" />
        </filter>

        {/* A second, narrower blur for the bright inner core of each shaft. */}
        <filter id="ray-core" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" />
        </filter>

        {/* Large dust/haze noise — barely visible, but it makes the
            empty space between beams feel like real lit air. */}
        <filter id="dust" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
          <feColorMatrix
            values="0 0 0 0 1
                    0 0 0 0 0.9
                    0 0 0 0 0.7
                    0 0 0 0.06 0"
          />
        </filter>

        <linearGradient id="ray-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#FFF1D6" stopOpacity="1" />
          <stop offset="8%"   stopColor="#FFE0AE" stopOpacity="0.95" />
          <stop offset="30%"  stopColor="#F2C68C" stopOpacity="0.55" />
          <stop offset="60%"  stopColor="#D9A36A" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#C89B5A" stopOpacity="0" />
        </linearGradient>

        <linearGradient id="ray-core-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="20%"  stopColor="#FFEBC4" stopOpacity="0.6" />
          <stop offset="55%"  stopColor="#FFD699" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#FFD699" stopOpacity="0" />
        </linearGradient>

        {/* Wide warm bloom around the source. */}
        <radialGradient id="bloom-wide" cx="0" cy="0" r="520" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FFF0CC" stopOpacity="0.75" />
          <stop offset="35%"  stopColor="#F2C68C" stopOpacity="0.30" />
          <stop offset="70%"  stopColor="#C89B5A" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#C89B5A" stopOpacity="0" />
        </radialGradient>

        {/* Tight bright sun-core. */}
        <radialGradient id="bloom-core" cx="0" cy="0" r="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="60%"  stopColor="#FFE6BD" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FFE6BD" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Atmospheric dust between the rays (very faint, full canvas). */}
      <rect x="0" y="0" width="1440" height="900" filter="url(#dust)" opacity="0.55" />

      {/* Wide warm bloom behind the rays. */}
      <g transform="translate(1400 -20)">
        <circle r="520" fill="url(#bloom-wide)" />
      </g>

      {/* Volumetric soft beams (the diffuse outer halo of each shaft). */}
      <g transform="translate(1400 -20)" filter="url(#ray-volumetric)">
        {rays.map(({ a, l, w, o }, i) => (
          <polygon
            key={`v${i}`}
            points={`0,0 ${-w},${l} ${w},${l}`}
            fill="url(#ray-gradient)"
            opacity={o}
            transform={`rotate(${a})`}
          />
        ))}
      </g>

      {/* Bright inner cores — narrower polygons, gentler blur. */}
      <g transform="translate(1400 -20)" filter="url(#ray-core)">
        {rays.map(({ a, l, w, o }, i) => (
          <polygon
            key={`c${i}`}
            points={`0,0 ${-w * 0.35},${l * 0.85} ${w * 0.35},${l * 0.85}`}
            fill="url(#ray-core-gradient)"
            opacity={o * 0.9}
            transform={`rotate(${a})`}
          />
        ))}
      </g>

      {/* Bright sun-core sits on top of everything. */}
      <g transform="translate(1400 -20)">
        <circle r="120" fill="url(#bloom-core)" />
      </g>
    </svg>
  );
}
