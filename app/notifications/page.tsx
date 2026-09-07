"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AutoHideScroll } from "@/components/auto-hide-scroll";
import { NotificationRow } from "@/components/notification-center";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ZoneLabel } from "@/components/ui-bits/zone-label";
import { useNotificationReads } from "@/hooks/use-notification-reads";
import { useOverview } from "@/hooks/use-overview";
import { groupActivityByDay } from "@/lib/activity-copy";

const PAGE_SIZE = 12;
const VISIBLE_COUNT_KEY = "moritz-notifications-visible-count";

function readVisibleCount(): number {
  if (typeof window === "undefined") return PAGE_SIZE;
  try {
    const raw = window.sessionStorage.getItem(VISIBLE_COUNT_KEY);
    const n = raw ? Number(raw) : PAGE_SIZE;
    return Number.isFinite(n) && n >= PAGE_SIZE ? n : PAGE_SIZE;
  } catch {
    return PAGE_SIZE;
  }
}

function writeVisibleCount(n: number) {
  try {
    window.sessionStorage.setItem(VISIBLE_COUNT_KEY, String(n));
  } catch {
    /* ignore */
  }
}

function NotificationsSkeleton() {
  return (
    <Card className="gap-0 rounded-lg p-4 [--card-spacing:0px]">
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-2.5">
            <Skeleton className="mt-1.5 size-1.5 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function NotificationsBody() {
  const { data, isPending, error, refetch, isFetching } = useOverview();
  const activity = data?.activity ?? [];
  const { isUnread, markRead, markAllRead, unreadCount } =
    useNotificationReads();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setVisibleCount(readVisibleCount());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeVisibleCount(visibleCount);
  }, [visibleCount, hydrated]);

  const visible = useMemo(
    () => activity.slice(0, visibleCount),
    [activity, visibleCount]
  );
  const groups = useMemo(() => groupActivityByDay(visible), [visible]);
  const canLoadMore = visibleCount < activity.length;
  const count = unreadCount(activity.map((a) => a.id));

  if (isPending) return <NotificationsSkeleton />;

  if (error) {
    return (
      <Card className="gap-2 rounded-lg p-4 [--card-spacing:0px]">
        <p className="text-text-secondary" style={{ fontSize: "var(--text-13)" }}>
          Couldn&apos;t load notifications.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          Retry
        </Button>
      </Card>
    );
  }

  if (activity.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 rounded-lg px-6 py-16 text-center [--card-spacing:0px]">
        <Bell
          className="size-9 text-text-tertiary"
          strokeWidth={1.5}
          aria-hidden
        />
        <p
          className="font-semibold text-foreground"
          style={{ fontSize: "var(--text-16, 1rem)" }}
        >
          You&apos;re all caught up
        </p>
        <p
          className="max-w-sm text-text-secondary"
          style={{ fontSize: "var(--text-13)" }}
        >
          Firm activity from the Pulse feed will appear here as notifications.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-text-secondary" style={{ fontSize: "var(--text-12)" }}>
          Same activity stream as Pulse ·{" "}
          {count > 0 ? (
            <span className="font-medium text-foreground">
              {count} unread
            </span>
          ) : (
            "all read"
          )}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={count === 0}
          onClick={() => markAllRead(activity.map((a) => a.id))}
        >
          Mark all read
        </Button>
      </div>

      <Card className="gap-0 overflow-hidden rounded-lg py-1 [--card-spacing:0px]">
        {groups.map((group) => (
          <section key={group.key} className="border-b border-border last:border-b-0">
            <h3
              className="px-3 pt-3 pb-1 font-medium text-text-tertiary"
              style={{ fontSize: "var(--text-11)" }}
            >
              {group.label}
            </h3>
            <ul>
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className="border-t border-border/60 first:border-t-0"
                >
                  <NotificationRow
                    item={item}
                    unread={isUnread(item.id)}
                    onActivate={() => markRead(item.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Card>

      {canLoadMore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <AppShell>
      <AutoHideScroll className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-5 sm:px-6 lg:px-8">
          <ZoneLabel
            title="Notifications"
            meta="Recent firm activity"
          />
          <NotificationsBody />
        </div>
      </AutoHideScroll>
    </AppShell>
  );
}
