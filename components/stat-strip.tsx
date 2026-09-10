"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { formatDuration, formatFeeDollars } from "@/lib/format";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkline } from "@/components/ui-bits/sparkline";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui-bits/animated-number";
import type { OverviewPayload } from "@/lib/supabase";
import { cn } from "cn";

type Stats = OverviewPayload["stats"];

function StatValue({
  value,
  tooltip,
  risk,
}: {
  value: number;
  tooltip: string;
  risk?: boolean;
}) {
  const inner = (
    <span
      data-stat
      className="inline-flex cursor-default items-center gap-1.5"
    >
      {risk && value > 0 ? (
        <span
          aria-hidden
          className="pulse-dot size-2 shrink-0 rounded-full"
          style={{ background: "var(--status-risk-fill)" }}
        />
      ) : null}
      <AnimatedNumber value={value} risk={risk} />
    </span>
  );

  if (!tooltip) return inner;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function StatStrip({ stats }: { stats: Stats }) {
  const cells: {
    label: string;
    value: number;
    description: ReactNode;
    trend: number[] | null;
    tooltip: string;
    risk?: boolean;
  }[] = [
    {
      label: "In flight",
      value: stats.inFlight,
      description:
        stats.inFlight === 0 ? (
          <>no matters in flight</>
        ) : (
          <>
            across <span className="num">{stats.serviceLines}</span> service
            lines
          </>
        ),
      trend: stats.inFlightTrend,
      tooltip: "Matters not yet delivered, across every service line.",
    },
    {
      label: "Due next hour",
      value: stats.dueNextHour,
      description:
        stats.dueNextHour === 0 ? (
          <>nothing due in the next hour</>
        ) : (
          <>under 60 minutes left on the clock</>
        ),
      trend: stats.dueTrend,
      tooltip: "Matters with under 60 minutes left on the four hour clock.",
    },
    {
      label: "At risk",
      value: stats.atRisk,
      description:
        stats.atRisk === 0 ? (
          <>nothing past due or under 20 min</>
        ) : (
          <>
            <span className="num">{stats.breached}</span> past due,{" "}
            <span className="num">{stats.atRisk - stats.breached}</span> under
            20 min.{" "}
            <span className="num">{stats.atRisk}</span>{" "}
            {stats.atRisk === 1 ? "matter" : "matters"} currently at risk
            represent {formatFeeDollars(stats.atRiskFees)} in flat fees
          </>
        ),
      trend: null,
      tooltip:
        "Matters past due, or with under 20 minutes left on the four hour clock. Fee total is the sum of those matters' quoted flat fees.",
      risk: true,
    },
    {
      label: "Unassigned",
      value: stats.unassigned,
      description:
        stats.unassigned === 0 ? (
          <>no unassigned queue right now</>
        ) : (
          <>
            oldest arrived{" "}
            {formatDuration(stats.oldestUnassignedMinutes ?? 0)} ago
          </>
        ),
      trend: stats.unassignedTrend,
      tooltip: "Matters submitted with a fee but no lawyer yet.",
    },
  ];

  return (
    <>
      {/* Mobile: separate cards in a 2×2 grid */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        {cells.map((cell) => (
          <Card
            key={cell.label}
            className="min-w-0 gap-0 overflow-hidden rounded-lg p-4 [--card-spacing:0px]"
          >
            <div
              className="font-medium text-text-secondary"
              style={{ fontSize: "var(--text-11)" }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default underline decoration-dotted decoration-border underline-offset-2">
                    {cell.label}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">{cell.tooltip}</TooltipContent>
              </Tooltip>
            </div>
            <div className="mt-2 min-w-0 overflow-hidden">
              <StatValue
                value={cell.value}
                tooltip={cell.tooltip}
                risk={cell.risk}
              />
              {cell.trend ? (
                <div className="mt-1 min-w-0 overflow-hidden">
                  <Sparkline values={cell.trend} />
                </div>
              ) : null}
            </div>
            <div
              className="mt-2 text-text-tertiary"
              style={{ fontSize: "var(--text-11)" }}
            >
              {cell.description}
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop: joined strip */}
      <Card className="hidden gap-0 overflow-hidden rounded-lg py-0 [--card-spacing:0px] md:block">
        <div className="grid grid-cols-4">
          {cells.map((cell, i) => (
            <div
              key={cell.label}
              className={cn(
                "flex min-w-0 flex-col gap-2 overflow-hidden px-4 py-4",
                i < cells.length - 1 && "border-r border-border"
              )}
            >
              <div
                className="font-medium text-text-secondary"
                style={{ fontSize: "var(--text-12)" }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default underline decoration-dotted decoration-border underline-offset-2">
                      {cell.label}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{cell.tooltip}</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                <div className="shrink-0">
                  <StatValue
                    value={cell.value}
                    tooltip={cell.tooltip}
                    risk={cell.risk}
                  />
                </div>
                {cell.trend ? (
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <Sparkline values={cell.trend} />
                  </div>
                ) : null}
              </div>
              <div
                className="text-text-tertiary"
                style={{ fontSize: "var(--text-11)" }}
              >
                {cell.description}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

export function StatStripSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="gap-0 rounded-lg p-4 [--card-spacing:0px]">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-[34px] w-10" />
            <Skeleton className="mt-2 h-3 w-24" />
          </Card>
        ))}
      </div>
      <Card className="hidden gap-0 rounded-lg py-0 [--card-spacing:0px] md:block">
        <div className="grid grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex flex-col gap-2 px-4 py-4",
                i < 3 && "border-r border-border"
              )}
            >
              <Skeleton className="h-3 w-20" />
              <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                <Skeleton className="h-[34px] w-14 shrink-0" />
                <Skeleton className="h-6 w-full max-w-[76px] flex-1" />
              </div>
              <Skeleton className="h-3 w-36" />
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
