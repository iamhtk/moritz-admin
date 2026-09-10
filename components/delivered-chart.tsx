"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import type { FinanceDayRow } from "@/lib/supabase";

const chartConfig = {
  delivered: { label: "Delivered" },
} satisfies ChartConfig;

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function weekdayLetter(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "narrow" });
}

export function DeliveredChart({
  days,
  dailyPlan,
  deliveredThisWeek,
  plannedThisWeek,
}: {
  days: FinanceDayRow[];
  dailyPlan: number;
  deliveredThisWeek: number;
  plannedThisWeek: number;
}) {
  const narrow = useMoneyChartNarrow();

  const data = useMemo(
    () =>
      days.slice(-7).map((d) => {
        const weekend = d.planned_delivered === 0;
        // Weekend zeros need a 2px stub so the day reads as present, not missing.
        const stub =
          weekend && d.delivered === 0
            ? Math.max(dailyPlan * 0.04, 0.15)
            : 0;
        return {
          ...d,
          weekend,
          bar: d.delivered > 0 ? d.delivered : stub,
        };
      }),
    [days, dailyPlan]
  );

  const cells = useMemo(
    () =>
      data.map((d) => (
        <Cell
          key={d.date}
          fill={
            d.weekend
              ? "var(--fjord-200)"
              : "var(--chart-delivered-bar)"
          }
        />
      )),
    [data]
  );

  const yDomain = useMemo(
    () =>
      [
        0,
        (dataMax: number) =>
          Math.max(
            Number.isFinite(dataMax) ? dataMax : 0,
            dailyPlan,
            1
          ),
      ] as [number, (max: number) => number],
    [dailyPlan]
  );

  return (
    <MoneyChartCard
      title="Matters delivered · last 7 days"
      ariaLabel="Matters delivered per day over the last seven calendar days against the daily plan"
      config={chartConfig}
      caption={
        <>
          <span className="num">{deliveredThisWeek}</span> matters delivered
          in the last 7 days against a plan of{" "}
          <span className="num">{plannedThisWeek}</span>.
        </>
      }
    >
      <BarChart
        data={data}
        margin={{ top: 8, right: 64, left: 0, bottom: 8 }}
      >
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="date"
          tickFormatter={weekdayLetter}
          minTickGap={narrow ? 8 : 4}
          tickLine={false}
          axisLine={false}
          tick={{
            fill: "var(--chart-axis-text)",
            fontSize: 11,
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
          width={28}
          allowDecimals={false}
          domain={yDomain}
          tick={{
            fill: "var(--chart-axis-text)",
            fontSize: 10,
          }}
          label={
            narrow
              ? undefined
              : {
                  value: "Matters",
                  angle: -90,
                  position: "insideLeft",
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
              formatter={(_value, _name, item) => (
                <span className="num font-medium text-foreground">
                  {Number(item?.payload?.delivered ?? 0)} delivered
                </span>
              )}
            />
          }
        />
        <ReferenceLine
          y={dailyPlan}
          ifOverflow="extendDomain"
          stroke="var(--chart-target-line)"
          strokeDasharray="3 3"
          label={{
            value: narrow ? `Plan ${dailyPlan}` : `Plan ${dailyPlan} a day`,
            position: "right",
            offset: 6,
            fill: "var(--chart-axis-text)",
            fontSize: 11,
          }}
        />
        <Bar dataKey="bar" radius={[3, 3, 0, 0]} maxBarSize={28}>
          {cells}
        </Bar>
      </BarChart>
    </MoneyChartCard>
  );
}

export function DeliveredChartSkeleton() {
  return (
    <MoneyChartCardSkeleton
      titleClassName="w-52"
      captionClassName="w-3/5 max-w-sm"
    />
  );
}
