"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
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
  StatusBadge,
  stageLabel,
  stageTone,
} from "@/components/ui-bits/status-badge";
import { MinutesLeft } from "@/components/ui-bits/minutes-left";
import { LawyerAvatar } from "@/components/ui-bits/lawyer-avatar";
import { useDashboardActions } from "@/components/actions-provider";
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

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

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
  const [sorting, setSorting] = useState<SortingState>([]);
  const [now] = useState(() => Date.now());

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
          <span
            className="font-medium text-foreground"
            style={{ fontSize: "var(--text-13)" }}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("client_name", {
        header: "Client",
      }),
      columnHelper.accessor("service_line", {
        header: "Service line",
        cell: (info) => (
          <span
            className="text-text-secondary"
            style={{ fontSize: "var(--text-12)" }}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("type", {
        header: "Type",
        enableSorting: false,
        cell: (info) => (
          <span
            className="text-text-secondary"
            style={{ fontSize: "var(--text-12)" }}
          >
            {info.getValue()}
          </span>
        ),
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
            <div className="flex items-center gap-2">
              <LawyerAvatar
                lawyerId={row.lawyer_id}
                name={row.lawyer_name ?? "Lawyer"}
                initials={row.lawyer_initials}
                size="sm"
                className="rounded-[7px] after:rounded-[7px]"
              />
              <span>{shortLawyerName(row.lawyer_name)}</span>
            </div>
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
          <span className="num block text-right">
            {formatCurrency(info.getValue())}
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
      state: { sorting },
      onSortingChange: setSorting,
      initialState: {
        pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
      },
    },
    (state) => ({
      sorting: state.sorting,
      pagination: state.pagination,
    })
  );

  // Reset page when the filter or search changes.
  useEffect(() => {
    table.setPageIndex(0);
  }, [filter, search, table]);

  // Land on the page that holds the highlighted reference.
  useEffect(() => {
    if (!highlightRef) return;
    const rows = table.getSortedRowModel().rows;
    const idx = rows.findIndex(
      (r) => r.original.reference.toLowerCase() === highlightRef.toLowerCase()
    );
    if (idx < 0) return;
    table.setPageIndex(Math.floor(idx / PAGE_SIZE));
  }, [highlightRef, filtered, table]);

  const pageIndex = table.state.pagination.pageIndex;

  useEffect(() => {
    if (!highlightRef) return;
    const id = `matter-row-${highlightRef}`;
    const el = document.getElementById(id);
    if (!el) return;
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

  return (
    <div className="space-y-3">
      <Card className="gap-0 rounded-lg py-0 [--card-spacing:0px]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow
                key={group.id}
                className="border-border hover:bg-transparent"
              >
                {group.headers.map((header) => {
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
                        "h-auto px-4 py-2.5 font-medium text-text-tertiary",
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
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
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
                <TableRow
                  key={row.id}
                  id={`matter-row-${m.reference}`}
                  className={cn(
                    "border-0 transition-colors duration-500 hover:bg-surface-hover",
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
                  {row.getAllCells().map((cell) => (
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
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
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
    <Card className="gap-0 rounded-lg py-0 [--card-spacing:0px]">
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
  );
}
