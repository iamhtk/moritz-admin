"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ZoneLabel } from "@/components/ui-bits/zone-label";
import {
  CapacityTable,
  CapacityTableSkeleton,
} from "@/components/capacity-table";
import {
  DeadlineList,
  DeadlineListSkeleton,
} from "@/components/deadline-list";
import { useOverview } from "@/hooks/use-overview";
import { cn } from "cn";

export function ZonePeople({
  className,
  hideLabel = false,
}: {
  className?: string;
  hideLabel?: boolean;
}) {
  const { data, error, isPending, refetch, isFetching } = useOverview();
  const gridRef = useRef<HTMLDivElement>(null);
  const [autoRows, setAutoRows] = useState<number>();

  // The lawyer table sits beside the deadline table in a stretched grid row.
  // Its own row height is fixed, but the deadline table's rows aren't (some
  // wrap to two lines), so a fixed preview count leaves a gap between the
  // last lawyer row and the "Show more" footer once the card is stretched to
  // match. Measure the deadline table's actual height and size the lawyer
  // preview to fill it, instead of guessing a row count.
  useEffect(() => {
    const el = gridRef.current;
    if (!el || !data) return;

    const recompute = () => {
      const tables = el.querySelectorAll("table");
      const stackedHost = el.querySelector("[data-capacity-layout=stacked]");
      const deadlineTable = stackedHost
        ? tables[0]
        : tables.length > 1
          ? tables[1]
          : tables[0];
      if (!deadlineTable) return;
      const deadlineH = deadlineTable.getBoundingClientRect().height;

      if (stackedHost) {
        const rowH =
          stackedHost.firstElementChild?.getBoundingClientRect().height ?? 0;
        if (!rowH) return;
        setAutoRows(Math.max(0, Math.ceil(deadlineH / rowH)));
        return;
      }

      const lawyerTable = el.querySelector(
        "[data-capacity-layout=table] table"
      );
      if (!lawyerTable) return;
      const rowH =
        lawyerTable.querySelector("tbody tr")?.getBoundingClientRect()
          .height ?? 0;
      if (!rowH) return;
      const headerH =
        lawyerTable.querySelector("thead")?.getBoundingClientRect().height ??
        0;
      setAutoRows(Math.max(0, Math.ceil((deadlineH - headerH) / rowH)));
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  if (isPending) {
    return (
      <section aria-label="People" className={cn("mt-6 md:mt-8", className)}>
        <ZoneLabel
          title="People"
          meta={hideLabel ? undefined : "Loading…"}
          visuallyHidden={hideLabel}
        />
        <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <CapacityTableSkeleton />
          <DeadlineListSkeleton />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section aria-label="People" className={cn("mt-6 md:mt-8", className)}>
        <ZoneLabel title="People" visuallyHidden={hideLabel} />
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

  const forecast = data.ai.capacityForecast;
  const weekly = data.ai.weeklyCapacityForecast;
  const meta = (
    <span className="flex flex-col gap-0.5">
      <span>
        {data.lawyers.length} co-counsel · sorted by load
        {forecast ? ` · ${forecast}` : ""}
      </span>
      {weekly ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default">{weekly.text}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {weekly.tooltip}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );

  return (
    <section aria-label="People" className={cn("mt-6 md:mt-8", className)}>
      <ZoneLabel
        title="People"
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
      <div
        ref={gridRef}
        className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
      >
        <CapacityTable
          lawyers={data.lawyers}
          minRows={autoRows ?? data.deadlines.length}
        />
        <DeadlineList
          deadlines={data.deadlines}
          slaMinutes={data.config.slaMinutes}
        />
      </div>
    </section>
  );
}
