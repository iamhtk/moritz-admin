"use client";

import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "cn";
import type { CapacityState } from "@/lib/supabase";

const fillByState: Record<CapacityState, string> = {
  // Room is the normal state: muted fill, no status hue.
  room: "[&_[data-slot=progress-indicator]]:bg-[var(--capacity-fill-quiet)]",
  high: "[&_[data-slot=progress-indicator]]:bg-[var(--capacity-fill-watch)]",
  over: "[&_[data-slot=progress-indicator]]:bg-[var(--capacity-fill-over)]",
};

const labelColorByState: Record<Exclude<CapacityState, "room">, string> = {
  high: "var(--status-watch-fg)",
  over: "var(--status-risk-fg)",
};

/** Visual max so 100% and 133% are distinguishable (100% ≈ 2/3 of the track). */
const BAR_MAX_PCT = 150;

export function CapacityMeter({
  pct,
  state,
  label,
  name,
  active,
  capacity,
  compact: _compact = false,
  layout = "inline",
  showTooltip = true,
}: {
  pct: number;
  state: CapacityState;
  label: string;
  name: string;
  active: number;
  capacity: number;
  /** Kept for callers; exceptional rows always show a state word. */
  compact?: boolean;
  /** stacked = full-width track with label/ratio above (lawyer cards). */
  layout?: "inline" | "stacked";
  /** Disable when nested inside another control (e.g. assign candidate button). */
  showTooltip?: boolean;
}) {
  const fillWidth = Math.min(Math.max(pct, 0) / BAR_MAX_PCT, 1) * 100;
  const tickAtCapacity = (100 / BAR_MAX_PCT) * 100;
  const tickAtWatch = (80 / BAR_MAX_PCT) * 100;
  const ratio = `${active} of ${capacity}`;
  const exceptional = state !== "room";

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

  // Exceptional rows: plain status-coloured text (no pill). The bar carries
  // magnitude; the word keeps colour from being the sole signal.
  const labelRow = exceptional ? (
    <span
      className="num font-medium"
      style={{
        fontSize: "var(--text-11)",
        color: labelColorByState[state],
      }}
    >
      {label} · {ratio}
    </span>
  ) : (
    <span
      className="num text-text-secondary"
      style={{ fontSize: "var(--text-11)" }}
    >
      {ratio}
    </span>
  );

  const meter = (
    <div
      className={
        layout === "stacked"
          ? "w-full space-y-2"
          : "flex items-center gap-2.5"
      }
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={BAR_MAX_PCT}
      aria-label={`${name}: ${label}, ${ratio} (${pct} percent of capacity)`}
    >
      {layout === "stacked" ? (
        <>
          <div className="flex items-baseline justify-between gap-2">
            {labelRow}
          </div>
          {track}
        </>
      ) : (
        <>
          {track}
          {labelRow}
        </>
      )}
    </div>
  );

  if (!showTooltip) return meter;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={layout === "stacked" ? "w-full" : "inline-flex"}>
          {meter}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <span className="num">{pct}</span> percent of weekly capacity (
        <span className="num">{ratio}</span> active matters).
      </TooltipContent>
    </Tooltip>
  );
}
