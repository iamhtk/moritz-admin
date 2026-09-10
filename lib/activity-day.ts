/** Shared today filter for Pulse counts and feed lists (viewer's local day). */

export function startOfToday(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isActivityToday(iso: string, now = new Date()) {
  return new Date(iso) >= startOfToday(now);
}

export function filterActivityToday<T extends { at: string }>(
  items: T[],
  now = new Date()
) {
  const start = startOfToday(now);
  return items.filter((a) => new Date(a.at) >= start);
}

/** Chip counts for the viewer's local calendar day. */
export function countActivityToday<T extends { at: string; verb: string }>(
  items: T[],
  now = new Date()
): Record<string, number> {
  const today = filterActivityToday(items, now);
  const counts: Record<string, number> = { all: today.length };
  for (const a of today) {
    counts[a.verb] = (counts[a.verb] ?? 0) + 1;
  }
  return counts;
}
