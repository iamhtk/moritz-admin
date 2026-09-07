"use client";

import type { ReactNode } from "react";
import { MatterReference } from "@/components/matter-reference";
import { formatFeeDollars } from "@/lib/format";
import type { ActivityItem } from "@/lib/supabase";

function shortName(name: string | null, actorId?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }
  if (actorId === "ai") return "Nora";
  if (actorId === "system" || actorId === "admin") return "Ops";
  return "Ops";
}

function formatQuotedAmount(note: string): ReactNode {
  const digits = note.replace(/[^\d]/g, "");
  const amount = Number(digits);
  if (amount > 0) return formatFeeDollars(amount);
  return note;
}

function isClientUpdate(item: ActivityItem): boolean {
  if (item.verb !== "escalated") return false;
  const note = item.note?.toLowerCase() ?? "";
  return note === "client updated" || note.startsWith("client updated");
}

function BoldRef({
  reference,
  link,
}: {
  reference: string;
  link: boolean;
}) {
  if (link && /^MOR-\d+/i.test(reference)) {
    return <MatterReference reference={reference} className="font-medium" />;
  }
  return <b className="font-medium">{reference}</b>;
}

function Bold({ children }: { children: ReactNode }) {
  return <b className="font-medium">{children}</b>;
}

/** Shared Pulse / notification sentence (rich). */
export function buildActivitySentence(
  item: ActivityItem,
  options: { linkMatterRefs?: boolean } = {}
): ReactNode {
  const link = options.linkMatterRefs ?? true;
  const note = item.note ?? "";
  const actor = shortName(item.actorName, item.actor_id);
  const client = item.clientName ?? "a client";
  const reference = item.reference ?? "a matter";

  if (isClientUpdate(item)) {
    return (
      <>
        Client update logged for <BoldRef reference={reference} link={link} />
      </>
    );
  }

  switch (item.verb) {
    case "escalated":
      return (
        <>
          <BoldRef reference={reference} link={link} /> escalated
          {note && note !== "past due" ? `, ${note}` : note === "past due" ? ", past due" : ""}
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
          <Bold>{actor}</Bold> assigned to{" "}
          <BoldRef reference={reference} link={link} />
        </>
      );
    case "quoted":
      return (
        <>
          <Bold>{actor}</Bold> quoted <BoldRef reference={reference} link={link} />{" "}
          at {formatQuotedAmount(note)}
        </>
      );
    case "drafted":
      return (
        <>
          <Bold>{actor}</Bold> drafted {note}
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

/** Plain-text variant for tooltips and aria labels. */
export function activitySentencePlain(item: ActivityItem): string {
  const note = item.note ?? "";
  const actor = shortName(item.actorName, item.actor_id);
  const client = item.clientName ?? "a client";
  const reference = item.reference ?? "a matter";

  if (isClientUpdate(item)) {
    return `Client update logged for ${reference}`;
  }

  switch (item.verb) {
    case "escalated":
      return `${reference} escalated${note ? `, ${note}` : ""}`;
    case "delivered":
      return `${actor} delivered ${note}`;
    case "submitted":
      return `${client} submitted ${note}`;
    case "assigned":
      return `${actor} assigned to ${reference}`;
    case "quoted": {
      const digits = note.replace(/[^\d]/g, "");
      const amount = Number(digits);
      const fee = amount > 0 ? formatFeeDollars(amount) : note;
      return `${actor} quoted ${reference} at ${fee}`;
    }
    case "drafted":
      return `${actor} drafted ${note}`;
    case "filed":
      return `${note} filed for ${client}`;
    case "meeting":
      return `Client meeting with ${client}`;
    case "onboarded":
      return `${client} onboarded, ${note}`;
  }
}

export function activityDotColor(verb: ActivityItem["verb"]): string {
  if (verb === "delivered") return "var(--feed-dot-delivered)";
  if (verb === "escalated") return "var(--feed-dot-escalated)";
  return "var(--feed-dot-default)";
}

export function isLawyerActor(actorId: string | null): actorId is string {
  return !!actorId && /^l\d+$/.test(actorId);
}

export function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (today.getTime() - that.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function groupActivityByDay(items: ActivityItem[]) {
  const groups: { key: string; label: string; items: ActivityItem[] }[] = [];
  const index = new Map<string, number>();

  for (const item of items) {
    const key = dayKey(item.at);
    const existing = index.get(key);
    if (existing === undefined) {
      index.set(key, groups.length);
      groups.push({ key, label: dayLabel(item.at), items: [item] });
    } else {
      groups[existing].items.push(item);
    }
  }

  return groups;
}

export function matterHref(reference: string | null): string | null {
  if (!reference) return null;
  return `/matters?ref=${encodeURIComponent(reference)}`;
}
