"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { transitionStandard } from "@/lib/motion";
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import { AutoHideScroll } from "@/components/auto-hide-scroll";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  StatusBadge,
  stageLabel,
  stageTone,
} from "@/components/ui-bits/status-badge";
import { MinutesLeft } from "@/components/ui-bits/minutes-left";
import { LawyerAvatar } from "@/components/ui-bits/lawyer-avatar";
import { useDashboardActions } from "@/components/actions-provider";
import { MatterReference } from "@/components/matter-reference";
import { formatMatterFee } from "@/lib/format";
import type { LawyerLoad, MatterStatus } from "@/lib/supabase";
import { cn } from "cn";

export type MattersFilter =
  | "all"
  | "at-risk"
  | "unassigned"
  | "in-flight"
  | "delivered"
  | "over-capacity";

const PAGE_SIZE = 25;

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
  },
});

const columnHelper = createColumnHelper<typeof features, MatterStatus>();

function shortLawyerName(name: string | null): string {
  if (!name) return "Unassigned";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/** Matches the overview at-risk count: breached plus watch ≤ 20m. */
export function isAtRisk(m: MatterStatus): boolean {
  if (m.stage === "delivered") return false;
  if (m.risk === "breach") return true;
  return m.risk === "watch" && m.minutes_remaining <= 20;
}

export function filterMatters(
  matters: MatterStatus[],
  filter: MattersFilter,
  search: string,
  lawyers: LawyerLoad[]
): MatterStatus[] {
  const overIds = new Set(
    lawyers.filter((l) => l.capacityState === "over").map((l) => l.id)
  );
  const q = search.trim().toLowerCase();

  return matters.filter((m) => {
    switch (filter) {
      case "at-risk":
        if (!isAtRisk(m)) return false;
        break;
      case "unassigned":
        if (m.lawyer_id || m.stage === "delivered") return false;
        break;
      case "in-flight":
        if (m.stage === "delivered") return false;
        break;
      case "delivered":
        if (m.stage !== "delivered") return false;
        break;
      case "over-capacity":
        if (!m.lawyer_id || !overIds.has(m.lawyer_id)) return false;
        break;
      default:
        break;
    }
    if (!q) return true;
    return (
      m.reference.toLowerCase().includes(q) ||
      m.client_name.toLowerCase().includes(q) ||
      m.type.toLowerCase().includes(q) ||
      m.service_line.toLowerCase().includes(q)
    );
  });
}

export function emptyFilterMessage(filter: MattersFilter, search: string): string {
  if (search.trim()) return "No matters match your search.";
  switch (filter) {
    case "at-risk":
      return "No matters at risk. The clock is clear.";
    case "unassigned":
      return "No unassigned matters.";
    case "in-flight":
      return "No matters in flight.";
    case "delivered":
      return "No delivered matters yet.";
    case "over-capacity":
      return "No matters on lawyers who are over capacity.";
    default:
      return "No matters to show.";
  }
}

function ariaSortValue(
  sorted: false | "asc" | "desc"
): "none" | "ascending" | "descending" {
  if (sorted === "asc") return "ascending";
  if (sorted === "desc") return "descending";
  return "none";
}

function MatterCard({
  matter,
  highlight,
  onAssign,
  onNudge,
  onClientUpdate,
  nudging,
  now,
}: {
  matter: MatterStatus;
  highlight: boolean;
  onAssign: (id: string, mode: "assign" | "reassign") => void;
  onNudge: (vars: {
    matterId: string;
    reference: string;
    lawyerName: string;
  }) => void;
  onClientUpdate: (matter: MatterStatus) => void;
  nudging: boolean;
  now: number;
}) {
  const recentlyDelivered =
    matter.stage === "delivered" &&
    matter.delivered_at != null &&
    now - new Date(matter.delivered_at).getTime() <= 60 * 60 * 1000;

  return (
    <Card
      id={`matter-row-${matter.reference}`}
      className={cn(
        "gap-3 rounded-lg p-4 [--card-spacing:0px]",
        highlight && "bg-surface-selected ring-1 ring-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <MatterReference reference={matter.reference} className="font-semibold" />
          <p
            className="mt-0.5 truncate text-text-secondary"
            style={{ fontSize: "var(--text-12)" }}
          >
            {matter.client_name || "—"}
          </p>
        </div>
        <StatusBadge tone={stageTone(matter.stage)}>
          {stageLabel(matter.stage)}
        </StatusBadge>
      </div>
      <div
        className="grid grid-cols-2 gap-x-3 gap-y-1 text-text-secondary"
        style={{ fontSize: "var(--text-11)" }}
      >
        <span>{matter.service_line || "—"}</span>
        <span className="text-right">{matter.type || "—"}</span>
        <span>
          {matter.lawyer_id ? (
            <Link
              href={`/lawyers?id=${encodeURIComponent(matter.lawyer_id)}`}
              className="inline-flex items-center gap-1.5 text-foreground underline-offset-2 hover:underline"
            >
              <LawyerAvatar
                lawyerId={matter.lawyer_id}
                name={matter.lawyer_name ?? "Lawyer"}
                initials={matter.lawyer_initials}
                size="sm"
                className="rounded-[7px] after:rounded-[7px]"
              />
              {shortLawyerName(matter.lawyer_name)}
            </Link>
          ) : (
            <span className="text-text-tertiary">Unassigned</span>
          )}
        </span>
        <span className="text-right">
          <MinutesLeft
            minutes={matter.minutes_remaining}
            delivered={matter.stage === "delivered"}
          />
        </span>
        <span
          className={cn(
            "col-span-2 num",
            matter.fee > 0 ? "text-foreground" : "text-text-tertiary"
          )}
        >
          {formatMatterFee(matter.fee)}
        </span>
      </div>
      {recentlyDelivered ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11 w-full"
          onClick={() => onClientUpdate(matter)}
        >
          Update client
        </Button>
      ) : !matter.lawyer_id ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11 w-full"
          onClick={() => onAssign(matter.id, "assign")}
        >
          Assign
        </Button>
      ) : isAtRisk(matter) ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11 w-full"
          disabled={nudging}
          onClick={() =>
            onNudge({
              matterId: matter.id,
              reference: matter.reference,
              lawyerName: matter.lawyer_name ?? "the lawyer",
            })
          }
        >
          Nudge
        </Button>
      ) : null}
    </Card>
  );
}

export function MattersTable({
  matters,
  lawyers,
  filter,
  search,
  highlightRef,
  onShowAll,
}: {
  matters: MatterStatus[];
  lawyers: LawyerLoad[];
  filter: MattersFilter;
  search: string;
  highlightRef: string | null;
  onShowAll: () => void;
}) {
  const { openAssign, nudgeMatter, nudgingMatterId, openClientUpdate } =
    useDashboardActions();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "submitted_at", desc: true },
  ]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [now] = useState(() => Date.now());
  const hasAnimated = useRef(false);

  const filtered = useMemo(
    () => filterMatters(matters, filter, search, lawyers),
    [matters, filter, search, lawyers]
  );

  const columns = useMemo(
    () =>
      columnHelper.columns([
      columnHelper.accessor("reference", {
        header: "Reference",
        cell: (info) => (
          <MatterReference
            reference={info.getValue()}
            className="font-medium"
          />
        ),
      }),
            columnHelper.accessor("submitted_at", {
        header: "Submitted",
        sortFn: "alphanumeric",
      }),
columnHelper.accessor("client_name", {
        header: "Client",
        cell: (info) => {
          const v = info.getValue();
          return v ? v : <span className="text-text-tertiary">—</span>;
        },
      }),
      columnHelper.accessor("service_line", {
        header: "Service line",
        cell: (info) => {
          const v = info.getValue();
          return v ? (
            <span className="text-text-secondary" style={{ fontSize: "var(--text-12)" }}>
              {v}
            </span>
          ) : (
            <span className="text-text-tertiary">—</span>
          );
        },
      }),
      columnHelper.accessor("type", {
        header: "Type",
        enableSorting: false,
        cell: (info) => {
          const v = info.getValue();
          return v ? (
            <span className="text-text-secondary" style={{ fontSize: "var(--text-12)" }}>
              {v}
            </span>
          ) : (
            <span className="text-text-tertiary">—</span>
          );
        },
      }),
      columnHelper.accessor("stage", {
        header: "Stage",
        cell: (info) => (
          <StatusBadge tone={stageTone(info.getValue())}>
            {stageLabel(info.getValue())}
          </StatusBadge>
        ),
      }),
      columnHelper.accessor("lawyer_name", {
        header: "Lawyer",
        sortFn: "alphanumeric",
        cell: (info) => {
          const row = info.row.original;
          if (!row.lawyer_id) {
            return (
              <span className="text-text-tertiary">Unassigned</span>
            );
          }
          return (
            <Link
              href={`/lawyers?id=${encodeURIComponent(row.lawyer_id)}`}
              className="flex items-center gap-2 text-foreground underline-offset-2 hover:underline"
            >
              <LawyerAvatar
                lawyerId={row.lawyer_id}
                name={row.lawyer_name ?? "Lawyer"}
                initials={row.lawyer_initials}
                size="sm"
                className="rounded-[7px] after:rounded-[7px]"
              />
              <span>{shortLawyerName(row.lawyer_name)}</span>
            </Link>
          );
        },
      }),
      columnHelper.accessor("minutes_remaining", {
        header: "Left",
        cell: (info) => (
          <MinutesLeft
            minutes={info.getValue()}
            delivered={info.row.original.stage === "delivered"}
          />
        ),
      }),
      columnHelper.accessor("fee", {
        header: "Fee",
        cell: (info) => (
          <span
            className={cn(
              "block text-right",
              info.getValue() > 0 ? "num" : "text-text-tertiary"
            )}
          >
            {formatMatterFee(info.getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: "action",
        header: () => <span className="sr-only">Action</span>,
        cell: (info) => {
          const m = info.row.original;
          const recentlyDelivered =
            m.stage === "delivered" &&
            m.delivered_at != null &&
            now - new Date(m.delivered_at).getTime() <= 60 * 60 * 1000;

          if (recentlyDelivered) {
            return (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openClientUpdate(m, "delivered")}
              >
                Update client
              </Button>
            );
          }
          if (!m.lawyer_id) {
            return (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openAssign(m.id, "assign")}
              >
                Assign
              </Button>
            );
          }
          if (isAtRisk(m)) {
            return (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={nudgingMatterId === m.id}
                onClick={() =>
                  nudgeMatter({
                    matterId: m.id,
                    reference: m.reference,
                    lawyerName: m.lawyer_name ?? "the lawyer",
                  })
                }
              >
                Nudge
              </Button>
            );
          }
          return null;
        },
      }),
    ]),
    [openAssign, nudgeMatter, nudgingMatterId, openClientUpdate, now]
  );

  const table = useTable(
    {
      features,
      columns,
      data: filtered,
      state: { sorting, pagination },
      onSortingChange: setSorting,
      onPaginationChange: setPagination,
      // Keep page index under our control — auto-reset fights Next clicks when
      // the table wrapper identity changes every render.
      autoResetPageIndex: false,
    },
    (state) => ({
      sorting: state.sorting,
      pagination: state.pagination,
    })
  );

  // Reset page when the filter or search changes.
  useEffect(() => {
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }
    );
  }, [filter, search]);

  // Land on the page that holds the highlighted reference.
  // Do not depend on `table`: TanStack's useTable returns a new wrapper each
  // render, and an unconditional setPagination({...}) then re-fires forever.
  useEffect(() => {
    if (!highlightRef) return;
    const rows = table.getSortedRowModel().rows;
    const idx = rows.findIndex(
      (r) => r.original.reference.toLowerCase() === highlightRef.toLowerCase()
    );
    if (idx < 0) return;
    const nextPage = Math.floor(idx / PAGE_SIZE);
    setPagination((prev) =>
      prev.pageIndex === nextPage ? prev : { ...prev, pageIndex: nextPage }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- table identity is unstable; filtered + sorting cover the inputs
  }, [highlightRef, filtered, sorting]);

  const pageIndex = pagination.pageIndex;

  // Scroll once the highlighted row is on the current page. Guard so refetch
  // or unrelated filtered churn does not keep calling scrollIntoView.
  const scrolledHighlight = useRef<string | null>(null);
  useEffect(() => {
    if (!highlightRef) {
      scrolledHighlight.current = null;
      return;
    }
    if (scrolledHighlight.current === highlightRef) return;
    const el = document.getElementById(`matter-row-${highlightRef}`);
    if (!el) return;
    scrolledHighlight.current = highlightRef;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightRef, pageIndex, filtered]);

  if (filtered.length === 0) {
    return (
      <Card className="gap-0 rounded-lg py-0 [--card-spacing:0px]">
        <div
          className="flex flex-col items-center justify-center gap-3 px-4 text-center"
          style={{ paddingBlock: 32 }}
        >
          <p
            className="text-text-secondary"
            style={{ fontSize: "var(--text-13)" }}
          >
            {emptyFilterMessage(filter, search)}
          </p>
          {filter !== "all" || search.trim() ? (
            <Button type="button" variant="ghost" size="sm" onClick={onShowAll}>
              Show all matters
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }

  const pageRows = table.getRowModel().rows;
  const total = filtered.length;
  const from = pageIndex * PAGE_SIZE + 1;
  const to = Math.min((pageIndex + 1) * PAGE_SIZE, total);

  const shouldStagger = !hasAnimated.current;
  if (!hasAnimated.current) hasAnimated.current = true;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2 md:hidden">
        <label htmlFor="matters-sort" className="sr-only">
          Sort matters
        </label>
        <Select
          value={
            sorting[0]
              ? `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`
              : "submitted_at:desc"
          }
          onValueChange={(v) => {
            const [id, dir] = v.split(":");
            setSorting([{ id, desc: dir === "desc" }]);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        >
          <SelectTrigger
            id="matters-sort"
            className="h-11 min-h-11 w-full"
            style={{ fontSize: "var(--text-13)" }}
          >
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="submitted_at:desc">Newest first</SelectItem>
            <SelectItem value="submitted_at:asc">Oldest first</SelectItem>
            <SelectItem value="reference:asc">Reference A–Z</SelectItem>
            <SelectItem value="reference:desc">Reference Z–A</SelectItem>
            <SelectItem value="client_name:asc">Client A–Z</SelectItem>
            <SelectItem value="client_name:desc">Client Z–A</SelectItem>
            <SelectItem value="service_line:asc">Service line A–Z</SelectItem>
            <SelectItem value="service_line:desc">Service line Z–A</SelectItem>
            <SelectItem value="minutes_remaining:asc">Least time left</SelectItem>
            <SelectItem value="minutes_remaining:desc">Most time left</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AutoHideScroll className="min-h-0 flex-1 md:hidden">
        <ul className="flex flex-col gap-2 pb-1">
          {pageRows.map((row) => {
            const m = row.original;
            const isHL =
              Boolean(highlightRef) &&
              m.reference.toLowerCase() === highlightRef!.toLowerCase();
            return (
              <li key={row.id}>
                <MatterCard
                  matter={m}
                  highlight={isHL}
                  now={now}
                  nudging={nudgingMatterId === m.id}
                  onAssign={openAssign}
                  onNudge={nudgeMatter}
                  onClientUpdate={(matter) =>
                    openClientUpdate(matter, "delivered")
                  }
                />
              </li>
            );
          })}
        </ul>
      </AutoHideScroll>

      {/* Card keeps overflow-visible so ring + hover shadow match the original. */}
      <Card className="hidden min-h-0 flex-1 gap-0 rounded-lg py-0 [--card-spacing:0px] md:flex">
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg">
          <AutoHideScroll className="h-full min-h-0">
            {/* Plain <table> (not Table wrapper) so sticky header can pin to
                this scroll parent — Table's overflow-x wrapper breaks sticky. */}
            <table className="w-full caption-bottom text-sm">
              <TableHeader>
                {table.getHeaderGroups().map((group) => (
                  <TableRow
                    key={group.id}
                    className="border-border hover:bg-transparent"
                  >
                    {group.headers
                      .filter((header) => header.column.id !== "submitted_at")
                      .map((header) => {
                      const canSort = header.column.getCanSort();
                      const sorted = header.column.getIsSorted();
                      return (
                        <TableHead
                          key={header.id}
                          scope="col"
                          aria-sort={
                            canSort ? ariaSortValue(sorted) : undefined
                          }
                          className={cn(
                            "sticky top-0 z-10 h-auto bg-card px-4 py-2.5 font-medium text-text-tertiary",
                            header.column.id === "fee" && "text-right",
                            canSort && "cursor-pointer select-none"
                          )}
                          style={{ fontSize: "var(--text-11)" }}
                          onClick={
                            canSort
                              ? header.column.getToggleSortingHandler()
                              : undefined
                          }
                        >
                          <span className="inline-flex items-center gap-1">
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                            {canSort ? (
                              <span
                                className="inline-flex text-text-tertiary"
                                aria-hidden
                              >
                                {sorted === "asc" ? (
                                  <ArrowUp className="size-3.5 text-foreground" />
                                ) : sorted === "desc" ? (
                                  <ArrowDown className="size-3.5 text-foreground" />
                                ) : (
                                  <ArrowUpDown className="size-3.5 opacity-40" />
                                )}
                              </span>
                            ) : null}
                          </span>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {pageRows.map((row, index) => {
                  const m = row.original;
                  const isHL =
                    Boolean(highlightRef) &&
                    m.reference.toLowerCase() === highlightRef!.toLowerCase();
                  return (
                    <motion.tr
                      key={row.id}
                      id={`matter-row-${m.reference}`}
                      initial={shouldStagger ? { opacity: 0, y: 4 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        ...transitionStandard,
                        delay: shouldStagger ? Math.min(index * 0.03, 0.3) : 0,
                      }}
                      className={cn(
                        "border-0 transition-colors duration-[var(--motion-duration)] ease-[var(--motion-ease-out)] hover:bg-surface-hover",
                        isHL && "bg-surface-selected"
                      )}
                      style={
                        {
                          height: 46,
                          borderBottom:
                            index < pageRows.length - 1
                              ? "1px solid var(--table-inner-line)"
                              : undefined,
                        } as CSSProperties
                      }
                    >
                      {row
                        .getAllCells()
                        .filter((cell) => cell.column.id !== "submitted_at")
                        .map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "px-4 py-0",
                            cell.column.id === "fee" && "text-right",
                            cell.column.id === "action" && "text-right"
                          )}
                          style={{ fontSize: "var(--text-13)" }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </motion.tr>
                  );
                })}
              </TableBody>
            </table>
          </AutoHideScroll>
        </div>
      </Card>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p
          className="text-text-tertiary"
          style={{ fontSize: "var(--text-12)" }}
        >
          Showing{" "}
          <span className="num">
            {from} to {to}
          </span>{" "}
          of <span className="num">{total}</span>
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!table.getCanPreviousPage()}
            aria-label={`Go to page ${pageIndex}`}
            onClick={() => table.previousPage()}
          >
            Previous
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!table.getCanNextPage()}
            aria-label={`Go to page ${pageIndex + 2}`}
            onClick={() => table.nextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MattersTableSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ul className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="gap-3 rounded-lg p-4 [--card-spacing:0px]">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-11 w-full" />
          </Card>
        ))}
      </ul>
      <Card className="hidden min-h-0 flex-1 gap-0 rounded-lg py-0 [--card-spacing:0px] md:flex">
        <div className="space-y-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4"
              style={{
                height: 46,
                borderBottom:
                  i < 7 ? "1px solid var(--table-inner-line)" : undefined,
              }}
            >
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-5 w-12 rounded-md" />
              <Skeleton className="ml-auto h-3.5 w-14" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
