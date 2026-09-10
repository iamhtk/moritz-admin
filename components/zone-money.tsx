"use client";

import { AlertCircle } from "lucide-react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { ZoneLabel } from "@/components/ui-bits/zone-label";
import {
  RevenueChart,
  RevenueChartSkeleton,
} from "@/components/revenue-chart";
import {
  DeliveredChart,
  DeliveredChartSkeleton,
} from "@/components/delivered-chart";
import { MoneyStrip, MoneyStripSkeleton } from "@/components/money-strip";
import { UnquotedRow } from "@/components/unquoted-row";
import { useOverview } from "@/hooks/use-overview";
import type { FinanceDayRow } from "@/lib/supabase";
import { cn } from "cn";

function monthNameFromDays(days: FinanceDayRow[]) {
  const sample = days.at(-1);
  if (!sample) {
    return new Date().toLocaleDateString("en-GB", { month: "long" });
  }
  return new Date(`${sample.date}T12:00:00`).toLocaleDateString("en-GB", {
    month: "long",
  });
}

function priorMonthName(days: FinanceDayRow[]) {
  const sample = days.at(-1);
  const base = sample
    ? new Date(`${sample.date}T12:00:00`)
    : new Date();
  const prior = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  return prior.toLocaleDateString("en-GB", { month: "long" });
}

function daysLeftInMonth(from: Date = new Date()) {
  const last = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
  return Math.max(0, last - from.getDate());
}

export function ZoneMoney({
  className,
  hideLabel = false,
}: {
  className?: string;
  hideLabel?: boolean;
}) {
  const { data, error, isPending, refetch, isFetching } = useOverview();

  if (isPending) {
    return (
      <section aria-label="Money" className={cn("mt-6 md:mt-8", className)}>
        <ZoneLabel
          title="Money"
          meta={hideLabel ? undefined : "Loading…"}
          visuallyHidden={hideLabel}
        />
        <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
          <RevenueChartSkeleton />
          <DeliveredChartSkeleton />
        </div>
        <MoneyStripSkeleton />
      </section>
    );
  }

  if (error || !data) {
    return (
      <section aria-label="Money" className={cn("mt-6 md:mt-8", className)}>
        <ZoneLabel title="Money" visuallyHidden={hideLabel} />
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Couldn&apos;t load the firm overview.</AlertTitle>
          <AlertDescription>
            Check the connection and try again.
          </AlertDescription>
          <AlertAction>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 md:min-h-8"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              Retry
            </Button>
          </AlertAction>
        </Alert>
      </section>
    );
  }

  const { finance, config } = data;
  const month = monthNameFromDays(finance.days);
  const priorMonth = priorMonthName(finance.days);
  const daysLeft = daysLeftInMonth();
  const draft = formatDuration(finance.avgDraftMinutes);
  const review = formatDuration(finance.avgReviewMinutes);
  const meta = (
    <>
      {month} · flat fees per matter, not billable hours
      {data.ai.predictedVolume.weeksUsed > 0 ? (
        <>
          {" · "}≈{data.ai.predictedVolume.estimate} new matters next week.{" "}
          {data.ai.predictedVolume.basis}.
        </>
      ) : null}
    </>
  );

  return (
    <section aria-label="Money" className={cn("mt-6 md:mt-8", className)}>
      <ZoneLabel
        title="Money"
        meta={hideLabel ? undefined : meta}
        visuallyHidden={hideLabel}
      />
      {hideLabel ? (
        <p
          className="mb-3 text-text-tertiary"
          style={{ fontSize: "var(--text-11)" }}
        >
          {meta}
        </p>
      ) : null}

      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
        <RevenueChart
          days={finance.revenueDays?.length ? finance.revenueDays : finance.days}
          target={finance.target}
          revenueToDate={finance.revenueToDate}
          pctOfTarget={finance.pctOfTarget}
          projectedPct={finance.projectedPct}
          daysLeft={daysLeft}
        />
        <DeliveredChart
          days={finance.days}
          dailyPlan={config.dailyDeliveryPlan}
          deliveredThisWeek={finance.deliveredThisWeek}
          plannedThisWeek={finance.plannedThisWeek}
        />
      </div>

      <MoneyStrip
        finance={finance}
        daysLeft={daysLeft}
        priorMonth={priorMonth}
      />

      {finance.avgDraftMinutes > 0 || finance.avgReviewMinutes > 0 ? (
        <p
          className="text-text-secondary"
          style={{ fontSize: "var(--text-12)", marginTop: "10px" }}
        >
          Average <span className="num">{draft}</span> in draft,{" "}
          <span className="num">{review}</span> in lawyer review.
        </p>
      ) : null}

      <UnquotedRow unquoted={finance.unquoted} />
    </section>
  );
}
