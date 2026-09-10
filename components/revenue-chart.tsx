"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  MoneyChartCard,
  MoneyChartCardSkeleton,
  useMoneyChartNarrow,
} from "@/components/ui-bits/money-chart-card";
import { formatFeeDollars } from "@/lib/format";
import type { FinanceDayRow } from "@/lib/supabase";

const chartConfig = {
  revenue: { label: "Cumulative revenue" },
} satisfies ChartConfig;

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

function formatCompactDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return String(d.getDate());
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
  const narrow = useMoneyChartNarrow();

  const data = useMemo(
    () =>
      days.reduce<{ date: string; revenue: number }[]>((acc, d) => {
        const prev = acc.at(-1)?.revenue ?? 0;
        acc.push({ date: d.date, revenue: prev + Number(d.revenue) });
        return acc;
      }, []),
    [days]
  );

  const lastPoint = data.at(-1);
  const running = lastPoint?.revenue ?? revenueToDate;

  const yDomain = useMemo(
    () => [0, Math.max(target * 1.05, running * 1.1)] as [number, number],
    [target, running]
  );

  return (
    <MoneyChartCard
      title="Cumulative revenue this month"
      ariaLabel="Cumulative fee revenue this month against the monthly target"
      config={chartConfig}
      caption={
        <>
          Revenue is <span className="num">{pctOfTarget}</span> percent of
          target with <span className="num">{daysLeft}</span> days left. On
          pace for <span className="num">{projectedPct}</span> percent.
        </>
      }
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
          tickFormatter={narrow ? formatCompactDate : formatShortDate}
          interval="preserveStartEnd"
          minTickGap={narrow ? 28 : 12}
          tick={{
            fill: "var(--chart-axis-text)",
            fontSize: 10,
          }}
          height={36}
          label={
            narrow
              ? undefined
              : {
                  value: "Day",
                  position: "insideBottomRight",
                  offset: 0,
                  fill: "var(--chart-axis-text)",
                  fontSize: 10,
                }
          }
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
          domain={yDomain}
          label={
            narrow
              ? undefined
              : {
                  value: "Revenue ($)",
                  angle: -90,
                  position: "left",
                  offset: 16,
                  fill: "var(--chart-axis-text)",
                  fontSize: 10,
                }
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const date = payload?.[0]?.payload?.date as
                  | string
                  | undefined;
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
            value: narrow ? `Target` : `Target ${formatCurrency(target)}`,
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
          // Default isAnimationActive="auto" respects prefers-reduced-motion.
          dot={false}
          activeDot={{ r: 3.5, fill: "var(--chart-revenue-line)" }}
        />
        {lastPoint ? (
          <ReferenceDot
            x={lastPoint.date}
            y={lastPoint.revenue}
            r={3.5}
            fill="var(--chart-revenue-line)"
            stroke="none"
            ifOverflow="visible"
          />
        ) : null}
      </AreaChart>
    </MoneyChartCard>
  );
}

export function RevenueChartSkeleton() {
  return (
    <MoneyChartCardSkeleton
      titleClassName="w-56"
      captionClassName="w-4/5 max-w-md"
    />
  );
}
