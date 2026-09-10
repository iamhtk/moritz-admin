"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/ui-bits/sparkline";
import { AnimatedNumber } from "@/components/ui-bits/animated-number";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatFeeDollars } from "@/lib/format";
import { cn } from "cn";
import type { OverviewPayload } from "@/lib/supabase";

type Finance = OverviewPayload["finance"];

function formatCurrency(n: number) {
  return formatFeeDollars(n);
}

export function MoneyStrip({
  finance,
  daysLeft,
  priorMonth,
}: {
  finance: Finance;
  daysLeft: number;
  priorMonth: string;
}) {
  const net = finance.openedThisMonth - finance.closedThisMonth;
  const cells: {
    label: string;
    value: ReactNode;
    sub: ReactNode;
    fullWidthMobile?: boolean;
  }[] = [
    {
      label: "Revenue to date",
      value: (
        <AnimatedNumber
          value={finance.revenueToDate}
          format={formatCurrency}
          className="font-semibold text-foreground"
        />
      ),
      sub: (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="cursor-help text-left underline decoration-dotted decoration-border underline-offset-2"
            >
              <span className="num">{finance.pctOfTarget}</span>% of target
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {finance.revenueDrivers.length >= 1 ? (
              <>
                On pace mainly due to{" "}
                {finance.revenueDrivers.length === 1
                  ? "one large matter"
                  : "two large matters"}{" "}
                closing this month:{" "}
                {finance.revenueDrivers
                  .map((d) => `${d.reference} (${formatCurrency(d.fee)})`)
                  .join(" and ")}
                . Sum of delivered matter fees this month vs the monthly target.
              </>
            ) : (
              <>
                Sum of all delivered matter fees this month versus the monthly
                target. No individual delivered matters this month to name as
                drivers.
              </>
            )}
          </TooltipContent>
        </Tooltip>
      ),
    },
    {
      label: "Target",
      value: (
        <AnimatedNumber
          value={finance.target}
          format={formatCurrency}
          className="font-semibold text-foreground"
        />
      ),
      sub: (
        <>
          <span className="num">{daysLeft}</span> days left
        </>
      ),
    },
    {
      label: "Average fee",
      value: (
        <AnimatedNumber
          value={finance.avgFee}
          format={formatCurrency}
          className="font-semibold text-foreground"
        />
      ),
      sub: (
        <>
          up $<span className="num">{finance.avgFeeDelta}</span> vs {priorMonth}
        </>
      ),
    },
    {
      label: "Margin per matter",
      value: (
        <span className="font-semibold text-foreground">
          <AnimatedNumber value={finance.marginPct} />%
        </span>
      ),
      sub: (
        <>
          payout <span className="num">{finance.payoutPct}</span>%
        </>
      ),
    },
    {
      label: "Opened vs closed",
      value: (
        <span className="font-semibold text-foreground">
          <AnimatedNumber value={finance.openedThisMonth} />
          {" / "}
          <AnimatedNumber value={finance.closedThisMonth} />
        </span>
      ),
      sub: (
        <>
          net +<span className="num">{net}</span> in flight
        </>
      ),
      fullWidthMobile: true,
    },
  ];

  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2 md:hidden">
        {cells.map((cell) => (
          <Card
            key={cell.label}
            className={cn(
              "gap-0 rounded-lg p-4 [--card-spacing:0px]",
              cell.fullWidthMobile && "col-span-2"
            )}
          >
            <div
              className="font-medium text-text-secondary"
              style={{ fontSize: "var(--text-11)" }}
            >
              {cell.label}
            </div>
            <div
              className="num"
              style={{ fontSize: "var(--text-20)", marginTop: "4px" }}
            >
              {cell.value}
            </div>
            <div
              className="text-text-tertiary"
              style={{ fontSize: "var(--text-11)", marginTop: "4px" }}
            >
              {cell.sub}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-3 hidden gap-0 rounded-lg py-0 [--card-spacing:0px] md:block">
        <div className="grid grid-cols-5">
          {cells.map((cell, i) => (
            <div
              key={cell.label}
              className={cn(
                "px-4 py-3",
                i < cells.length - 1 && "border-r border-border"
              )}
            >
              <div
                className="font-medium text-text-secondary"
                style={{ fontSize: "var(--text-11)" }}
              >
                {cell.label}
              </div>
              <div
                className="num"
                style={{
                  fontSize: "var(--text-20)",
                  marginTop: "4px",
                }}
              >
                {cell.value}
              </div>
              <div
                className="text-text-tertiary"
                style={{ fontSize: "var(--text-11)", marginTop: "4px" }}
              >
                {cell.sub}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

export function MoneyStripSkeleton() {
  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card
            key={i}
            className={cn(
              "space-y-2 rounded-lg p-4 [--card-spacing:0px]",
              i === 4 && "col-span-2"
            )}
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-24" />
          </Card>
        ))}
      </div>
      <Card className="mt-3 hidden gap-0 rounded-lg py-0 [--card-spacing:0px] md:block">
        <div className="grid grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "space-y-2 px-4 py-3",
                i < 4 && "border-r border-border"
              )}
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

/** Compact mobile chart stand-in: big number + sparkline + caption. */
export function MobileChartStat({
  label,
  value,
  spark,
  caption,
}: {
  label: string;
  value: ReactNode;
  spark: number[];
  caption: ReactNode;
}) {
  return (
    <Card className="gap-0 rounded-lg p-4 [--card-spacing:0px] md:hidden">
      <div
        className="font-medium text-text-secondary"
        style={{ fontSize: "var(--text-11)" }}
      >
        {label}
      </div>
      <div className="mt-2 min-w-0 overflow-hidden">
        <div data-stat>{value}</div>
        <div className="mt-1 min-w-0 overflow-hidden">
          <Sparkline values={spark} />
        </div>
      </div>
      <p
        className="mt-2 text-text-secondary"
        style={{ fontSize: "var(--text-12)" }}
      >
        {caption}
      </p>
    </Card>
  );
}
