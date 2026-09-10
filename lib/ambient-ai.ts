/**
 * Ambient AI lines for the Overview: morning brief and capacity forecast.
 * Shared so the server payload and client optimistic patches stay in sync.
 */

import type {
  AttentionItem,
  Config,
  LawyerLoad,
  MatterStatus,
} from "./supabase";
import { formatDuration } from "./format";

export type Brief = {
  headline: string;
  detail: string;
  action: AttentionItem | null;
};

/**
 * The morning brief. Connects two facts and proposes the one action that
 * resolves the most. Generated from state, never hardcoded. Quiet when calm.
 *
 * Never recommends assign/reassign for a matter whose live state no longer
 * needs that action (already held by someone who is not over capacity).
 */
export function buildBrief(
  attention: AttentionItem[],
  loads: LawyerLoad[],
  live: MatterStatus[]
): Brief {
  const breaches = attention.filter((a) => a.kind === "breach");
  const over = loads.filter((l) => l.capacityState === "over");
  const unassigned = attention.filter((a) => a.kind === "unassigned");

  if (breaches.length === 0 && over.length === 0 && unassigned.length === 0) {
    return {
      headline: "Nothing at risk.",
      detail: "Every matter in flight has time on the clock and a lawyer on it.",
      action: null,
    };
  }

  if (breaches.length && over.length) {
    const busiest = over[0];
    const busiestFirst = busiest.name.split(" ")[0];
    const headline = `${
      breaches.length === 1 ? "One matter is" : `${breaches.length} matters are`
    } past due and ${busiest.name} is at ${busiest.utilizationPct} percent.`;

    // Only recommend assign/reassign when the matter still needs it:
    // no lawyer yet, or held by someone who is over capacity.
    const actionable = breaches.find((b) => {
      const matter = live.find((m) => m.id === b.matterId);
      if (!matter) return false;
      if (!matter.lawyer_id) return true;
      return over.some((o) => o.id === matter.lawyer_id);
    });

    if (!actionable) {
      const oldest = breaches[0];
      return {
        headline,
        detail: `${oldest.title} is the oldest past-due. ${busiestFirst} still needs work moved off separately.`,
        action:
          attention.find(
            (a) => a.kind === "overCapacity" && a.lawyerId === busiest.id
          ) ??
          attention.find((a) => a.lawyerId === busiest.id) ??
          null,
      };
    }

    const matter = live.find((m) => m.id === actionable.matterId);
    const loadTarget =
      matter?.lawyer_id != null
        ? (over.find((o) => o.id === matter.lawyer_id) ?? busiest)
        : busiest;
    const loadFirst = loadTarget.name.split(" ")[0];
    const needsAssign = !matter?.lawyer_id;
    const onOverload =
      matter?.lawyer_id != null &&
      over.some((o) => o.id === matter.lawyer_id);

    const withRoom = [...loads]
      .reverse()
      .filter((l) => l.capacityState === "room");
    const fit = matter
      ? withRoom
          .filter((l) => l.practice_areas.includes(matter.service_line))
          .filter((l) => l.id !== matter.lawyer_id)
          .sort((a, b) => a.utilizationPct - b.utilizationPct)[0]
      : undefined;

    let detail: string;
    if (fit && onOverload) {
      detail = `Reassigning ${actionable.title} to ${fit.name.split(" ")[0]} clears the past-due matter and eases load on ${loadFirst}.`;
    } else if (fit && needsAssign) {
      detail = `Assign ${actionable.title} to ${fit.name.split(" ")[0]} to clear the oldest past-due matter. ${busiestFirst} still needs work moved off separately.`;
    } else if (onOverload) {
      detail = `Reassigning ${actionable.title} off ${loadFirst} clears the past-due matter and is the first step to easing load.`;
    } else if (needsAssign) {
      detail = `Assign ${actionable.title} to clear the oldest past-due matter. ${busiestFirst} still needs work moved off separately.`;
    } else {
      detail = `${actionable.title} is the oldest past-due. ${busiestFirst} still needs work moved off separately.`;
    }

    return {
      headline,
      detail,
      action: needsAssign || onOverload ? actionable : null,
    };
  }

  if (breaches.length) {
    return {
      headline: `${breaches.length === 1 ? "One matter is" : `${breaches.length} matters are`} past due.`,
      detail: `${breaches[0].title} is the oldest at ${formatDuration(Math.abs(breaches[0].minutesRemaining ?? 0))} over.`,
      action: breaches[0],
    };
  }

  if (unassigned.length) {
    const oldest = unassigned[0];
    return {
      headline: `${unassigned.length} ${unassigned.length === 1 ? "matter has" : "matters have"} no lawyer.`,
      detail: oldest.arrival
        ? `The oldest ${oldest.arrival}.`
        : "Assign the oldest one first.",
      action: oldest,
    };
  }

  const busiest = over[0];
  return {
    headline: `${busiest.name} is at ${busiest.utilizationPct} percent.`,
    detail: "Nothing is past due yet, but the next matter should go elsewhere.",
    action: attention.find((a) => a.lawyerId === busiest.id) ?? null,
  };
}

/**
 * Capacity forecast. States who is already over or at the watch threshold,
 * notes recent intake, and names who still has room. Does not invent a tip-over
 * clock — that would look like a prediction we cannot support from the data.
 */
export function buildForecast(
  live: MatterStatus[],
  loads: LawyerLoad[],
  cfg: Config
): string | null {
  const lastHour = live.filter(
    (m) => cfg.slaMinutes - m.minutes_remaining <= 60
  ).length;
  if (lastHour === 0) return null;

  const over = loads.filter((l) => l.capacityState === "over");
  const high = loads.filter((l) => l.capacityState === "high");
  if (over.length + high.length === 0) return null;

  // Prefer room names nearer the top of the busiest-first table.
  const room = loads.filter((l) => l.capacityState === "room").slice(0, 2);
  const loadParts: string[] = [];
  if (over.length) {
    loadParts.push(
      `${over.length} ${over.length === 1 ? "lawyer is" : "lawyers are"} over capacity`
    );
  }
  if (high.length) {
    loadParts.push(
      `${high.length} at the ${cfg.capacityWatchPct} percent watch threshold`
    );
  }

  const intake =
    lastHour === 1
      ? "1 matter arrived in the last hour"
      : `${lastHour} matters arrived in the last hour`;

  const roomLine = room.length
    ? `${room.map((l) => l.name.split(" ")[0]).join(" and ")} have room.`
    : "";

  return `${loadParts.join(", ")}. ${intake}. ${roomLine}`.trim();
}
