/**
 * lib/queries.ts
 *
 * Everything the dashboard knows, computed on the server.
 *
 * Postgres owns the two facts that depend on the clock: minutes_remaining and
 * risk, both from the matter_status view. This file owns everything that
 * depends on more than one row: capacity, the attention strip, the finance
 * summary, the anomaly, and the ambient AI lines.
 *
 * The page computes nothing. It renders what this returns.
 */

import {
  serverClient,
  type ActivityItem,
  type ActivityRow,
  type AttentionItem,
  type CapacityState,
  type Config,
    type FinanceDayRow,
    type LawyerLoad,
    type LawyerRow,
    type MatterStatus,
    type MattersDirectoryPayload,
    type OverviewPayload,
    type ServiceLine,
    type UnquotedMatter,
  } from "./supabase";
import { buildBrief, buildForecast } from "./ambient-ai";
import { formatDuration, formatFeeDollars } from "./format";

/* ---------- config ------------------------------------------------------- */

async function getConfig(db: ReturnType<typeof serverClient>): Promise<Config> {
    const { data } = await db.from("app_config").select("key, value");
    const map = new Map((data ?? []).map((r) => [r.key as string, Number(r.value)]));
    return {
      slaMinutes: map.get("sla_minutes") ?? 240,
      slaWatchMinutes: map.get("sla_watch_minutes") ?? 60,
      capacityWatchPct: map.get("capacity_watch_pct") ?? 80,
      capacityOverPct: map.get("capacity_over_pct") ?? 100,
      monthlyTarget: map.get("monthly_target") ?? 180000,
      dailyDeliveryPlan: map.get("daily_delivery_plan") ?? 7,
    };
  }
  
  /* ---------- capacity ----------------------------------------------------- */
  
  function capacityState(pct: number, cfg: Config): CapacityState {
    if (pct >= cfg.capacityOverPct) return "over";
    if (pct >= cfg.capacityWatchPct) return "high";
    return "room";
  }
  
  /** Colour is reinforcement. The label is the accessible name. */
  function capacityLabel(state: CapacityState): string {
    return state === "over" ? "Over capacity" : state === "high" ? "High" : "Room";
  }

  /**
   * Next due, for reading rather than sorting. A lawyer whose soonest matter is
   * already late has negative minutes remaining, and "-14m" is not a countdown.
   */
  function nextDueLabel(minutes: number | null): string {
    if (minutes === null) return "-";
    if (minutes < 0) return "Past due";
    return formatDuration(minutes);
  }

  function roundToNearest50(n: number): number {
    return Math.round(n / 50) * 50;
  }

  function sortedFees(fees: number[]): number[] {
    return [...fees].sort((a, b) => a - b);
  }

  function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  function median(sorted: number[]): number {
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  /**
   * Fee ladder: same type + service line, then service line alone.
   * Quiet below three comparables — never invent a number.
   */
  function comparableFees(
    delivered: MatterStatus[],
    serviceLine: ServiceLine,
    type: string
  ): number[] {
    const exact = delivered
      .filter(
        (m) =>
          m.service_line === serviceLine &&
          m.type === type &&
          m.fee > 0
      )
      .map((m) => Number(m.fee));
    if (exact.length >= 3) return sortedFees(exact);

    const byLine = delivered
      .filter((m) => m.service_line === serviceLine && m.fee > 0)
      .map((m) => Number(m.fee));
    if (byLine.length >= 3) return sortedFees(byLine);
    return [];
  }

  function feeBandFor(
    delivered: MatterStatus[],
    serviceLine: ServiceLine,
    type: string
  ): { low: number; high: number } | null {
    const fees = comparableFees(delivered, serviceLine, type);
    if (fees.length < 3) return null;
    return {
      low: roundToNearest50(percentile(fees, 0.25)),
      high: roundToNearest50(percentile(fees, 0.75)),
    };
  }

  function suggestedFeeFor(
    delivered: MatterStatus[],
    serviceLine: ServiceLine,
    type: string
  ): { fee: number; count: number } | null {
    const fees = comparableFees(delivered, serviceLine, type);
    if (fees.length < 3) return null;
    return {
      fee: roundToNearest50(median(fees)),
      count: fees.length,
    };
  }

  function channelLabel(channel: MatterStatus["channel"]): string {
    switch (channel) {
      case "slack":
        return "Slack";
      case "email":
        return "Email";
      case "platform":
        return "Platform";
    }
  }

  function formatClock(iso: string): string {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  /**
   * Escalation handoff. Each sentence needs its fields; omit the clause
   * rather than printing nulls. C6: hand off with context, never an error.
   */
  function buildHandoff(m: MatterStatus): string | null {
    const parts: string[] = [];

    if (m.draft_minutes != null && m.flagged_clauses != null) {
      parts.push(
        `Drafted in ${formatDuration(m.draft_minutes)} with ${m.flagged_clauses} clauses flagged.`
      );
    }

    if (m.lawyer_name && m.draft_minutes != null && m.submitted_at) {
      const reviewStart = new Date(
        new Date(m.submitted_at).getTime() + m.draft_minutes * 60_000
      );
      parts.push(
        `In review with ${m.lawyer_name} since ${formatClock(reviewStart.toISOString())}.`
      );
    }

    if (m.fee > 0 && m.due_at) {
      parts.push(
        `${m.client_name} was quoted ${formatFeeDollars(m.fee)} and expects delivery by ${formatClock(m.due_at)}.`
      );
    }

    return parts.length > 0 ? parts.join(" ") : null;
  }

  /**
   * Causal sentence for breach handoff. Compares this matter's draft time or
   * flagged-clause count to the delivered average for the same type. Falls
   * back to the service-line average when the type has too few peers, then
   * to an honest "no comparable pattern" when nothing can be computed.
   */
  function buildHandoffCause(
    m: MatterStatus,
    delivered: MatterStatus[]
  ): string {
    function compare(
      peers: MatterStatus[],
      label: string
    ): string | null {
      const withDraft = peers.filter((d) => d.draft_minutes != null);
      if (m.draft_minutes != null && withDraft.length >= 3) {
        const avg =
          withDraft.reduce((s, d) => s + (d.draft_minutes ?? 0), 0) /
          withDraft.length;
        if (avg > 0 && m.draft_minutes >= avg * 1.15) {
          const pct = Math.round((m.draft_minutes / avg - 1) * 100);
          return `Flagged because this matter took ${pct}% longer to draft than the average for ${label} (${formatDuration(m.draft_minutes)} vs ${formatDuration(Math.round(avg))} across ${withDraft.length} delivered).`;
        }
      }

      if (peers.length >= 3 && m.flagged_clauses != null) {
        const avgFlags =
          peers.reduce((s, d) => s + (d.flagged_clauses ?? 0), 0) /
          peers.length;
        if (avgFlags > 0 && m.flagged_clauses >= avgFlags * 1.25) {
          return `Flagged because this matter has ${m.flagged_clauses} clauses flagged versus an average of ${avgFlags.toFixed(1)} for ${label} (${peers.length} comparable).`;
        }
      }
      return null;
    }

    const typePeers = delivered.filter((d) => d.type === m.type);
    const fromType = compare(typePeers, `${m.type} matters`);
    if (fromType) return fromType;

    if (typePeers.length < 3) {
      const linePeers = delivered.filter(
        (d) => d.service_line === m.service_line
      );
      const fromLine = compare(linePeers, `${m.service_line} matters`);
      if (fromLine) return fromLine;
    }

    return "No comparable pattern found for this matter type.";
  }

  /** Same client + same type within 60 minutes of each other → possible duplicate. */
  function findDuplicateOf(
    m: MatterStatus,
    live: MatterStatus[],
    cfg: Config
  ): { reference: string; minutesAgo: number } | null {
    const ageOf = (x: MatterStatus) => cfg.slaMinutes - x.minutes_remaining;
    const myAge = ageOf(m);
    let best: { reference: string; minutesAgo: number } | null = null;

    for (const other of live) {
      if (other.id === m.id) continue;
      if (other.client_id !== m.client_id) continue;
      if (other.type !== m.type) continue;
      const otherAge = ageOf(other);
      const delta = Math.abs(myAge - otherAge);
      if (delta > 60) continue;
      // Prefer the older sibling as the "original" (higher age = submitted earlier).
      if (otherAge <= myAge) continue;
      if (!best || delta < best.minutesAgo) {
        best = { reference: other.reference, minutesAgo: Math.max(1, Math.round(delta)) };
      }
    }
    return best;
  }

  function buildLawyerLoads(
    lawyers: LawyerRow[],
    live: MatterStatus[],
    cfg: Config
  ): LawyerLoad[] {
    return lawyers
      .map((l) => {
        const mine = live.filter((m) => m.lawyer_id === l.id);
        const activeMatters = mine.length;
        const utilizationPct = Math.round((activeMatters / l.weekly_capacity) * 100);
        const state = capacityState(utilizationPct, cfg);
        const nextDue = mine
          .map((m) => m.minutes_remaining)
          .sort((a, b) => a - b)[0];
        return {
          ...l,
          activeMatters,
          utilizationPct,
          capacityState: state,
          capacityLabel: capacityLabel(state),
          // Minutes stay signed so the sort still works; the label is what reads.
          nextDueMinutes: nextDue ?? null,
          nextDueLabel: nextDueLabel(nextDue ?? null),
        };
      })
      .sort((a, b) => b.utilizationPct - a.utilizationPct);
  }
  
  /* ---------- slip risk ----------------------------------------------------
   * A matter that is technically on time but statistically likely to breach.
   * Basis: the assigned lawyer's historical on-time rate against the time left.
   * This is the one signal the table cannot show on its own.
   * ------------------------------------------------------------------------ */
  
  export function likelyToSlip(m: MatterStatus, cfg: Config): boolean {
    if (m.risk !== "ok" && m.risk !== "watch") return false;
    if (!m.on_time_rate) return false;
    if (m.stage === "delivered") return false;
    const elapsedPct = 1 - m.minutes_remaining / cfg.slaMinutes;
    // Past halfway, still not in review, and a lawyer who runs late.
    return elapsedPct > 0.5 && m.stage !== "review" && m.on_time_rate < 0.85;
  }
  
  /* ---------- attention ----------------------------------------------------
   * One list, three problem types, sorted by urgency. Every row has an action.
   * ------------------------------------------------------------------------ */
  
  function buildAttention(
    live: MatterStatus[],
    loads: LawyerLoad[],
    cfg: Config,
    delivered: MatterStatus[]
  ): AttentionItem[] {
    const ATTENTION_WATCH_MINUTES = 20;
    const LOW_CONFIDENCE = 0.72;
    const items: AttentionItem[] = [];

    function lowConfidenceFor(m: MatterStatus) {
      if (
        m.stage === "review" &&
        m.draft_confidence != null &&
        m.draft_confidence < LOW_CONFIDENCE
      ) {
        return {
          confidence: m.draft_confidence,
          flaggedClauses: m.flagged_clauses,
        };
      }
      return null;
    }

    for (const m of live) {
      if (m.risk === "breach") {
        items.push({
          kind: "breach",
          id: `breach-${m.id}`,
          label: `Past due ${formatDuration(Math.abs(m.minutes_remaining))}`,
          title: m.reference,
          reason: `${m.client_name} · ${m.type} · ${
            m.lawyer_name ? `with ${m.lawyer_name}` : "no lawyer assigned"
          }`,
          action: m.lawyer_id ? "Reassign" : "Assign",
          minutesRemaining: m.minutes_remaining,
          matterId: m.id,
          lawyerId: m.lawyer_id,
          handoff: buildHandoff(m),
          handoffCause: buildHandoffCause(m, delivered),
          lowConfidence: lowConfidenceFor(m),
        });
      } else if (
        m.lawyer_id &&
        m.minutes_remaining > 0 &&
        m.minutes_remaining <= ATTENTION_WATCH_MINUTES
      ) {
        const slip = likelyToSlip(m, cfg);
        items.push({
          kind: "watch",
          id: `watch-${m.id}`,
          label: `${formatDuration(m.minutes_remaining)} left`,
          title: m.reference,
          reason: `${m.client_name} · ${m.type} · ${m.stage}${
            slip ? " · likely to slip" : ""
          }`,
          action: "Nudge lawyer",
          minutesRemaining: m.minutes_remaining,
          matterId: m.id,
          lawyerId: m.lawyer_id,
          lowConfidence: lowConfidenceFor(m),
          slipBasis: slip
            ? "Past halfway on the clock, still drafting, and this lawyer's on-time rate is under 85 percent."
            : null,
        });
      }

      // Unassigned always lands in the list. Triage badge and fee band are
      // enhancements — never a gate. Quiet fee bands fall back to null.
      if (!m.lawyer_id && m.stage !== "delivered" && m.fee > 0) {
        const age = cfg.slaMinutes - m.minutes_remaining;
        let band: { low: number; high: number } | null = null;
        try {
          band = feeBandFor(delivered, m.service_line, m.type);
        } catch {
          band = null;
        }
        const arrival = `arrived ${formatDuration(age)} ago via ${channelLabel(m.channel)}`;
        items.push({
          kind: "unassigned",
          id: `unassigned-${m.id}`,
          label: "No lawyer",
          title: m.reference,
          reason: m.client_name,
          action: "Assign",
          minutesRemaining: m.minutes_remaining,
          matterId: m.id,
          lawyerId: null,
          triage: { type: m.type, serviceLine: m.service_line },
          feeBand: band,
          arrival,
          duplicateOf: findDuplicateOf(m, live, cfg),
          lowConfidence: lowConfidenceFor(m),
        });
      }
    }

    // One attention row for capacity: when two or more lawyers are over, collapse
    // to a single badge so the strip does not flood with red.
    const over = loads
      .filter((l) => l.capacityState === "over")
      .sort((a, b) => b.utilizationPct - a.utilizationPct);

    if (over.length >= 2) {
      const primary = over[0];
      items.push({
        kind: "overCapacity",
        id: "over-capacity-group",
        label: "Over capacity",
        title: `${over.length} lawyers over capacity`,
        reason: over.map((l) => l.name).join(", "),
        action: "Reassign",
        minutesRemaining: null,
        matterId: null,
        lawyerId: primary.id,
      });
    } else if (over.length === 1) {
      const l = over[0];
      items.push({
        kind: "overCapacity",
        id: `over-${l.id}`,
        label: "Over capacity",
        title: l.name,
        reason: `${l.utilizationPct} percent · ${l.activeMatters} active matters against a capacity of ${l.weekly_capacity}`,
        action: "Reassign",
        minutesRemaining: null,
        matterId: null,
        lawyerId: l.id,
      });
    }

    // Past due first, then least time remaining within kind, unassigned before
    // capacity problems so triage stays visible without opening show-more.
    const kindOrder: Record<AttentionItem["kind"], number> = {
      breach: 0,
      watch: 1,
      unassigned: 2,
      unquoted: 3,
      overCapacity: 4,
    };
    return items.sort((a, b) => {
      const ko = kindOrder[a.kind] - kindOrder[b.kind];
      if (ko !== 0) return ko;
      const am = a.minutesRemaining ?? 9999;
      const bm = b.minutesRemaining ?? 9999;
      return am - bm;
    });
  }
  
  /* ---------- finance ------------------------------------------------------ */
  
  function buildFinance(
    days: FinanceDayRow[],
    delivered: MatterStatus[],
    live: MatterStatus[],
    all: MatterStatus[],
    cfg: Config
  ) {
    // The series is a trailing window and crosses month boundaries. The target
    // is monthly, so revenue and the projection count only the current month.
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthDays = days.filter((d) => String(d.date).slice(0, 7) === monthPrefix);

    const revenueToDate = monthDays.reduce((s, d) => s + Number(d.revenue), 0);
    const pctOfTarget = Math.round((revenueToDate / cfg.monthlyTarget) * 100);

    // Pace from calendar working days through today, not from finance plan rows.
    // revenueToDate / workingDaysElapsed * workingDaysInMonth / target.
    // e.g. 5 Sep 2026: workingDaysElapsed=4, workingDaysInMonth=22
    const year = now.getFullYear();
    const month = now.getMonth();
    const todayDate = now.getDate();
    const lastOfMonth = new Date(year, month + 1, 0).getDate();
    let workingDaysElapsed = 0;
    let workingDaysInMonth = 0;
    for (let d = 1; d <= lastOfMonth; d++) {
      const dow = new Date(year, month, d).getDay();
      if (dow === 0 || dow === 6) continue;
      workingDaysInMonth++;
      if (d <= todayDate) workingDaysElapsed++;
    }
    const projectedPct = workingDaysElapsed
      ? Math.round(
          ((revenueToDate / workingDaysElapsed) * workingDaysInMonth) /
            cfg.monthlyTarget *
            100
        )
      : 0;

    const fees = delivered.map((m) => Number(m.fee)).filter(Boolean);
    const avgFee = fees.length ? Math.round(fees.reduce((a, b) => a + b, 0) / fees.length) : 0;
  
    const payouts = delivered.map((m) => Number(m.payout));
    const totalFee = fees.reduce((a, b) => a + b, 0);
    const totalPayout = payouts.reduce((a, b) => a + b, 0);
    const payoutPct = totalFee ? Math.round((totalPayout / totalFee) * 100) : 0;
    const marginPct = 100 - payoutPct;
  
    // Last seven calendar days of the series.
    const week = days.slice(-7);
    const deliveredThisWeek = week.reduce((s, d) => s + d.delivered, 0);
    const plannedThisWeek = week.reduce((s, d) => s + d.planned_delivered, 0);
  
    // The 80/20 split, made measurable.
    const withDraft = delivered.filter((m) => m.draft_minutes && m.review_minutes);
    const avgDraftMinutes = withDraft.length
      ? Math.round(withDraft.reduce((s, m) => s + (m.draft_minutes ?? 0), 0) / withDraft.length)
      : 0;
    const avgReviewMinutes = withDraft.length
      ? Math.round(withDraft.reduce((s, m) => s + (m.review_minutes ?? 0), 0) / withDraft.length)
      : 0;

    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const turnaroundWindow = (fromMs: number, toMs: number) => {
      const rows = delivered.filter((m) => {
        if (!m.delivered_at) return false;
        const t = new Date(m.delivered_at).getTime();
        if (t < fromMs || t >= toMs) return false;
        return (
          (m.draft_minutes != null && m.review_minutes != null) ||
          !!m.submitted_at
        );
      });
      if (rows.length === 0) return null;
      const total = rows.reduce((sum, m) => {
        if (m.draft_minutes != null && m.review_minutes != null) {
          return sum + m.draft_minutes + m.review_minutes;
        }
        const start = new Date(m.submitted_at).getTime();
        const end = new Date(m.delivered_at!).getTime();
        return sum + Math.max(0, (end - start) / 60_000);
      }, 0);
      return { avgMinutes: Math.round(total / rows.length), count: rows.length };
    };
    const turnaroundThisWeek = turnaroundWindow(nowMs - weekMs, nowMs);
    const turnaroundLastWeek = turnaroundWindow(nowMs - 2 * weekMs, nowMs - weekMs);
  
    // Anomaly: a service line pricing well below the firm average.
    const byLine = new Map<ServiceLine, number[]>();
    for (const m of delivered) {
      if (!m.fee) continue;
      const arr = byLine.get(m.service_line) ?? [];
      arr.push(Number(m.fee));
      byLine.set(m.service_line, arr);
    }
    let anomaly: OverviewPayload["finance"]["anomaly"] = null;
    for (const [line, arr] of byLine) {
      if (arr.length < 5) continue;
      const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
      if (avg < avgFee * 0.8) {
        if (!anomaly || avg < anomaly.avg) {
          anomaly = { serviceLine: line, avg, firmAvg: avgFee, count: arr.length };
        }
      }
    }
  
    const unquotedBase = live.filter(
      (m) => m.fee === 0 && m.stage === "submitted"
    );
    const unquoted: UnquotedMatter[] = unquotedBase.map((m) => {
      const suggestion = suggestedFeeFor(delivered, m.service_line, m.type);
      return {
        ...m,
        suggestedFee: suggestion?.fee ?? null,
        comparableCount: suggestion?.count ?? null,
      };
    });

    // Top fee contributors among matters delivered this calendar month.
    const monthDelivered = delivered
      .filter((m) => {
        if (!m.delivered_at) return false;
        return String(m.delivered_at).slice(0, 7) === monthPrefix;
      })
      .slice()
      .sort((a, b) => Number(b.fee) - Number(a.fee));
    const revenueDrivers = monthDelivered.slice(0, 2).map((m) => ({
      reference: m.reference,
      fee: Number(m.fee),
      clientName: m.client_name,
    }));

    return {
      days,
      /** Month-to-date series — matches the Revenue to date tile and chart. */
      revenueDays: monthDays,
      target: cfg.monthlyTarget,
      revenueToDate,
      pctOfTarget,
      projectedPct,
      avgFee,
      avgFeeDelta: null as number | null,
      marginPct,
      payoutPct,
      openedThisMonth: all.filter(
        (m) =>
          m.submitted_at && String(m.submitted_at).slice(0, 7) === monthPrefix
      ).length,
      closedThisMonth: delivered.filter(
        (m) =>
          m.delivered_at && String(m.delivered_at).slice(0, 7) === monthPrefix
      ).length,
      deliveredThisWeek,
      plannedThisWeek,
      avgDraftMinutes,
      avgReviewMinutes,
      turnaroundThisWeek,
      turnaroundLastWeek,
      anomaly,
      unquoted,
      revenueDrivers,
    };
  }
  
  /* ---------- ambient AI: buildBrief / buildForecast in lib/ambient-ai.ts --- */

  /** Mon–Fri, same working-day rule as the finance pace projection. */
  function isWorkingDay(d: Date): boolean {
    const day = d.getDay();
    return day !== 0 && day !== 6;
  }

  /** Whole working days whose local calendar date falls in [start, end] inclusive. */
  function workingDaysInRange(start: Date, end: Date): number {
    let n = 0;
    const from = new Date(start);
    from.setHours(0, 0, 0, 0);
    const to = new Date(end);
    to.setHours(0, 0, 0, 0);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (isWorkingDay(d)) n++;
    }
    return n;
  }

  /**
   * Remaining Mon–Fri time in the current calendar week (Sun–Sat), as a
   * fractional day count. Weekends contribute nothing — same assumption as
   * finance projections, which skip Sat/Sun entirely.
   */
  function remainingWorkingDaysThisWeek(now: Date): number {
    const dow = now.getDay(); // 0 = Sun
    if (dow === 0 || dow === 6) return 0;

    const endOfToday = new Date(now);
    endOfToday.setHours(24, 0, 0, 0);
    let remaining =
      Math.max(0, endOfToday.getTime() - now.getTime()) / 86_400_000;

    // Full weekdays after today through Friday of this week.
    for (let d = dow + 1; d <= 5; d++) {
      remaining += 1;
    }
    return remaining;
  }

  /**
   * Week-scoped capacity projection. Rate = matters submitted per working day
   * over the past week (all stages), projected over remaining Mon–Fri time,
   * compared to open concurrent slots. Returns null when the figure cannot be
   * trusted (thin history or absurd overage).
   */
  function buildWeeklyForecast(
    all: MatterStatus[],
    live: MatterStatus[],
    loads: LawyerLoad[]
  ): OverviewPayload["ai"]["weeklyCapacityForecast"] {
    const totalCapacity = loads.reduce((s, l) => s + l.weekly_capacity, 0);
    const active = live.length;
    const room = Math.max(0, totalCapacity - active);

    const now = new Date();
    const lookbackDays = 7;
    const windowStart = new Date(now.getTime() - lookbackDays * 86_400_000);
    const received = all.filter(
      (m) => m.submitted_at && new Date(m.submitted_at) >= windowStart
    ).length;
    const workDaysElapsed = workingDaysInRange(windowStart, now);
    if (workDaysElapsed < 1 || received < 1) return null;

    const ratePerWorkDay = received / workDaysElapsed;
    const daysLeft = remainingWorkingDaysThisWeek(now);
    if (daysLeft <= 0) return null;

    const projectedAdd = Math.round(ratePerWorkDay * daysLeft);
    const tooltip =
      `${received} matters received over ${workDaysElapsed} working days` +
      ` (≈${ratePerWorkDay.toFixed(1)}/day) × ${daysLeft.toFixed(1)} working days left` +
      ` · ${active} active against ${totalCapacity} slots`;

    if (projectedAdd <= room) {
      return {
        text: "This week: on pace to stay within capacity",
        tooltip,
      };
    }

    const over = projectedAdd - room;
    // Sanity: an overage larger than the firm's whole weekly capacity is not a
    // forecast — it is a broken rate. Prefer silence over a confident wrong number.
    if (over > totalCapacity) return null;

    return {
      text: `This week: on pace to exceed capacity by roughly ${over} ${
        over === 1 ? "matter" : "matters"
      }`,
      tooltip,
    };
  }

  /**
   * Forward intake estimate: average new matters per ISO week over the past
   * complete weeks in seed history (submitted_at). Caveats when history is thin.
   */
  function buildPredictedVolume(
    all: MatterStatus[]
  ): OverviewPayload["ai"]["predictedVolume"] {
    const weekKey = (iso: string) => {
      const d = new Date(iso);
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
      const week = Math.ceil(
        ((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
      );
      return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    };

    const counts = new Map<string, number>();
    for (const m of all) {
      if (!m.submitted_at) continue;
      const k = weekKey(m.submitted_at);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    const nowKey = weekKey(new Date().toISOString());
    const prior = [...counts.entries()]
      .filter(([k]) => k !== nowKey)
      .sort(([a], [b]) => (a < b ? 1 : -1));

    const window = prior.slice(0, 4);
    if (window.length === 0) {
      return {
        estimate: 0,
        basis: "Insufficient intake history to estimate next week's volume",
        weeksUsed: 0,
      };
    }

    const sum = window.reduce((s, [, n]) => s + n, 0);
    const estimate = Math.round(sum / window.length);
    const limited = window.length < 4;
    return {
      estimate,
      basis: limited
        ? `Based on the average of the past ${window.length} weeks (limited history)`
        : `Based on the average of the past ${window.length} weeks`,
      weeksUsed: window.length,
    };
  }
  
  /* ---------- activity ----------------------------------------------------- */
  
  function buildActivity(
    rows: ActivityRow[],
    lawyers: LawyerRow[],
    clientNames: Map<string, string>,
    refs: Map<string, string>
  ): ActivityItem[] {
    const byId = new Map(lawyers.map((l) => [l.id, l]));
    return rows.map((r) => {
      const actor = r.actor_id ? byId.get(r.actor_id) : undefined;
      return {
        ...r,
        actorName:
          actor?.name ??
          (r.actor_id === "ai"
            ? "Nora"
            : r.actor_id === "system" || r.actor_id === "admin"
              ? "Ops"
              : null),
        actorInitials:
          actor?.initials ?? (r.actor_id === "ai" ? "N" : null),
        clientName: r.client_id ? clientNames.get(r.client_id) ?? null : null,
        reference: r.matter_id ? refs.get(r.matter_id) ?? null : null,
      };
    });
  }
  
  /* ---------- the one query the page needs --------------------------------- */
  
  export async function getOverview(): Promise<OverviewPayload> {
    const db = serverClient();
    const cfg = await getConfig(db);
  
    const [mattersRes, lawyersRes, activityRes, financeRes, clientsRes] =
      await Promise.all([
        db.from("matter_status").select("*"),
        db.from("lawyers").select("*"),
        db
          .from("activity_feed")
          .select("*")
          .order("at", { ascending: false })
          .limit(40),
        db.from("finance_days").select("*").order("date"),
        db.from("clients").select("id, company"),
      ]);
  
    const all = (mattersRes.data ?? []) as MatterStatus[];
    const live = all.filter((m) => m.stage !== "delivered");
    const delivered = all.filter((m) => m.stage === "delivered");
    const lawyerRows = (lawyersRes.data ?? []) as LawyerRow[];
  
    const loads = buildLawyerLoads(lawyerRows, live, cfg);
    const attention = buildAttention(live, loads, cfg, delivered);
  
    const clientNames = new Map(
      (clientsRes.data ?? []).map((c) => [c.id as string, c.company as string])
    );
    const refs = new Map(all.map((m) => [m.id, m.reference]));
    const activity = buildActivity(
      (activityRes.data ?? []) as ActivityRow[],
      lawyerRows,
      clientNames,
      refs
    );
  
    // Today's counts per verb. These are the pulse; the feed is the detail.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const today = activity.filter((a) => new Date(a.at) >= startOfDay);
    const activityCounts: Record<string, number> = { all: today.length };
    for (const a of today) activityCounts[a.verb] = (activityCounts[a.verb] ?? 0) + 1;
  
    const deadlines = live
      .filter((m) => m.minutes_remaining <= cfg.slaMinutes)
      .sort((a, b) => {
        const diff = a.minutes_remaining - b.minutes_remaining;
        // When two matters are within 10 minutes on the clock, surface the
        // weaker draft first: low-confidence reviews burn more of the
        // remaining SLA, so the admin should see them sooner.
        if (Math.abs(diff) <= 10) {
          const ac =
            a.stage === "review" && a.draft_confidence != null
              ? a.draft_confidence
              : 1;
          const bc =
            b.stage === "review" && b.draft_confidence != null
              ? b.draft_confidence
              : 1;
          if (ac !== bc) return ac - bc;
        }
        return diff;
      })
      .slice(0, 6);
  
    const dueNextHour = live.filter(
      (m) => m.minutes_remaining > 0 && m.minutes_remaining <= 60
    ).length;
    const breached = live.filter((m) => m.risk === "breach").length;
    const atRiskMatters = live.filter(
      (m) =>
        m.risk === "breach" ||
        (m.risk === "watch" && m.minutes_remaining <= 20)
    );
    const atRisk = atRiskMatters.length;
    const atRiskFees = atRiskMatters.reduce((s, m) => s + Number(m.fee), 0);
    const unassignedList = live.filter((m) => !m.lawyer_id && m.fee > 0);
    const oldestUnassigned = unassignedList.length
      ? Math.max(...unassignedList.map((m) => cfg.slaMinutes - m.minutes_remaining))
      : null;
  
    // Last 7 calendar days ending today, inclusive. Compare date strings so a
    // UTC midnight parse cannot pull tomorrow into a Pacific "today".
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const financeThroughToday = ((financeRes.data ?? []) as FinanceDayRow[]).filter(
      (d) => String(d.date).slice(0, 10) <= todayIso
    );
    // No historical snapshots of in-flight or unassigned counts — omit rather
    // than invent sparklines. Delivered-per-day is real but belongs on Money.
    const inFlightTrend = null;
    const dueTrend = null;
    const unassignedTrend = null;
  
    return {
      config: cfg,
      generatedAt: new Date().toISOString(),
      stats: {
        inFlight: live.length,
        dueNextHour,
        dueToday: live.filter((m) => m.minutes_remaining <= cfg.slaMinutes).length,
        atRisk,
        breached,
        atRiskFees,
        unassigned: unassignedList.length,
        serviceLines: new Set(live.map((m) => m.service_line)).size,
        oldestUnassignedMinutes: oldestUnassigned,
        inFlightTrend,
        dueTrend,
        unassignedTrend,
      },
      attention,
      lawyers: loads,
      deadlines,
      finance: buildFinance(
        financeThroughToday,
        delivered,
        live,
        all,
        cfg
      ),
      activity,
      activityCounts,
      clients: (clientsRes.data ?? []).map((c) => ({
        id: c.id as string,
        company: c.company as string,
      })),
      matters: live,
      ai: {
        brief: buildBrief(attention, loads, live),
        capacityForecast: buildForecast(live, loads, cfg),
        weeklyCapacityForecast: buildWeeklyForecast(all, live, loads),
        predictedVolume: buildPredictedVolume(all),
      },
    };
  }
  
  /* ---------- suggestion for the assign sheet ------------------------------ */
  
  /**
   * Suggested lawyer: practice match first, then lowest load, then on-time rate.
   * Returns the ranked list plus a stated reason for the top one.
   */
  /** Every matter_status row plus lawyer loads for the drill-down pages. */
  export async function getMattersDirectory(): Promise<MattersDirectoryPayload> {
    const db = serverClient();
    const cfg = await getConfig(db);

    const [mattersRes, lawyersRes] = await Promise.all([
      db.from("matter_status").select("*"),
      db.from("lawyers").select("*"),
    ]);

    const matters = (mattersRes.data ?? []) as MatterStatus[];
    const live = matters.filter((m) => m.stage !== "delivered");
    const lawyerRows = (lawyersRes.data ?? []) as LawyerRow[];
    const lawyers = buildLawyerLoads(lawyerRows, live, cfg);

    return {
      matters,
      lawyers,
      generatedAt: new Date().toISOString(),
    };
  }

  export async function getAssignCandidates(matterId: string) {
    const db = serverClient();
    const [{ data: m }, { data: lawyerRows }, { data: mattersData }] =
      await Promise.all([
        db.from("matter_status").select("*").eq("id", matterId).single(),
        db.from("lawyers").select("*"),
        db.from("matter_status").select("*").neq("stage", "delivered"),
      ]);
  
    const cfg = await getConfig(db);
    const live = (mattersData ?? []) as MatterStatus[];
    const loads = buildLawyerLoads(
      (lawyerRows ?? []) as LawyerRow[],
      live,
      cfg
    );
    const matter = m as MatterStatus;
  
    const available = loads
      .filter((l) => l.capacityState !== "over")
      .map((l) => ({
        ...l,
        practiceMatch: l.practice_areas.includes(matter.service_line),
      }));

    // If everyone is over, still return the full list so the admin can choose.
    const everyoneOver = available.length === 0;
    const pool =
      available.length > 0
        ? available
        : loads.map((l) => ({
            ...l,
            practiceMatch: l.practice_areas.includes(matter.service_line),
          }));

    const ranked = pool.sort((a, b) => {
      if (a.practiceMatch !== b.practiceMatch) return a.practiceMatch ? -1 : 1;
      if (a.utilizationPct !== b.utilizationPct)
        return a.utilizationPct - b.utilizationPct;
      return b.on_time_rate - a.on_time_rate;
    });
  
    const top = ranked[0];
    let reason: string | null = top
      ? [
          top.practiceMatch ? `${matter.service_line} match` : "available",
          `${top.utilizationPct} percent load`,
          `${Math.round(top.on_time_rate * 100)} percent on time`,
        ].join(" · ")
      : null;
    let suggestedId = top?.id ?? null;

    // When nobody has room, prefer the lawyer whose next due matter clears soonest
    // (positive minutes_remaining), practice match first — else keep least-loaded.
    if (everyoneOver && top) {
      type Slot = {
        lawyer: (typeof ranked)[number];
        clearing: MatterStatus;
      };
      const slots: Slot[] = [];
      for (const lawyer of ranked) {
        const clearing = live
          .filter(
            (x) =>
              x.lawyer_id === lawyer.id &&
              x.minutes_remaining > 0 &&
              x.id !== matter.id
          )
          .sort((a, b) => a.minutes_remaining - b.minutes_remaining)[0];
        if (clearing) slots.push({ lawyer, clearing });
      }
      slots.sort((a, b) => {
        if (a.lawyer.practiceMatch !== b.lawyer.practiceMatch) {
          return a.lawyer.practiceMatch ? -1 : 1;
        }
        return a.clearing.minutes_remaining - b.clearing.minutes_remaining;
      });
      const soonest = slots[0];
      if (soonest) {
        suggestedId = soonest.lawyer.id;
        const when = new Date(
          Date.now() + soonest.clearing.minutes_remaining * 60_000
        );
        const hh = when.getHours().toString().padStart(2, "0");
        const mm = when.getMinutes().toString().padStart(2, "0");
        const first = soonest.lawyer.name.split(" ")[0];
        reason = `No one has room right now. ${first} clears ${soonest.clearing.reference} at ${hh}:${mm} and would be your best fit after that`;
      }
    }
  
    return { matter, candidates: ranked, suggestedId, reason };
  }