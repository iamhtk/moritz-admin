"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "moritz.notificationReadIds";

/**
 * Client-only read/unread for the notification center.
 * Scoped to this browser — not multi-user / server-backed.
 */
function readStoredIds(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is number => typeof id === "number")
    );
  } catch {
    return new Set();
  }
}

function writeStoredIds(ids: Set<number>) {
  if (typeof window === "undefined") return;
  try {
    // Cap growth so localStorage stays bounded as the feed refreshes.
    const trimmed = [...ids].slice(-200);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function useNotificationReads() {
  const [readIds, setReadIds] = useState<Set<number>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setReadIds(readStoredIds());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Set<number>) => {
    setReadIds(next);
    writeStoredIds(next);
  }, []);

  const isUnread = useCallback(
    (id: number) => (hydrated ? !readIds.has(id) : false),
    [hydrated, readIds]
  );

  const markRead = useCallback(
    (id: number) => {
      if (readIds.has(id)) return;
      const next = new Set(readIds);
      next.add(id);
      persist(next);
    },
    [persist, readIds]
  );

  const markAllRead = useCallback(
    (ids: number[]) => {
      const next = new Set(readIds);
      for (const id of ids) next.add(id);
      persist(next);
    },
    [persist, readIds]
  );

  const unreadCount = useCallback(
    (ids: number[]) => {
      if (!hydrated) return 0;
      return ids.reduce((n, id) => n + (readIds.has(id) ? 0 : 1), 0);
    },
    [hydrated, readIds]
  );

  return useMemo(
    () => ({
      hydrated,
      isUnread,
      markRead,
      markAllRead,
      unreadCount,
    }),
    [hydrated, isUnread, markAllRead, markRead, unreadCount]
  );
}
