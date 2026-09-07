"use client";

import { Progress } from "@/components/ui/progress";
import {
  StatusBadge,
  type StatusTone,
} from "@/components/ui-bits/status-badge";
import { cn } from "cn";
import type { CapacityState } from "@/lib/supabase";

const fillByState: Record<CapacityState, string> = {
  room: "[&_[data-slot=progress-indicator]]:bg-[var(--capacity-fill-ok)]",
  high: "[&_[data-slot=progress-indicator]]:bg-[var(--capacity-fill-watch)]",
  over: "[&_[data-slot=progress-indicator]]:bg-[var(--capacity-fill-over)]",
};

const toneByState: Record<CapacityState, StatusTone> = {
  room: "ok",
  high: "watch",
  over: "risk",
};

/** Visual max so 100% and 133% are distinguishable (100% ≈ 2/3 of the track). */
const BAR_MAX_PCT = 150;

export function CapacityMeter({
  pct,
  state,
  label,
  name,
  compact = false,
  layout = "inline",
}: {
  pct: number;
  state: CapacityState;
  label: string;
  name: string;
  compact?: boolean;
  /** stacked = full-width track with label/pct above (lawyer cards). */
  layout?: "inline" | "stacked";
}) {
  const fillWidth = Math.min(Math.max(pct, 0) / BAR_MAX_PCT, 1) * 100;
  const tickAtCapacity = (100 / BAR_MAX_PCT) * 100;
  const tickAtWatch = (80 / BAR_MAX_PCT) * 100;

  const track = (
    <div
      className="relative"
      style={{
        width: layout === "stacked" ? "100%" : "var(--capacity-track-w)",
        flex: layout === "stacked" ? undefined : "none",
      }}
    >
      <Progress
        value={fillWidth}
        aria-hidden
        className={cn(
          "bg-[var(--capacity-track)]",
          layout === "stacked" ? "w-full" : "w-[var(--capacity-track-w)]",
          "h-[var(--capacity-track-h)]",
          fillByState[state]
        )}
      />
      <div
        className="pointer-events-none absolute inset-y-0 z-[1]"
        style={{
          left: `${tickAtWatch}%`,
          width: "1px",
          background: "var(--capacity-tick)",
          opacity: 0.55,
        }}
        aria-hidden
        title="80% watch"
      />
      <div
        className="pointer-events-none absolute inset-y-0 z-[1]"
        style={{
          left: `${tickAtCapacity}%`,
          width: "1.5px",
          background: "var(--capacity-tick)",
          opacity: 0.95,
        }}
        aria-hidden
        title="100% capacity"
      />
    </div>
  );

  if (layout === "stacked") {
    return (
      <div
        className="w-full space-y-2"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={BAR_MAX_PCT}
        aria-label={`${name} at ${pct} percent of capacity`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="text-text-secondary"
            style={{ fontSize: "var(--text-12)" }}
          >
            Capacity
          </span>
          <span
            className="num text-text-secondary"
            style={{ fontSize: "var(--text-12)" }}
          >
            {pct}%
          </span>
        </div>
        {track}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2.5"
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={BAR_MAX_PCT}
      aria-label={`${name} at ${pct} percent of capacity`}
    >
      {track}
      {compact ? (
        <span
          className="num text-text-secondary"
          style={{ fontSize: "var(--text-11)" }}
        >
          {pct}%
        </span>
      ) : (
        <StatusBadge tone={toneByState[state]}>
          <span className="num">
            {label} · {pct}%
          </span>
        </StatusBadge>
      )}
    </div>
  );
}
