"use client";

import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { FinanceDayRow } from "@/lib/supabase";

const chartConfig = {
  revenue: { label: "Cumulative revenue" },
} satisfies ChartConfig;

import { formatFeeDollars } from "@/lib/format";

function formatCurrency(n: number) {
  return formatFeeDollars(n);
}

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatAxisCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

export function RevenueChart({
  days,
  target,
  revenueToDate,
  pctOfTarget,
  projectedPct,
  daysLeft,
}: {
  days: FinanceDayRow[];
  target: number;
  revenueToDate: number;
  pctOfTarget: number;
  projectedPct: number;
  daysLeft: number;
}) {
  const hasAnimated = useRef(false);
  const [isAnimationActive, setIsAnimationActive] = useState(false);

  useEffect(() => {
    if (!hasAnimated.current) {
      hasAnimated.current = true;
      setIsAnimationActive(true);
      const t = setTimeout(() => setIsAnimationActive(false), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const data = days.reduce<
    { date: string; revenue: number }[]
  >((acc, d) => {
    const prev = acc.at(-1)?.revenue ?? 0;
    acc.push({ date: d.date, revenue: prev + Number(d.revenue) });
    return acc;
  }, []);

  const lastIndex = data.length - 1;
  const running = data.at(-1)?.revenue ?? revenueToDate;

  return (
    <Card className="h-full flex flex-col gap-0 rounded-lg p-4 [--card-spacing:0px]">
      <p
        className="mb-2 font-medium text-text-secondary"
        style={{ fontSize: "var(--text-11)" }}
      >
        Cumulative revenue this month (matches Revenue to date)
      </p>
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-40 w-full"
        aria-label="Cumulative fee revenue this month against the monthly target"
      >
        <AreaChart
          data={data}
          margin={{ top: 8, right: 12, left: 28, bottom: 8 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--chart-grid)"
            strokeDasharray="0"
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickFormatter={formatShortDate}
            tick={{
              fill: "var(--chart-axis-text)",
              fontSize: 10,
            }}
            height={36}
            interval="preserveStartEnd"
            label={{
              value: "Day",
              position: "insideBottomRight",
              offset: 0,
              fill: "var(--chart-axis-text)",
              fontSize: 10,
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={formatAxisCurrency}
            tick={{
              fill: "var(--chart-axis-text)",
              fontSize: 10,
            }}
            width={44}
            domain={[0, Math.max(target * 1.05, running * 1.1)]}
            label={{
              value: "Revenue ($)",
              angle: -90,
              position: "left",
              offset: 16,
              fill: "var(--chart-axis-text)",
              fontSize: 10,
            }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const date = payload?.[0]?.payload?.date as string | undefined;
                  return date ? formatShortDate(date) : "";
                }}
                formatter={(value) => (
                  <span className="num font-medium text-foreground">
                    {formatCurrency(Number(value))}
                  </span>
                )}
              />
            }
          />
          <ReferenceLine
            y={target}
            stroke="var(--chart-target-line)"
            strokeDasharray="3 3"
            label={{
              value: `Target ${formatCurrency(target)}`,
              position: "insideTopRight",
              fill: "var(--chart-axis-text)",
              fontSize: 11,
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--chart-revenue-line)"
            strokeWidth={1.75}
            fill="var(--chart-revenue-area)"
            isAnimationActive={isAnimationActive}
            animationDuration={900}
            animationEasing="ease-out"
            dot={(props) => {
              const { cx, cy, index } = props;
              if (index !== lastIndex || cx == null || cy == null) {
                return <g key={`dot-${index}`} />;
              }
              return (
                <circle
                  key={`dot-${index}`}
                  cx={cx}
                  cy={cy}
                  r={3.5}
                  fill="var(--chart-revenue-line)"
                />
              );
            }}
            activeDot={{ r: 3.5, fill: "var(--chart-revenue-line)" }}
          />
        </AreaChart>
      </ChartContainer>
      <p
        className="text-text-secondary"
        style={{ fontSize: "var(--text-12)", marginTop: "10px" }}
      >
        Revenue is <span className="num">{pctOfTarget}</span> percent of target
        with <span className="num">{daysLeft}</span> days left. On pace for{" "}
        <span className="num">{projectedPct}</span> percent. End point{" "}
        <span className="num">{formatCurrency(running)}</span> matches the tile
        below.
      </p>
    </Card>
  );
}

export function RevenueChartSkeleton() {
  return (
    <Card className="h-full flex flex-col gap-0 rounded-lg p-4 [--card-spacing:0px]">
      <Skeleton className="h-3 w-56" />
      <Skeleton className="mt-2 h-40 w-full rounded-md" />
      <Skeleton className="mt-2.5 h-3 w-4/5 max-w-md" />
    </Card>
  );
}
