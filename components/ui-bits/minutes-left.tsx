import { StatusBadge } from "@/components/ui-bits/status-badge";

function formatMinutes(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
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
        <span className="num">-{Math.abs(minutes)}m</span>
      </StatusBadge>
    );
  }
  if (minutes < 60) {
    return (
      <StatusBadge tone="watch">
        <span className="num">{minutes}m</span>
      </StatusBadge>
    );
  }
  return (
    <span className="num text-text-secondary">{formatMinutes(minutes)}</span>
  );
}
