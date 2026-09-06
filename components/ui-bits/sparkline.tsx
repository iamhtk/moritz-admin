export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  const width = 76;
  const height = 26;
  const inset = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - inset - ((v - min) / range) * (height - inset * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className="shrink-0"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--spark-stroke)"
        strokeWidth="var(--spark-width)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
