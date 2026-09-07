/** Shared display formatters — one implementation for currency and duration. */

/** USD fee for quoted amounts (always shows $). */
export function formatFeeDollars(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

/**
 * Fee cell for a matter: unquoted (fee ≤ 0) shows copy, not $0.
 */
export function formatMatterFee(n: number): string {
  if (n <= 0) return "Not quoted";
  return formatFeeDollars(n);
}

/** Elapsed / average duration: "47m", "2h", or "2h 47m". */
export function formatDuration(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Relative time for notifications: "just now", "2m ago", "3h ago", "Yesterday". */
export function formatRelativeTime(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, now.getTime() - then);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
