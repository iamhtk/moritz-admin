/** Shared today filter for Pulse counts and feed lists. */
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
