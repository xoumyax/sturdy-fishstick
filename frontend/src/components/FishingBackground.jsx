const WY = 522; // water Y in SVG units (viewBox 1440×900, water at 58%)

// Per-mode palettes: My Careers = tropical teal sea, PhD = indigo deep sea.
const THEMES = {
  careers: {
    sky: { dark: ["#020817", "#0d1a2e", "#0c2840"], light: ["#bae6fd", "#38bdf8", "#22d3ee"] },
    water: { dark: ["#0a3050", "#061e32", "#030e1a"], light: ["#22d3ee", "#0891b2", "#0e7490"] },
    wave1: { dark: "#67e8f9", light: "#7dd3fc" },
    wave2: { dark: "#a5f3fc", light: "#bae6fd" },
    glow: "#22d3ee",
    fish: { dark: ["#67e8f9", "#a78bfa", "#fbbf24", "#f472b6"], light: ["#0891b2", "#1A8C72", "#f97316", "#db2777"] },
    kelp: { dark: "#0e7490", light: "#0f766e" },
  },
  phd: {
    sky: { dark: ["#0a0618", "#171130", "#1e1b4b"], light: ["#e0e7ff", "#a5b4fc", "#818cf8"] },
    water: { dark: ["#251d54", "#181242", "#0a0722"], light: ["#818cf8", "#6366f1", "#4338ca"] },
    wave1: { dark: "#a5b4fc", light: "#c7d2fe" },
    wave2: { dark: "#c7d2fe", light: "#e0e7ff" },
    glow: "#818cf8",
    fish: { dark: ["#a5b4fc", "#f0abfc", "#67e8f9", "#fbbf24"], light: ["#4f46e5", "#a21caf", "#0891b2", "#d97706"] },
    kelp: { dark: "#4338ca", light: "#4f46e5" },
  },
};

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

function Jellyfish({ color, size = 1 }) {
  return (
    <g transform={`scale(${size})`} opacity="0.7">
      <path d="M -18,0 Q -18,-24 0,-24 Q 18,-24 18,0 Q 10,4 0,3 Q -10,4 -18,0 Z" fill={color} opacity="0.75" />
      <ellipse cx="-5" cy="-14" rx="5" ry="7" fill="white" opacity="0.18" />
      {[-12, -5, 2, 9].map((x, i) => (
        <path key={i} d={`M ${x},2 q 3,10 -2,20 q -3,8 2,16`} fill="none"
          stroke={color} strokeWidth="1.6" opacity="0.55" strokeLinecap="round" />
      ))}
    </g>
  );
}

function Kelp({ x, h, color, dur, delay }) {
  return (
    <g style={{ animation: `kelp-sway ${dur}s ease-in-out infinite`, animationDelay: delay, transformOrigin: `${x}px 900px` }}>
      <path
        d={`M ${x},900 C ${x - 14},${900 - h * 0.35} ${x + 16},${900 - h * 0.6} ${x - 6},${900 - h}`}
        fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" opacity="0.4"
      />
      <path
        d={`M ${x + 14},900 C ${x + 2},${900 - h * 0.3} ${x + 26},${900 - h * 0.55} ${x + 10},${900 - h * 0.82}`}
        fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" opacity="0.28"
      />
    </g>
  );
}

// Wave path: repeating Q curve every 400px, from x=-400 to x=2200
function wavePath(y, amp, phase = 0) {
  let d = `M -400,${y}`;
  for (let x = -400; x < 2200; x += 400) {
    d += ` Q ${x + 100},${y - amp} ${x + 200},${y} Q ${x + 300},${y + amp} ${x + 400},${y}`;
  }
  return d;
}

const STARS = [
  [80,40],[200,72],[360,28],[530,65],[680,38],[840,88],[960,22],[1080,58],[1240,32],[1380,72],
  [145,132],[415,108],[660,148],[905,118],[1185,92],[310,52],[755,44],[1055,142],[1325,102],
];

const BUBBLES = [
  { x: 240, r: 4, dur: 9, delay: "0s" },
  { x: 555, r: 2.5, dur: 12, delay: "-4s" },
  { x: 830, r: 5, dur: 10, delay: "-7s" },
  { x: 1010, r: 3, dur: 13, delay: "-2s" },
  { x: 1290, r: 4.5, dur: 11, delay: "-9s" },
  { x: 420, r: 2, dur: 14, delay: "-11s" },
];

function Scene({ theme, dark, isPhd }) {
  const t = theme;
  const mode = dark ? "dark" : "light";
  const gid = isPhd ? "phd" : "car";
  const sky = t.sky[mode];
  const water = t.water[mode];
  const fishColors = t.fish[mode];

  return (
    <>
      <defs>
        <linearGradient id={`fb-sky-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky[0]} />
          <stop offset="45%" stopColor={sky[1]} />
          <stop offset="100%" stopColor={sky[2]} />
        </linearGradient>
        <linearGradient id={`fb-water-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={water[0]} />
          <stop offset="55%" stopColor={water[1]} />
          <stop offset="100%" stopColor={water[2]} />
        </linearGradient>
      </defs>

      {/* ── Sky ── */}
      <rect width="1440" height="900" fill={`url(#fb-sky-${gid})`} />

      {/* Sun / Moon */}
      {dark ? (
        <>
          <circle cx="1090" cy="115" r="54" fill={isPhd ? "#e2e0f7" : "#dde9f5"} opacity="0.92" />
          <circle cx="1090" cy="115" r="72" fill={isPhd ? "#cfcaee" : "#c5d8ed"} opacity="0.18" />
        </>
      ) : (
        <>
          <circle cx="1210" cy="88" r="66" fill="#fde68a" opacity="0.88" />
          <circle cx="1210" cy="88" r="96" fill="#fef3c7" opacity="0.20" />
        </>
      )}

      {/* Stars (dark only — denser in PhD "deep space" mode) */}
      {dark && STARS.map(([x, y], i) => (
        <circle
          key={i} cx={x} cy={y} r={i % 4 === 0 ? 2.2 : 1.5}
          fill="white" opacity={(isPhd ? 0.6 : 0.45) + (i % 5) * 0.09}
          style={{ animation: `twinkle ${2.2 + (i % 5) * 0.4}s ease-in-out infinite`, animationDelay: `${(i * 0.28) % 3}s` }}
        />
      ))}
      {dark && isPhd && STARS.slice(0, 10).map(([x, y], i) => (
        <circle key={`p${i}`} cx={1440 - x} cy={y + 40} r="1.1" fill="#c7d2fe" opacity="0.5"
          style={{ animation: `twinkle ${3 + (i % 3) * 0.5}s ease-in-out infinite`, animationDelay: `${(i * 0.4) % 2}s` }} />
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
      <rect x="0" y={WY} width="1440" height={900 - WY} fill={`url(#fb-water-${gid})`} />

      {/* Depth streaks under surface */}
      {[60, 145, 225].map((dy, i) => (
        <ellipse key={i} cx="720" cy={WY + dy} rx={480 - i * 65} ry={7 - i}
          fill={t.glow} opacity={0.08 - i * 0.02} />
      ))}

      {/* Wave layers — front, mid, back (parallax speeds) */}
      <g style={{ animation: "wave-1 8s linear infinite" }} opacity={dark ? 0.55 : 0.65}>
        <path d={wavePath(WY + 8, 13)} fill="none" stroke={t.wave1[mode]} strokeWidth="2.5" />
      </g>
      <g style={{ animation: "wave-2 13s linear infinite", animationDelay: "-4s" }} opacity={dark ? 0.28 : 0.35}>
        <path d={wavePath(WY + 3, 8, 200)} fill="none" stroke={t.wave2[mode]} strokeWidth="1.8" />
      </g>
      <g style={{ animation: "wave-2 21s linear infinite", animationDelay: "-9s" }} opacity={dark ? 0.16 : 0.2}>
        <path d={wavePath(WY - 1, 5, 320)} fill="none" stroke={t.wave2[mode]} strokeWidth="1.2" />
      </g>

      {/* Underwater caustic beams (dark only) */}
      {dark && [300, 710, 1100].map((cx, i) => (
        <ellipse key={i} cx={cx} cy={WY + 140 + i * 20} rx={38 + i * 4} ry={95 + i * 8}
          fill={t.glow} opacity="0.05"
          transform={`rotate(${-12 + i * 10}, ${cx}, ${WY + 140})`}
        />
      ))}

      {/* Kelp bed */}
      <Kelp x={110} h={190} color={t.kelp[mode]} dur={7} delay="0s" />
      <Kelp x={1290} h={230} color={t.kelp[mode]} dur={9} delay="-3s" />
      <Kelp x={1370} h={150} color={t.kelp[mode]} dur={6} delay="-1.5s" />

      {/* Bubbles rising */}
      {BUBBLES.map((b, i) => (
        <circle key={i} cx={b.x} cy={880} r={b.r}
          fill="white" opacity="0"
          style={{ animation: `bubble-rise ${b.dur}s linear infinite`, animationDelay: b.delay }} />
      ))}

      {/* ── Swimmers ── */}
      <g style={{ animation: "fish-swim-r 20s linear infinite", animationDelay: "-6s" }} opacity={dark ? 0.82 : 0.9}>
        <g transform={`translate(0, ${WY + 68})`}>
          <Fish color={fishColors[0]} size={1} />
        </g>
      </g>
      <g style={{ animation: "fish-swim-l 14s linear infinite", animationDelay: "-9s" }} opacity={dark ? 0.72 : 0.8}>
        <g transform={`translate(0, ${WY + 135})`}>
          <g transform="scale(-1, 1)">
            <Fish color={fishColors[1]} size={0.62} />
          </g>
        </g>
      </g>
      <g style={{ animation: "fish-swim-r 11s linear infinite", animationDelay: "-2s" }} opacity={dark ? 0.62 : 0.7}>
        <g transform={`translate(0, ${WY + 98})`}>
          <Fish color={fishColors[2]} size={0.44} />
        </g>
      </g>
      {/* Tiny school — three fish in loose formation */}
      <g style={{ animation: "fish-swim-r 26s linear infinite", animationDelay: "-15s" }} opacity={dark ? 0.5 : 0.6}>
        <g transform={`translate(0, ${WY + 205})`}>
          <Fish color={fishColors[3]} size={0.3} />
          <g transform="translate(-42, 16)"><Fish color={fishColors[3]} size={0.26} /></g>
          <g transform="translate(-30, -18)"><Fish color={fishColors[3]} size={0.24} /></g>
        </g>
      </g>

      {/* Jellyfish — PhD's deep-sea resident (careers gets one too, fainter) */}
      <g style={{ animation: "jelly-drift 24s ease-in-out infinite", animationDelay: "-5s" }}
        opacity={isPhd ? 0.85 : 0.4}>
        <g transform={`translate(1150, ${WY + 240})`}>
          <Jellyfish color={dark ? (isPhd ? "#c4b5fd" : "#a5f3fc") : (isPhd ? "#6366f1" : "#22d3ee")} size={isPhd ? 1 : 0.7} />
        </g>
      </g>
    </>
  );
}

export function FishingBackground({ dark, mode = "careers" }) {
  const isPhd = mode === "phd";
  const theme = THEMES[isPhd ? "phd" : "careers"];

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none overflow-hidden fb-anim"
      style={{ zIndex: 0, opacity: dark ? 0.82 : 0.5, transition: "opacity 0.6s ease" }}
      aria-hidden="true"
    >
      <svg
        width="100%" height="100%"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transition: "opacity 0.6s ease" }}
        key={`${mode}-${dark}`}
      >
        <Scene theme={theme} dark={dark} isPhd={isPhd} />
      </svg>
    </div>
  );
}
