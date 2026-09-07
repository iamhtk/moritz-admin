"use client";

import { StatusBadge } from "@/components/ui-bits/status-badge";
import { formatDuration } from "@/lib/format";

/** Circular ring drain from full (240 min left) to empty (0 or past due). */
function SlaRing({
  minutes,
  fillColor,
}: {
  minutes: number;
  fillColor: string;
}) {
  const r = 4.5;
  const circumference = 2 * Math.PI * r;
  const progress = Math.max(0, Math.min(1, minutes / 240));
  const dashoffset = circumference * (1 - progress);

  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
      className="shrink-0"
      style={{ transform: "rotate(-90deg)" }}
    >
      {/* track */}
      <circle
        cx="6"
        cy="6"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.18}
        strokeWidth={1.5}
      />
      {/* drain */}
      <circle
        cx="6"
        cy="6"
        r={r}
        fill="none"
        stroke={fillColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashoffset}
        style={{
          transition: "stroke-dashoffset var(--motion-duration-deliberate) var(--motion-ease-out)",
        }}
      />
      {/* center dot */}
      <circle cx="6" cy="6" r={2.5} fill={fillColor} />
    </svg>
  );
}

/** Clock signal: risk under zero, watch under an hour, plain text above.
 *  Past due and watch both render as StatusBadge so the Left column stays
 *  a single aligned pill stack instead of mixing naked text with badges. */
export function MinutesLeft({
  minutes,
  delivered = false,
}: {
  minutes: number;
  delivered?: boolean;
}) {
  if (delivered) {
    return <span className="num text-text-tertiary">-</span>;
  }
  if (minutes < 0) {
    return (
      <StatusBadge tone="risk">
        <SlaRing minutes={0} fillColor="var(--status-risk-fill)" />
        <span className="num">-{formatDuration(Math.abs(minutes))}</span>
      </StatusBadge>
    );
  }
  if (minutes < 60) {
    return (
      <StatusBadge tone="watch">
        <SlaRing minutes={minutes} fillColor="var(--status-watch-fill)" />
        <span className="num">{formatDuration(minutes)}</span>
      </StatusBadge>
    );
  }
  return (
    <span className="num text-text-secondary flex items-center gap-1">
      <SlaRing minutes={minutes} fillColor="var(--sla-ok-fg,var(--text-secondary))" />
      {formatDuration(minutes)}
    </span>
  );
}
