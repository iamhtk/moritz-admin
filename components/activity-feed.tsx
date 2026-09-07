"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FeedItem } from "@/components/ui-bits/feed-item";
import { groupActivityByDay } from "@/lib/activity-copy";
import { filterActivityToday } from "@/lib/activity-day";
import type { ActivityItem } from "@/lib/supabase";

const PREVIEW = 8;

export function ActivityFeed({
  activity,
  filter,
}: {
  activity: ActivityItem[];
  filter: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [filterForExpanded, setFilterForExpanded] = useState(filter);
  if (filter !== filterForExpanded) {
    setFilterForExpanded(filter);
    setExpanded(false);
  }

  const todayActivity = useMemo(
    () => filterActivityToday(activity),
    [activity]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return todayActivity;
    return todayActivity.filter((a) => a.verb === filter);
  }, [todayActivity, filter]);

  const visible = expanded ? filtered : filtered.slice(0, PREVIEW);
  const groups = groupActivityByDay(visible);
  const canToggle = filtered.length > PREVIEW;

  if (filtered.length === 0) {
    return (
      <p
        className="py-6 text-center text-text-secondary"
        style={{ fontSize: "var(--text-12)" }}
      >
        Nothing here today.
      </p>
    );
  }

  return (
    <div>
      {groups.map((group) => (
        <div key={group.key}>
          <div
            className="font-medium text-text-tertiary"
            style={{
              fontSize: "var(--text-11)",
              marginTop: "8px",
              marginBottom: "4px",
            }}
          >
            {group.label}
          </div>
          <ul>
            {group.items.map((item) => (
              <FeedItem key={item.id} item={item} />
            ))}
          </ul>
        </div>
      ))}
      {canToggle ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      ) : null}
    </div>
  );
}

export function ActivityFeedSkeleton() {
  return (
    <div className="mt-2 space-y-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[auto_1fr_auto] items-start gap-2 py-2"
        >
          <Skeleton className="mt-2 size-1.5 rounded-full" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}
