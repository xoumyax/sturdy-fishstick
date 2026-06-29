const WY = 522; // water Y in SVG units (viewBox 1440×900, water at 58%)

function Fish({ color, size = 1 }) {
  return (
    <g transform={`scale(${size})`}>
      <path d="M -30,0 L -52,-14 L -52,14 Z" fill={color} opacity="0.85" />
      <ellipse cx="0" cy="0" rx="30" ry="12" fill={color} />
      <ellipse cx="4" cy="3" rx="18" ry="6" fill="white" opacity="0.12" />
      <path d="M -6,-12 Q 4,-24 14,-12" fill={color} opacity="0.8" />
      <circle cx="19" cy="-2" r="3.5" fill="white" />
      <circle cx="20" cy="-2" r="1.8" fill="#0f172a" />
      <circle cx="20.7" cy="-2.7" r="0.7" fill="white" opacity="0.9" />
    </g>
  );
}

// Wave path: repeating Q curve every 400px, from x=-400 to x=2200
function wavePath(y, amp, phase = 0) {
  let d = `M -400,${y}`;
  for (let x = -400; x < 2200; x += 400) {
    const mid = x + 200 + phase;
    d += ` Q ${x + 100},${y - amp} ${x + 200},${y} Q ${x + 300},${y + amp} ${x + 400},${y}`;
  }
  return d;
}

const STARS = [
  [80,40],[200,72],[360,28],[530,65],[680,38],[840,88],[960,22],[1080,58],[1240,32],[1380,72],
  [145,132],[415,108],[660,148],[905,118],[1185,92],[310,52],[755,44],[1055,142],[1325,102],
];

export function FishingBackground({ dark }) {
  return (
    <div
      className="fixed inset-0 pointer-events-none select-none overflow-hidden"
      style={{ zIndex: 0, opacity: dark ? 0.82 : 0.14 }}
      aria-hidden="true"
    >
      <svg
        width="100%" height="100%"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="fb-sky" x1="0" y1="0" x2="0" y2="1">
            {dark ? (
              <>
                <stop offset="0%"   stopColor="#020817" />
                <stop offset="45%"  stopColor="#0d1a2e" />
                <stop offset="100%" stopColor="#0c2840" />
              </>
            ) : (
              <>
                <stop offset="0%"   stopColor="#bae6fd" />
                <stop offset="55%"  stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#22d3ee" />
              </>
            )}
          </linearGradient>
          <linearGradient id="fb-water" x1="0" y1="0" x2="0" y2="1">
            {dark ? (
              <>
                <stop offset="0%"   stopColor="#0a3050" />
                <stop offset="55%"  stopColor="#061e32" />
                <stop offset="100%" stopColor="#030e1a" />
              </>
            ) : (
              <>
                <stop offset="0%"   stopColor="#22d3ee" />
                <stop offset="45%"  stopColor="#0891b2" />
                <stop offset="100%" stopColor="#0e7490" />
              </>
            )}
          </linearGradient>
        </defs>

        {/* ── Sky ── */}
        <rect width="1440" height="900" fill="url(#fb-sky)" />

        {/* Sun / Moon */}
        {dark ? (
          <>
            <circle cx="1090" cy="115" r="54" fill="#dde9f5" opacity="0.92" />
            <circle cx="1090" cy="115" r="72" fill="#c5d8ed" opacity="0.18" />
          </>
        ) : (
          <>
            <circle cx="1210" cy="88" r="66" fill="#fde68a" opacity="0.88" />
            <circle cx="1210" cy="88" r="96" fill="#fef3c7" opacity="0.20" />
          </>
        )}

        {/* Stars (dark only) */}
        {dark && STARS.map(([x, y], i) => (
          <circle
            key={i} cx={x} cy={y} r={i % 4 === 0 ? 2.2 : 1.5}
            fill="white" opacity={0.45 + (i % 5) * 0.11}
            style={{ animation: `twinkle ${2.2 + (i % 5) * 0.4}s ease-in-out infinite`, animationDelay: `${(i * 0.28) % 3}s` }}
          />
        ))}

        {/* Clouds (light only) */}
        {!dark && (
          <>
            <g opacity="0.52" style={{ animation: "cloud-drift 28s ease-in-out infinite" }}>
              <ellipse cx="175" cy="118" rx="88" ry="32" fill="white" />
              <ellipse cx="232" cy="100" rx="62" ry="40" fill="white" />
              <ellipse cx="128" cy="111" rx="50" ry="27" fill="white" />
            </g>
            <g opacity="0.36" style={{ animation: "cloud-drift 40s ease-in-out infinite", animationDelay: "-12s" }}>
              <ellipse cx="690" cy="76" rx="108" ry="30" fill="white" />
              <ellipse cx="758" cy="60" rx="70" ry="42" fill="white" />
              <ellipse cx="630" cy="70" rx="54" ry="24" fill="white" />
            </g>
          </>
        )}

        {/* ── Water ── */}
        <rect x="0" y={WY} width="1440" height={900 - WY} fill="url(#fb-water)" />

        {/* Depth streaks under surface */}
        {[60, 145, 225].map((dy, i) => (
          <ellipse key={i} cx="720" cy={WY + dy} rx={480 - i * 65} ry={7 - i}
            fill={dark ? "#22d3ee" : "#7dd3fc"} opacity={0.08 - i * 0.02} />
        ))}

        {/* Wave line 1 — front */}
        <g style={{ animation: "wave-1 8s linear infinite" }}
          opacity={dark ? 0.55 : 0.65}>
          <path d={wavePath(WY + 8, 13)} fill="none"
            stroke={dark ? "#67e8f9" : "#7dd3fc"} strokeWidth="2.5" />
        </g>

        {/* Wave line 2 — back */}
        <g style={{ animation: "wave-2 13s linear infinite", animationDelay: "-4s" }}
          opacity={dark ? 0.28 : 0.35}>
          <path d={wavePath(WY + 3, 8, 200)} fill="none"
            stroke={dark ? "#a5f3fc" : "#bae6fd"} strokeWidth="1.8" />
        </g>

        {/* ── Underwater caustic beams (dark only) ── */}
        {dark && [300, 710, 1100].map((cx, i) => (
          <ellipse key={i} cx={cx} cy={WY + 140 + i * 20} rx={38 + i * 4} ry={95 + i * 8}
            fill="#22d3ee" opacity="0.05"
            transform={`rotate(${-12 + i * 10}, ${cx}, ${WY + 140})`}
          />
        ))}

        {/* ── Fish 1 — medium, left → right ── */}
        <g style={{ animation: "fish-swim-r 20s linear infinite", animationDelay: "-6s" }}
          opacity={dark ? 0.82 : 0.9}>
          <g transform={`translate(0, ${WY + 68})`}>
            <Fish color={dark ? "#67e8f9" : "#0891b2"} size={1} />
          </g>
        </g>

        {/* Fish 2 — small, right → left (facing left via inner scale) */}
        <g style={{ animation: "fish-swim-l 14s linear infinite", animationDelay: "-9s" }}
          opacity={dark ? 0.72 : 0.8}>
          <g transform={`translate(0, ${WY + 135})`}>
            <g transform="scale(-1, 1)">
              <Fish color={dark ? "#a78bfa" : "#1A8C72"} size={0.62} />
            </g>
          </g>
        </g>

        {/* Fish 3 — tiny, faster, left → right */}
        <g style={{ animation: "fish-swim-r 11s linear infinite", animationDelay: "-2s" }}
          opacity={dark ? 0.62 : 0.7}>
          <g transform={`translate(0, ${WY + 98})`}>
            <Fish color={dark ? "#fbbf24" : "#f97316"} size={0.44} />
          </g>
        </g>
      </svg>
    </div>
  );
}
