// Hand-drawn-style line illustrations (single stroke weight, round caps,
// currentColor) — they replace the striped photo placeholders and the
// letter-in-a-square icons, and give the app one consistent drawing voice.

const LINE = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" };

// Strokes draw themselves in when `animate` is on: each path gets a
// pathLength of 1 so one dash setting fits every path regardless of size.
function drawStyle(animate, delay) {
  return animate
    ? { strokeDasharray: 1, strokeDashoffset: 1, animation: `zd-draw 1.4s ${delay}s cubic-bezier(.4,.1,.2,1) forwards` }
    : undefined;
}

// Welcome hero: a greenhouse cross-section with three beds of plants; one
// plant carries a pulsing red marker — the product's whole promise
// (find the sick plant early) in one picture.
export function GreenhouseHero({ animate = true }) {
  const plants = [
    [62, 0], [92, 1], [122, 2], [152, 3], [182, 4], [212, 5], [242, 6], [272, 7],
  ];
  return (
    <svg viewBox="0 0 320 200" width="100%" style={{ display: "block", color: "var(--ink)" }} aria-hidden="true">
      {/* ground */}
      <path d="M8 172H312" {...LINE} strokeWidth="1.2" pathLength="1" style={drawStyle(animate, 0)} />
      {/* arch */}
      <path d="M40 172V96C40 50 96 22 160 22S280 50 280 96V172" {...LINE} strokeWidth="1.6" pathLength="1" style={drawStyle(animate, 0.1)} />
      {/* ribs */}
      {[100, 160, 220].map((x, i) => (
        <path key={x} d={`M${x} ${x === 160 ? 22 : 30}V172`} {...LINE} strokeWidth="0.9" opacity=".35" pathLength="1" style={drawStyle(animate, 0.4 + i * 0.1)} />
      ))}
      <path d="M48 70C80 52 120 44 160 44S240 52 272 70" {...LINE} strokeWidth="0.9" opacity=".35" pathLength="1" style={drawStyle(animate, 0.6)} />
      {/* door */}
      <path d="M146 172V132H174V172" {...LINE} strokeWidth="1.2" opacity=".6" pathLength="1" style={drawStyle(animate, 0.7)} />
      {/* bed */}
      <path d="M52 160H134M186 160H268" {...LINE} strokeWidth="1" opacity=".5" pathLength="1" style={drawStyle(animate, 0.8)} />
      {/* plants */}
      {plants.map(([x, i]) => {
        const sick = i === 5;
        const cx = x > 140 && x < 180 ? null : x;
        if (cx == null) return null;
        return (
          <g key={x} style={{ color: sick ? "var(--bad)" : "var(--accent)" }}>
            <path d={`M${cx} 160V136`} {...LINE} strokeWidth="1.4" pathLength="1" style={drawStyle(animate, 1 + i * 0.07)} />
            <path d={`M${cx} 148C${cx - 9} 147 ${cx - 12} 141 ${cx - 11} 136C${cx - 5} 136 ${cx} 141 ${cx} 148Z`} {...LINE} strokeWidth="1.3" pathLength="1" style={drawStyle(animate, 1.1 + i * 0.07)} />
            <path d={`M${cx} 142C${cx + 9} 141 ${cx + 12} 135 ${cx + 11} 130C${cx + 5} 130 ${cx} 135 ${cx} 142Z`} {...LINE} strokeWidth="1.3" pathLength="1" style={drawStyle(animate, 1.15 + i * 0.07)} />
          </g>
        );
      })}
      {/* detection marker over the sick plant */}
      <g style={{ opacity: animate ? 0 : 1, animation: animate ? "zd-rise .4s 2.1s forwards" : undefined }}>
        <circle cx="212" cy="122" r="4" fill="var(--bad)" style={{ transformOrigin: "212px 122px", animation: "zd-ping 1.8s 2.3s ease-out infinite" }} />
        <circle cx="212" cy="122" r="4" fill="var(--bad)" />
        <path d="M212 118V92H188" {...LINE} stroke="var(--bad)" strokeWidth="1" />
        <text x="184" y="95" textAnchor="end" style={{ font: "500 9px var(--mono)", fill: "var(--bad-ink)", letterSpacing: ".06em" }}>B4 · АУРУ</text>
      </g>
    </svg>
  );
}

export function PottedPlant({ size = 64 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path d="M20 40H44L41 58H23Z" {...LINE} strokeWidth="1.5" />
      <path d="M18 40H46" {...LINE} strokeWidth="1.5" />
      <path d="M32 40V20" {...LINE} strokeWidth="1.5" />
      <path d="M32 30C24 30 19 24 19 16C27 16 32 22 32 30Z" {...LINE} strokeWidth="1.4" />
      <path d="M32 24C40 24 45 18 45 10C37 10 32 16 32 24Z" {...LINE} strokeWidth="1.4" />
    </svg>
  );
}

export function GreenhouseSmall({ size = 64 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path d="M8 56V30C8 17 19 8 32 8S56 17 56 30V56" {...LINE} strokeWidth="1.5" />
      <path d="M4 56H60" {...LINE} strokeWidth="1.5" />
      <path d="M32 8V56M20 11V56M44 11V56" {...LINE} strokeWidth="1" opacity=".4" />
      <path d="M14 48H50" {...LINE} strokeWidth="1" opacity=".55" />
      {[18, 26, 38, 46].map((x) => (
        <path key={x} d={`M${x} 48V42M${x} 44C${x - 3} 44 ${x - 4} 41 ${x - 4} 39M${x} 43C${x + 3} 43 ${x + 4} 40 ${x + 4} 38`} {...LINE} strokeWidth="1.2" />
      ))}
    </svg>
  );
}

// --- Tip illustrations, keyed by the tip's tag --------------------------

function DripIrrigation() {
  return (
    <>
      <path d="M20 30H180" {...LINE} strokeWidth="1.6" />
      {[50, 100, 150].map((x) => (
        <g key={x}>
          <path d={`M${x} 30V36`} {...LINE} strokeWidth="1.4" />
          <path d={`M${x} 44C${x - 3} 49 ${x - 3} 52 ${x} 52S${x + 3} 49 ${x} 44Z`} {...LINE} strokeWidth="1.2" style={{ color: "var(--accent)" }} />
          <path d={`M${x} 92V66`} {...LINE} strokeWidth="1.4" />
          <path d={`M${x} 78C${x - 10} 77 ${x - 13} 70 ${x - 12} 64C${x - 5} 64 ${x} 70 ${x} 78Z`} {...LINE} strokeWidth="1.2" />
          <path d={`M${x} 72C${x + 10} 71 ${x + 13} 64 ${x + 12} 58C${x + 5} 58 ${x} 64 ${x} 72Z`} {...LINE} strokeWidth="1.2" />
          <path d={`M${x - 14} 96C${x - 7} 92 ${x + 7} 92 ${x + 14} 96`} {...LINE} strokeWidth="1" opacity=".5" />
        </g>
      ))}
      <path d="M10 98H190" {...LINE} strokeWidth="1" opacity=".4" />
    </>
  );
}

function VentWindow() {
  return (
    <>
      <path d="M40 100V48C40 30 66 18 100 18S160 30 160 48V100" {...LINE} strokeWidth="1.6" />
      <path d="M70 22L58 46H142L130 22" {...LINE} strokeWidth="1.3" />
      <path d="M58 46L66 34H134L142 46" {...LINE} strokeWidth="1" opacity=".5" />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${76 + i * 18} 14C${80 + i * 18} 8 ${76 + i * 18} 4 ${80 + i * 18} -2`} {...LINE} strokeWidth="1.2" style={{ color: "var(--accent)" }} transform="translate(0 6)" />
      ))}
      <g transform="translate(168 50)">
        <path d="M0 0V34" {...LINE} strokeWidth="5" opacity=".15" />
        <path d="M0 0V34" {...LINE} strokeWidth="1.3" />
        <circle cx="0" cy="40" r="5" {...LINE} strokeWidth="1.3" />
        <path d="M0 14V40" {...LINE} strokeWidth="2.4" style={{ color: "var(--accent)" }} />
        <path d="M5 8H9M5 16H9M5 24H9" {...LINE} strokeWidth="1" opacity=".5" />
      </g>
      <path d="M20 100H186" {...LINE} strokeWidth="1" opacity=".4" />
    </>
  );
}

function Pruning() {
  return (
    <>
      <path d="M90 102V20" {...LINE} strokeWidth="1.6" />
      <path d="M90 70C76 66 70 56 72 46C84 48 90 58 90 70Z" {...LINE} strokeWidth="1.3" />
      <path d="M90 50C104 46 110 36 108 26C96 28 90 38 90 50Z" {...LINE} strokeWidth="1.3" />
      <path d="M90 62L110 56" {...LINE} strokeWidth="1.3" strokeDasharray="3 3" style={{ color: "var(--bad)" }} />
      <path d="M110 56L116 50M113 58L118 54" {...LINE} strokeWidth="1.3" style={{ color: "var(--bad)" }} />
      {[[78, 84], [102, 80]].map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="7" {...LINE} strokeWidth="1.3" style={{ color: "var(--bad)" }} />
      ))}
      <g transform="translate(136 62) rotate(-30)">
        <circle cx="0" cy="18" r="5" {...LINE} strokeWidth="1.3" />
        <circle cx="12" cy="18" r="5" {...LINE} strokeWidth="1.3" />
        <path d="M3 14L14 -10M9 14L-2 -10" {...LINE} strokeWidth="1.3" />
      </g>
      <path d="M40 104H160" {...LINE} strokeWidth="1" opacity=".4" />
    </>
  );
}

function LeafNutrient() {
  return (
    <>
      <path d="M50 96C50 52 82 22 142 18C146 70 118 100 70 100" {...LINE} strokeWidth="1.6" />
      <path d="M44 104C70 76 96 52 130 30" {...LINE} strokeWidth="1.3" />
      {[[70, 78, 58, 66], [86, 64, 80, 48], [102, 50, 100, 34], [84, 66, 100, 76], [100, 52, 118, 58]].map(([x1, y1, x2, y2], i) => (
        <path key={i} d={`M${x1} ${y1}L${x2} ${y2}`} {...LINE} strokeWidth="1" opacity=".5" />
      ))}
      <path d="M128 22C140 30 142 48 138 62" {...LINE} strokeWidth="2.6" opacity=".7" style={{ color: "var(--warn)" }} />
      <g transform="translate(160 66)" style={{ color: "var(--accent)" }}>
        <rect x="-14" y="-14" width="28" height="28" rx="4" {...LINE} strokeWidth="1.3" />
        <text x="0" y="5" textAnchor="middle" style={{ font: "600 13px var(--mono)", fill: "currentColor" }}>K</text>
      </g>
    </>
  );
}

function Seedling() {
  return (
    <>
      <path d="M30 96H170" {...LINE} strokeWidth="1.2" opacity=".5" />
      {[60, 100, 140].map((x, i) => (
        <g key={x} transform={`translate(${x} 96) scale(${0.7 + i * 0.25})`}>
          <path d="M0 0V-30" {...LINE} strokeWidth="1.5" />
          <path d="M0 -16C-12 -16 -18 -24 -18 -34C-6 -34 0 -26 0 -16Z" {...LINE} strokeWidth="1.3" />
          <path d="M0 -22C12 -22 18 -30 18 -40C6 -40 0 -32 0 -22Z" {...LINE} strokeWidth="1.3" />
        </g>
      ))}
    </>
  );
}

const TIP_ART = {
  "Алдын алу": DripIrrigation,
  "Микроклимат": VentWindow,
  "Өнім": Pruning,
  "Қоректену": LeafNutrient,
};

export function TipArt({ tag }) {
  const Art = TIP_ART[tag] || Seedling;
  return (
    <svg viewBox="0 0 200 110" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ color: "var(--ink)", display: "block" }} aria-hidden="true">
      <Art />
    </svg>
  );
}
