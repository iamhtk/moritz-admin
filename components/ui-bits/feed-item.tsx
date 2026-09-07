"use client";

import Link from "next/link";
import { LawyerAvatar } from "@/components/ui-bits/lawyer-avatar";
import {
  activityDotColor,
  activitySentencePlain,
  buildActivitySentence,
  isLawyerActor,
  matterHref,
} from "@/lib/activity-copy";
import type { ActivityItem } from "@/lib/supabase";
import { cn } from "cn";

function formatClock(iso: string) {
  const d = new Date(iso);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function FeedItem({ item }: { item: ActivityItem }) {
  const plain = activitySentencePlain(item);
  const lawyerId = isLawyerActor(item.actor_id) ? item.actor_id : null;
  const href = matterHref(item.reference);

  const body = (
    <>
      {lawyerId && item.actorName ? (
        <LawyerAvatar
          lawyerId={lawyerId}
          name={item.actorName}
          initials={item.actorInitials}
          size="sm"
          className="mt-0.5 rounded-[7px] after:rounded-[7px]"
        />
      ) : (
        <span
          className={cn(
            "mt-2 size-1.5 shrink-0 rounded-full",
            item.verb === "escalated" && "pulse-dot"
          )}
          style={{ background: activityDotColor(item.verb) }}
          aria-hidden
        />
      )}
      <p
        className="min-w-0 text-foreground line-clamp-2"
        style={{ fontSize: "var(--text-12)", lineHeight: 1.45 }}
      >
        {/* Parent Link owns navigation — refs render as plain text to avoid nested <a>. */}
        {buildActivitySentence(item, { linkMatterRefs: false })}
      </p>
      <time
        dateTime={item.at}
        className="num whitespace-nowrap text-text-tertiary"
        style={{ fontSize: "var(--text-11)" }}
      >
        {formatClock(item.at)}
      </time>
    </>
  );

  const className =
    "grid w-full grid-cols-[auto_1fr_auto] items-start gap-2 rounded-md py-2 text-left transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

  if (href) {
    return (
      <li>
        <Link href={href} className={className} aria-label={plain}>
          {body}
        </Link>
      </li>
    );
  }

  return (
    <li
      className={className}
      role="listitem"
      aria-label={plain}
    >
      {body}
    </li>
  );
}
