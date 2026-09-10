/** Intrinsic drawing size. Scales down inside its slot; never overflows it. */
const WIDTH = 76;
const HEIGHT = 26;
const INSET = 4;
const DOT_RADIUS = 2;

/** Draw 1.7s + hold 1.5s — must match `@keyframes spark-draw` / `spark-dot`. */
const CYCLE_SEC = 3.2;

export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  const centerY = HEIGHT / 2;
  const upRoom = centerY - INSET;
  const downRoom = HEIGHT - INSET - centerY;

  // Scale every point relative to how far it deviates from the *last*
  // value, not the series min/max, so the last point always lands exactly
  // at centerY — the height the number beside it sits at — with no
  // after-the-fact clamping that could pull it back off-center.
  const last = values[values.length - 1];
  const deltas = values.map((v) => v - last);
  const maxAbove = Math.max(0, ...deltas);
  const maxBelow = Math.max(0, ...deltas.map((d) => -d));
  const scaleUp = maxAbove > 0 ? upRoom / maxAbove : 0;
  const scaleDown = maxBelow > 0 ? downRoom / maxBelow : 0;
  const ys = deltas.map((d) =>
    d >= 0 ? centerY - d * scaleUp : centerY - d * scaleDown
  );

  // Leave room on the right so the terminal dot doesn't get clipped by the
  // viewBox edge.
  const step = (WIDTH - DOT_RADIUS) / (values.length - 1);
  const coords = values.map((_, i) => ({ x: i * step, y: ys[i] }));
  const d = coords
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const lastX = coords[coords.length - 1].x;

  // Stagger loops slightly so a strip of sparklines doesn't blink in unison.
  const staggerSec =
    (values.reduce((sum, v, i) => sum + v * (i + 1), 0) % 11) * 0.08;

  return (
    // Block slot: width capped at the drawing size, shrinks with the column,
    // clips any stroke so a resize can never paint into the next cell.
    // Animation is CSS (`spark-draw` / `spark-dot`) so overview polling
    // re-renders cannot cancel the loop the way Framer Motion WAAPI did.
    <span
      className="block w-full max-w-[76px] min-w-0 overflow-hidden"
      style={{ height: HEIGHT }}
    >
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        preserveAspectRatio="xMinYMid meet"
        aria-hidden
        className="block max-w-full"
        style={{ overflow: "hidden" }}
      >
        <path
          d={d}
          fill="none"
          stroke="var(--spark-stroke)"
          strokeWidth="var(--spark-width)"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pathLength={1}
          className="spark-draw"
          style={{
            animationDuration: `${CYCLE_SEC}s`,
            animationDelay: `${staggerSec}s`,
          }}
        />
        <circle
          cx={lastX}
          cy={centerY}
          r={DOT_RADIUS}
          fill="var(--spark-dot)"
          className="spark-dot"
          style={{
            animationDuration: `${CYCLE_SEC}s`,
            animationDelay: `${staggerSec}s`,
          }}
        />
      </svg>
    </span>
  );
}
