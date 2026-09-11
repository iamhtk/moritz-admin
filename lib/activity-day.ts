/** Shared rolling 24-hour window for Pulse counts and feed lists. */

export const ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function activityWindowStart(now = new Date()) {
  return new Date(now.getTime() - ACTIVITY_WINDOW_MS);
}

export function isActivityInWindow(iso: string, now = new Date()) {
  return new Date(iso).getTime() >= activityWindowStart(now).getTime();
}

export function filterActivityRecent<T extends { at: string }>(
  items: T[],
  now = new Date()
) {
  const start = activityWindowStart(now).getTime();
  return items.filter((a) => new Date(a.at).getTime() >= start);
}

/** Chip counts for the same rolling window as the feed. */
export function countActivityRecent<T extends { at: string; verb: string }>(
  items: T[],
  now = new Date()
): Record<string, number> {
  const recent = filterActivityRecent(items, now);
  const counts: Record<string, number> = { all: recent.length };
  for (const a of recent) {
    counts[a.verb] = (counts[a.verb] ?? 0) + 1;
  }
  return counts;
}
