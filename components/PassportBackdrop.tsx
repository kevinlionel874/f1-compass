/**
 * Passport-style background: guilloche wave bands and a rosette like the
 * security printing on a passport page, plus a faint visa stamp.
 *
 * A Server Component on purpose: the curves come from floating-point math,
 * and rendering them only on the server means the browser never recomputes
 * them, so tiny engine differences can't cause hydration mismatches.
 */

const TAU = Math.PI * 2;

/** Stacked sine waves whose phases drift line by line, which produces the moiré weave. */
function wavePaths(): string[] {
  const lines: string[] = [];
  for (let i = 0; i < 26; i++) {
    let d = "";
    for (let x = 0; x <= 1600; x += 16) {
      const y =
        40 +
        i * 22 +
        26 * Math.sin((x / 520) * TAU + i * 0.38) +
        9 * Math.sin((x / 170) * TAU - i * 0.21);
      d += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(1)}`;
    }
    lines.push(d);
  }
  return lines;
}

/** A ring of closed curves r(θ) = R + A·sin(kθ + phase), each rotated a little: a guilloche rosette. */
function ringPaths(radius: number, amplitude: number, lobes: number, count: number): string[] {
  const paths: string[] = [];
  for (let i = 0; i < count; i++) {
    const phase = (TAU * i) / count;
    let d = "";
    for (let s = 0; s <= 160; s++) {
      const t = (TAU * s) / 160;
      const r = radius + amplitude * Math.sin(lobes * t + phase);
      d += `${s === 0 ? "M" : "L"}${Math.round(r * Math.cos(t))} ${Math.round(r * Math.sin(t))}`;
    }
    paths.push(d + "Z");
  }
  return paths;
}

const WAVES = wavePaths();
const ROSETTE = [
  ...ringPaths(232, 20, 14, 12),
  ...ringPaths(150, 16, 10, 10),
  ...ringPaths(72, 10, 7, 8),
];

export default function PassportBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[780px] overflow-hidden">
      <div className="absolute top-[-280px] left-1/2 h-[560px] w-[min(1000px,150vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)]" />

      <svg
        viewBox="0 0 1600 620"
        preserveAspectRatio="xMidYMin slice"
        className="absolute inset-0 h-full w-full text-(--ink) opacity-[0.13] transition-colors duration-700 [mask-image:linear-gradient(to_bottom,black_35%,transparent_95%)] dark:opacity-[0.17]"
        fill="none"
        stroke="currentColor"
      >
        {WAVES.map((d, i) => (
          <path key={i} d={d} strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>

      <svg
        viewBox="-260 -260 520 520"
        className="absolute -top-44 -right-56 size-[620px] text-(--ink) opacity-[0.2] transition-colors duration-700 sm:-top-36 sm:-right-32 dark:opacity-[0.26]"
        fill="none"
        stroke="currentColor"
      >
        {ROSETTE.map((d, i) => (
          <path key={i} d={d} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        ))}
        <circle r="252" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <circle r="246" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      </svg>

      <VisaStamp className="visa-stamp absolute top-[92px] -right-16 size-[150px] -rotate-12 text-(--ink) opacity-[0.22] transition-[color,opacity] duration-700 sm:top-[150px] sm:right-auto sm:left-[calc(50%+150px)] sm:size-[230px] dark:opacity-[0.3]" />
    </div>
  );
}

function VisaStamp({ className }: { className?: string }) {
  return (
    <svg viewBox="-130 -130 260 260" className={className} fill="none" stroke="currentColor">
      <defs>
        <path id="visa-stamp-ring" d="M -89 0 A 89 89 0 1 1 89 0 A 89 89 0 1 1 -89 0" />
      </defs>
      <circle r="122" strokeWidth="4" />
      <circle r="112" strokeWidth="1.5" />
      <circle r="70" strokeWidth="1.5" />
      <text
        fill="currentColor"
        stroke="none"
        fontSize="15"
        fontWeight="800"
        letterSpacing="2.6"
      >
        <textPath href="#visa-stamp-ring" startOffset="0">
          UNITED STATES OF AMERICA ★ F-1 STUDENT ★
        </textPath>
      </text>
      <text
        y="12"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontSize="44"
        fontWeight="900"
        letterSpacing="1"
      >
        F-1
      </text>
      <path d="M -46 24 H 46" strokeWidth="1.5" />
      <text
        y="42"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontSize="12"
        fontWeight="800"
        letterSpacing="1.8"
      >
        AUTHORIZED?
      </text>
      <path d="M -46 -34 H 46" strokeWidth="1.5" />
    </svg>
  );
}
