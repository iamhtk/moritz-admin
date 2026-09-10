"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CapacityMeter } from "@/components/ui-bits/capacity-meter";
import { LawyerAvatar } from "@/components/ui-bits/lawyer-avatar";
import type { LawyerLoad } from "@/lib/supabase";
import { useDashboardActions } from "@/components/actions-provider";
import { useIsMobile } from "@/hooks/use-mobile";

const PREVIEW_DESKTOP = 5;
const PREVIEW_MOBILE = 5;

/**
 * Four-column row needs roughly this much content width (avatar + name +
 * stacked meter + "7 of 8" + Reassign + padding). Below this, switch to a
 * stacked row layout instead of compressing columns.
 */
const TABLE_MIN_WIDTH = 460;

function LawyerAction({
  lawyer,
  mobile,
}: {
  lawyer: LawyerLoad;
  mobile?: boolean;
}) {
  const { openAssignForLawyer } = useDashboardActions();

  if (lawyer.capacityState === "over") {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={mobile ? "min-h-11" : undefined}
        onClick={() => openAssignForLawyer(lawyer.id)}
      >
        Reassign
      </Button>
    );
  }

  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className={mobile ? "min-h-11" : undefined}
    >
      <Link href={`/lawyers?id=${encodeURIComponent(lawyer.id)}`}>View</Link>
    </Button>
  );
}

function LawyerNameLink({ lawyer }: { lawyer: LawyerLoad }) {
  return (
    <Link
      href={`/lawyers?id=${encodeURIComponent(lawyer.id)}`}
      className="font-medium text-pretty leading-tight text-foreground underline-offset-2 hover:underline"
      style={{ fontSize: "var(--text-13)" }}
    >
      {lawyer.name}
    </Link>
  );
}

function LawyerCard({ lawyer }: { lawyer: LawyerLoad }) {
  return (
    <Card className="flex flex-col gap-3 rounded-lg p-4 [--card-spacing:0px]">
      <div className="flex min-w-0 items-center gap-2.5">
        <LawyerAvatar
          lawyerId={lawyer.id}
          name={lawyer.name}
          initials={lawyer.initials}
          size="lg"
        />
        <div className="min-w-0">
          <LawyerNameLink lawyer={lawyer} />
          <div
            className="text-text-tertiary"
            style={{ fontSize: "var(--text-11)" }}
          >
            {lawyer.practice_areas[0]}
          </div>
        </div>
      </div>
      <CapacityMeter
        pct={lawyer.utilizationPct}
        state={lawyer.capacityState}
        label={lawyer.capacityLabel}
        name={lawyer.name}
        active={lawyer.activeMatters}
        capacity={lawyer.weekly_capacity}
        layout="stacked"
      />
      <div className="flex items-center justify-between gap-3">
        <div
          className="flex flex-wrap gap-x-4 gap-y-1 text-text-secondary"
          style={{ fontSize: "var(--text-11)" }}
        >
          <span>
            This week{" "}
            <span className="num font-medium text-foreground">
              {lawyer.delivered_this_week} of {lawyer.weekly_target}
            </span>
          </span>
        </div>
        <LawyerAction lawyer={lawyer} mobile />
      </div>
    </Card>
  );
}

/** Compact stacked row for narrow desktop containers (same fields, no table). */
function LawyerStackedRow({
  lawyer,
  showDivider,
}: {
  lawyer: LawyerLoad;
  showDivider: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-2 px-4 py-3"
      style={{
        borderBottom: showDivider
          ? "1px solid var(--table-inner-line)"
          : undefined,
      }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <LawyerAvatar
          lawyerId={lawyer.id}
          name={lawyer.name}
          initials={lawyer.initials}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <LawyerNameLink lawyer={lawyer} />
          <div
            className="text-text-tertiary"
            style={{ fontSize: "var(--text-11)" }}
          >
            {lawyer.practice_areas[0]}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <CapacityMeter
            pct={lawyer.utilizationPct}
            state={lawyer.capacityState}
            label={lawyer.capacityLabel}
            name={lawyer.name}
            active={lawyer.activeMatters}
            capacity={lawyer.weekly_capacity}
            layout="stacked"
          />
          <div
            className="flex flex-wrap gap-x-4 gap-y-0.5 text-text-secondary"
            style={{ fontSize: "var(--text-11)" }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default">
                  This week{" "}
                  <span className="num font-medium text-foreground">
                    {lawyer.delivered_this_week} of {lawyer.weekly_target}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                Matters delivered this week against their weekly target.
                Moritz bills flat fees per matter, so the target is matters
                delivered, not billable hours.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <LawyerAction lawyer={lawyer} />
      </div>
    </div>
  );
}

export function CapacityTable({
  lawyers,
  minRows,
}: {
  lawyers: LawyerLoad[];
  /**
   * Desktop table sits beside the deadline list in a stretched grid row, so a
   * short preview leaves blank space below the "Show more" footer once the
   * card is forced up to the taller sibling's height. Pass the sibling's row
   * count here so we show that many lawyers instead of leaving a gap.
   */
  minRows?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [stacked, setStacked] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const desktopPreview = Math.min(
    lawyers.length,
    Math.max(PREVIEW_DESKTOP, minRows ?? 0)
  );
  const preview = isMobile ? PREVIEW_MOBILE : desktopPreview;
  const hasMore = lawyers.length > preview && lawyers.length - preview >= 3;
  const visible = expanded || !hasMore ? lawyers : lawyers.slice(0, preview);
  const remaining = lawyers.length - preview;
  const showFooter = hasMore;

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => {
      setStacked(el.clientWidth > 0 && el.clientWidth < TABLE_MIN_WIDTH);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lawyers.length]);

  if (lawyers.length === 0) {
    return (
      <Card className="gap-0 rounded-lg py-8 [--card-spacing:0px]">
        <p
          className="px-4 text-center text-text-secondary"
          style={{ fontSize: "var(--text-13)" }}
        >
          No co-counsel to show yet.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {visible.map((lawyer) => (
          <LawyerCard key={lawyer.id} lawyer={lawyer} />
        ))}
        {showFooter ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 w-full text-text-secondary"
            style={{ fontSize: "var(--text-12)" }}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              "Show less"
            ) : (
              <>
                Show <span className="num">{remaining}</span> more
              </>
            )}
          </Button>
        ) : null}
      </div>

      {/* Outer wrapper owns the width measure — Card is not forwardRef. */}
      <div
        ref={cardRef}
        className="hidden h-full min-w-0 md:block"
        data-capacity-host=""
      >
        <Card className="flex h-full min-w-0 flex-col gap-0 overflow-hidden rounded-lg py-0 [--card-spacing:0px]">
          {stacked ? (
            <div className="min-w-0 flex-1" data-capacity-layout="stacked">
              {visible.map((lawyer, index) => (
                <LawyerStackedRow
                  key={lawyer.id}
                  lawyer={lawyer}
                  showDivider={index < visible.length - 1}
                />
              ))}
            </div>
          ) : (
            <div className="min-w-0 flex-1" data-capacity-layout="table">
              <Table className="min-w-0 w-full table-fixed [&_td]:whitespace-normal [&_th]:whitespace-normal">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead
                      scope="col"
                      className="h-auto w-[42%] px-3 py-2.5 font-medium text-text-tertiary"
                      style={{ fontSize: "var(--text-11)" }}
                    >
                      Lawyer
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="h-auto w-[28%] px-2 py-2.5 font-medium text-text-tertiary"
                      style={{ fontSize: "var(--text-11)" }}
                    >
                      Capacity
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="h-auto w-[16%] px-2 py-2.5 text-right font-medium text-text-tertiary"
                      style={{ fontSize: "var(--text-11)" }}
                    >
                      This week
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="h-auto w-[14%] px-2 py-2.5 text-right font-medium text-text-tertiary"
                      style={{ fontSize: "var(--text-11)" }}
                    >
                      <span className="sr-only">Action</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((lawyer, index) => (
                    <TableRow
                      key={lawyer.id}
                      className="group/row h-12 border-0 hover:bg-surface-hover"
                      style={{
                        borderBottom:
                          index < visible.length - 1
                            ? "1px solid var(--table-inner-line)"
                            : undefined,
                      }}
                    >
                      <TableCell className="px-3 py-0">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <LawyerAvatar
                            lawyerId={lawyer.id}
                            name={lawyer.name}
                            initials={lawyer.initials}
                            size="md"
                          />
                          <div className="min-w-0">
                            <LawyerNameLink lawyer={lawyer} />
                            <div
                              className="text-text-tertiary"
                              style={{ fontSize: "var(--text-11)" }}
                            >
                              {lawyer.practice_areas[0]}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-0 px-2 py-0">
                        <CapacityMeter
                          pct={lawyer.utilizationPct}
                          state={lawyer.capacityState}
                          label={lawyer.capacityLabel}
                          name={lawyer.name}
                          active={lawyer.activeMatters}
                          capacity={lawyer.weekly_capacity}
                          layout="stacked"
                        />
                      </TableCell>
                      <TableCell className="px-2 py-0 text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="num cursor-default whitespace-nowrap">
                              {lawyer.delivered_this_week} of{" "}
                              {lawyer.weekly_target}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            Matters delivered this week against their weekly
                            target. Moritz bills flat fees per matter, so the
                            target is matters delivered, not billable hours.
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="px-2 py-0 text-right">
                        <LawyerAction lawyer={lawyer} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {showFooter ? (
            <div
              className="mt-auto px-4 py-2"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-text-secondary"
                style={{ fontSize: "var(--text-12)" }}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? (
                  "Show less"
                ) : (
                  <>
                    Show <span className="num">{remaining}</span> more
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}

export function CapacityTableSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="gap-3 rounded-lg p-4 [--card-spacing:0px]">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-8 w-full" />
          </Card>
        ))}
      </div>
      <Card className="hidden h-full min-w-0 flex-col gap-0 rounded-lg py-0 [--card-spacing:0px] md:flex">
        <div
          className="grid grid-cols-[1.6fr_1.2fr_auto_auto] gap-4 px-4 py-2.5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-14" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex h-12 items-center gap-4 px-4"
            style={{
              borderBottom:
                i < 4 ? "1px solid var(--table-inner-line)" : undefined,
            }}
          >
            <div className="flex flex-1 items-center gap-2.5">
              <Skeleton className="size-7 rounded-[9px]" />
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-7 w-14" />
          </div>
        ))}
      </Card>
    </>
  );
}
