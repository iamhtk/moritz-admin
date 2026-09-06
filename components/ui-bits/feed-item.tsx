"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ActivityItem } from "@/lib/supabase";

function shortName(name: string | null): string {
  if (!name) return "Someone";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function Bold({ children }: { children: React.ReactNode }) {
  return <b className="font-medium">{children}</b>;
}

function buildSentence(item: ActivityItem): React.ReactNode {
  const note = item.note ?? "";
  const actor = shortName(item.actorName);
  const client = item.clientName ?? "a client";
  const reference = item.reference ?? "a matter";

  switch (item.verb) {
    case "escalated":
      return (
        <>
          <Bold>{reference}</Bold> escalated, {note}
        </>
      );
    case "delivered":
      return (
        <>
          <Bold>{actor}</Bold> delivered {note}
        </>
      );
    case "submitted":
      return (
        <>
          <Bold>{client}</Bold> submitted {note}
        </>
      );
    case "assigned":
      return (
        <>
          <Bold>{actor}</Bold> assigned to {reference}
        </>
      );
    case "quoted":
      return (
        <>
          <Bold>{actor}</Bold> quoted {reference} at {note}
        </>
      );
    case "drafted":
      return (
        <>
          <Bold>Moritz</Bold> drafted {note}
        </>
      );
    case "filed":
      return (
        <>
          {note} filed for <Bold>{client}</Bold>
        </>
      );
    case "meeting":
      return (
        <>
          Client meeting with <Bold>{client}</Bold>
        </>
      );
    case "onboarded":
      return (
        <>
          <Bold>{client}</Bold> onboarded, {note}
        </>
      );
  }
}

function sentencePlain(item: ActivityItem): string {
  const note = item.note ?? "";
  const actor = shortName(item.actorName);
  const client = item.clientName ?? "a client";
  const reference = item.reference ?? "a matter";

  switch (item.verb) {
    case "escalated":
      return `${reference} escalated, ${note}`;
    case "delivered":
      return `${actor} delivered ${note}`;
    case "submitted":
      return `${client} submitted ${note}`;
    case "assigned":
      return `${actor} assigned to ${reference}`;
    case "quoted":
      return `${actor} quoted ${reference} at ${note}`;
    case "drafted":
      return `Moritz drafted ${note}`;
    case "filed":
      return `${note} filed for ${client}`;
    case "meeting":
      return `Client meeting with ${client}`;
    case "onboarded":
      return `${client} onboarded, ${note}`;
  }
}

function dotColor(verb: ActivityItem["verb"]): string {
  if (verb === "delivered") return "var(--feed-dot-delivered)";
  if (verb === "escalated") return "var(--feed-dot-escalated)";
  return "var(--feed-dot-default)";
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function FeedItem({ item }: { item: ActivityItem }) {
  const plain = sentencePlain(item);

  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-start gap-2 py-2">
      <span
        className="mt-2 size-1.5 shrink-0 rounded-full"
        style={{ background: dotColor(item.verb) }}
        aria-hidden
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <p
            className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-foreground"
            style={{ fontSize: "var(--text-12)", lineHeight: 1.45 }}
          >
            {buildSentence(item)}
          </p>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          {plain}
        </TooltipContent>
      </Tooltip>
      <time
        dateTime={item.at}
        className="num whitespace-nowrap text-text-tertiary"
        style={{ fontSize: "var(--text-11)" }}
      >
        {formatTime(item.at)}
      </time>
    </li>
  );
}
