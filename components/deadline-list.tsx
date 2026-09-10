"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
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
import { StatusBadge } from "@/components/ui-bits/status-badge";
import { MinutesLeft } from "@/components/ui-bits/minutes-left";
import { MatterReference } from "@/components/matter-reference";
import { useDashboardActions } from "@/components/actions-provider";
import type { MatterStatus } from "@/lib/supabase";

function shortLawyerName(name: string | null): string {
  if (!name) return "Unassigned";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return `${first} ${lastInitial}.`;
}

/** Client-side slip signal. Must match server `likelyToSlip` in lib/queries.ts. */
function isLikelyToSlip(m: MatterStatus, slaMinutes: number): boolean {
  if (m.risk !== "ok" && m.risk !== "watch") return false;
  if (!m.on_time_rate) return false;
  if (m.stage === "delivered") return false;
  const elapsedPct = 1 - m.minutes_remaining / slaMinutes;
  return elapsedPct > 0.5 && m.stage !== "review" && m.on_time_rate < 0.85;
}

const SLIP_BASIS =
  "Past halfway on the clock, still drafting, and this lawyer's on-time rate is under 85 percent.";

const MotionRow = motion.create(TableRow);

export function DeadlineList({
  deadlines,
  slaMinutes,
}: {
  deadlines: MatterStatus[];
  slaMinutes: number;
}) {
  const reduceMotion = useReducedMotion();
  const { openAssign, nudgeMatter, nudgingMatterId } = useDashboardActions();

  if (deadlines.length === 0) {
    return (
      <Card className="flex h-full min-w-0 flex-col gap-0 rounded-lg py-0 [--card-spacing:0px]">
        <p
          className="px-4 py-8 text-center text-text-secondary"
          style={{ fontSize: "var(--text-13)" }}
        >
          Nothing due in the next four hours.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="md:hidden">
        <p
          className="mb-2 font-medium text-text-tertiary"
          style={{ fontSize: "var(--text-11)" }}
        >
          Due next 4 hours
        </p>
        <ul className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {deadlines.map((matter) => {
              const slip = isLikelyToSlip(matter, slaMinutes);
              const pastDue = matter.minutes_remaining < 0;
              const nudging = matter.id === nudgingMatterId;
              const lowConfidence =
                matter.stage === "review" &&
                matter.draft_confidence != null &&
                matter.draft_confidence < 0.72;

              return (
                <motion.li
                  key={matter.id}
                  layout={!reduceMotion}
                  initial={false}
                  exit={
                    reduceMotion
                      ? undefined
                      : { opacity: 0, height: 0, overflow: "hidden" }
                  }
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <Card className="flex flex-col gap-2 rounded-lg p-4 [--card-spacing:0px]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div
                          className="font-semibold text-foreground"
                          style={{ fontSize: "var(--text-13)" }}
                        >
                          <MatterReference reference={matter.reference} className="font-semibold" />
                        </div>
                        <div
                          className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-text-secondary"
                          style={{ fontSize: "var(--text-12)" }}
                        >
                          <span className="line-clamp-2">
                            {matter.client_name} ·{" "}
                            {shortLawyerName(matter.lawyer_name)}
                            {slip ? (
                              <>
                                {" · "}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-default underline decoration-dotted underline-offset-2">
                                      likely to slip
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="bottom"
                                    className="max-w-xs"
                                  >
                                    {SLIP_BASIS}
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            ) : null}
                          </span>
                          {lowConfidence ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex shrink-0">
                                  <StatusBadge tone="watch">
                                    Low confidence
                                  </StatusBadge>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="bottom"
                                className="max-w-xs"
                              >
                                Draft confidence{" "}
                                <span className="num">
                                  {Math.round(matter.draft_confidence! * 100)}
                                </span>{" "}
                                percent,{" "}
                                <span className="num">
                                  {matter.flagged_clauses}
                                </span>{" "}
                                clauses flagged for review. Low confidence
                                drafts take longer to finalise.
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                        </div>
                      </div>
                      <MinutesLeft minutes={matter.minutes_remaining} />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11 w-full"
                      disabled={nudging}
                      onClick={() => {
                        if (pastDue) {
                          openAssign(matter.id, "reassign");
                        } else {
                          nudgeMatter({
                            matterId: matter.id,
                            reference: matter.reference,
                            lawyerName: matter.lawyer_name ?? "the lawyer",
                          });
                        }
                      }}
                    >
                      {nudging ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Nudge
                        </>
                      ) : pastDue ? (
                        "Reassign"
                      ) : (
                        "Nudge"
                      )}
                    </Button>
                  </Card>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>

      <Card className="hidden h-full min-w-0 flex-col gap-0 overflow-hidden rounded-lg py-0 [--card-spacing:0px] md:flex">
        <div className="min-w-0 overflow-x-auto">
        <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead
              scope="col"
              className="h-auto px-4 py-2.5 font-medium whitespace-normal text-text-tertiary"
              style={{ fontSize: "var(--text-11)" }}
            >
              Due next 4 hours
            </TableHead>
            <TableHead
              scope="col"
              className="hidden h-auto w-[4.5rem] px-4 py-2.5 text-right font-medium text-text-tertiary min-[1500px]:table-cell"
              style={{ fontSize: "var(--text-11)" }}
            >
              Left
            </TableHead>
            <TableHead
              scope="col"
              className="hidden h-auto px-4 py-2.5 text-right font-medium text-text-tertiary min-[1500px]:table-cell"
              style={{ fontSize: "var(--text-11)" }}
            >
              <span className="sr-only">Action</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <AnimatePresence initial={false}>
            {deadlines.map((matter) => {
              const slip = isLikelyToSlip(matter, slaMinutes);
              const pastDue = matter.minutes_remaining < 0;
              const nudging = matter.id === nudgingMatterId;
              const lowConfidence =
                matter.stage === "review" &&
                matter.draft_confidence != null &&
                matter.draft_confidence < 0.72;

              const actionButton = (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={nudging}
                  onClick={() => {
                    if (pastDue) {
                      openAssign(matter.id, "reassign");
                    } else {
                      nudgeMatter({
                        matterId: matter.id,
                        reference: matter.reference,
                        lawyerName: matter.lawyer_name ?? "the lawyer",
                      });
                    }
                  }}
                >
                  {nudging ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Nudge
                    </>
                  ) : pastDue ? (
                    "Reassign"
                  ) : (
                    "Nudge"
                  )}
                </Button>
              );

              return (
                <MotionRow
                  key={matter.id}
                  layout={!reduceMotion}
                  initial={false}
                  exit={
                    reduceMotion
                      ? undefined
                      : { opacity: 0, height: 0, overflow: "hidden" }
                  }
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="border-0 hover:bg-surface-hover"
                  style={{
                    borderBottom: "1px solid var(--table-inner-line)",
                  }}
                >
                  <TableCell className="px-4 py-2.5 align-middle whitespace-normal">
                    <div className="min-w-0">
                      <div
                        className="font-semibold text-foreground"
                        style={{ fontSize: "var(--text-13)" }}
                      >
                        <MatterReference reference={matter.reference} className="font-semibold" />
                      </div>
                      <div
                        className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-text-secondary"
                        style={{ fontSize: "var(--text-12)" }}
                      >
                        <span className="min-w-0">
                          {matter.client_name} ·{" "}
                          {shortLawyerName(matter.lawyer_name)}
                          {slip ? (
                            <>
                              {" · "}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-default underline decoration-dotted underline-offset-2">
                                    likely to slip
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="bottom"
                                  className="max-w-xs"
                                >
                                  {SLIP_BASIS}
                                </TooltipContent>
                              </Tooltip>
                            </>
                          ) : null}
                        </span>
                        {lowConfidence ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex shrink-0">
                                <StatusBadge tone="watch">
                                  Low confidence
                                </StatusBadge>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              className="max-w-xs"
                            >
                              Draft confidence{" "}
                              <span className="num">
                                {Math.round(matter.draft_confidence! * 100)}
                              </span>{" "}
                              percent,{" "}
                              <span className="num">
                                {matter.flagged_clauses}
                              </span>{" "}
                              clauses flagged for review. Low confidence drafts
                              take longer to finalise.
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                      {/* Below ~1500px: fold Left + action under the matter line. */}
                      <div className="mt-2 flex items-center justify-between gap-3 min-[1500px]:hidden">
                        <MinutesLeft minutes={matter.minutes_remaining} />
                        {actionButton}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden w-[4.5rem] px-4 py-2.5 text-right align-middle min-[1500px]:table-cell">
                    <div className="flex justify-end">
                      <MinutesLeft minutes={matter.minutes_remaining} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden px-4 py-2.5 text-right align-middle min-[1500px]:table-cell">
                    {actionButton}
                  </TableCell>
                </MotionRow>
              );
            })}
          </AnimatePresence>
        </TableBody>
      </Table>
        </div>
    </Card>
    </>
  );
}

export function DeadlineListSkeleton() {
  return (
    <Card className="flex h-full min-w-0 flex-col gap-0 rounded-lg py-0 [--card-spacing:0px]">
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-10" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-2.5"
          style={{
            borderBottom:
              i < 5 ? "1px solid var(--table-inner-line)" : undefined,
          }}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-40 max-w-full" />
          </div>
          <Skeleton className="h-5 w-12 rounded-md" />
          <Skeleton className="h-7 w-14" />
        </div>
      ))}
    </Card>
  );
}
