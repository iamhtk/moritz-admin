"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { useCommandState } from "cmdk";
import {
  AlertTriangle,
  FilePlus,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Search,
  Send,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { useOverview } from "@/hooks/use-overview";
import { useDashboardActions } from "@/components/actions-provider";

type Page = "root" | "assign" | "quote";
type RankKind = "entity" | "action" | "nav" | "filter";

const GROUP_CAP = 5;

/** Prefer prefix / substring matches; demote nav & filter vs entity records. */
function commandFilter(
  value: string,
  search: string,
  keywords?: string[]
): number {
  const q = search.trim().toLowerCase();
  if (!q) return 1;

  const hay = value.toLowerCase();
  const kind = (keywords?.[0] as RankKind | undefined) ?? "action";

  let score = 0;
  if (hay === q) {
    score = 1;
  } else if (hay.startsWith(q)) {
    score = 0.95;
  } else if (hay.split(/[\s·,/\-_]+/).some((w) => w.startsWith(q))) {
    score = 0.9;
  } else if (hay.includes(q)) {
    score = 0.7;
  } else {
    return 0;
  }

  if (kind === "entity") score *= 1.25;
  else if (kind === "action") score *= 1;
  else if (kind === "filter") score *= 0.45;
  else if (kind === "nav") score *= 0.35;

  return score;
}

function ResultCount() {
  const count = useCommandState((state) => state.filtered.count);
  const search = useCommandState((state) => state.search);
  if (!search.trim()) return null;
  return (
    <p
      className="px-3 pb-1 text-text-tertiary"
      style={{ fontSize: "var(--text-11)" }}
      aria-live="polite"
    >
      <span className="num">{count}</span>{" "}
      {count === 1 ? "result" : "results"}
    </p>
  );
}

function CappedGroup({
  heading,
  items,
  expanded,
  onExpand,
}: {
  heading: string;
  items: ReactElement[];
  expanded: boolean;
  onExpand: () => void;
}) {
  const search = useCommandState((state) => state.search);
  const searching = search.trim().length > 0;
  const remaining = items.length - GROUP_CAP;
  const visible =
    expanded || searching || remaining <= 0
      ? items
      : items.slice(0, GROUP_CAP);

  return (
    <CommandGroup heading={heading}>
      {visible}
      {!expanded && !searching && remaining > 0 ? (
        <CommandItem
          value={`${heading} show more`}
          keywords={["action"]}
          onSelect={() => onExpand()}
        >
          <span
            className="text-text-secondary"
            style={{ fontSize: "var(--text-12)" }}
          >
            Show <span className="num">{remaining}</span> more
          </span>
        </CommandItem>
      ) : null}
    </CommandGroup>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { data } = useOverview();
  const { openAssign, openQuote, openNewMatter, openChat } =
    useDashboardActions();
  const [page, setPage] = useState<Page>("root");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );

  if (!open && page !== "root") {
    setPage("root");
  }
  if (!open && Object.keys(expandedGroups).length > 0) {
    setExpandedGroups({});
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key !== "k" && key !== "j") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      if (key === "k") {
        onOpenChange(!open);
      } else {
        onOpenChange(false);
        openChat();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange, openChat]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const expand = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: true }));
  };

  const unassigned =
    data?.matters.filter((m) => !m.lawyer_id && m.fee > 0) ?? [];
  const unquoted = data?.finance.unquoted ?? [];
  const matters = useMemo(() => data?.matters ?? [], [data?.matters]);
  const lawyers = data?.lawyers ?? [];

  const matterItems = matters.map((m) => (
    <CommandItem
      key={m.id}
      value={`${m.reference} ${m.client_name} ${m.type}`}
      keywords={["entity"]}
      onSelect={() =>
        run(() => {
          if (!m.lawyer_id) {
            openAssign(m.id, "assign");
          } else {
            router.push(`/matters?ref=${encodeURIComponent(m.reference)}`);
          }
        })
      }
    >
      <FileText />
      <span>
        {m.reference} · {m.client_name}
      </span>
    </CommandItem>
  ));

  const lawyerItems = lawyers.map((l) => (
    <CommandItem
      key={l.id}
      value={l.name}
      keywords={["entity"]}
      onSelect={() =>
        run(() => router.push(`/lawyers?id=${encodeURIComponent(l.id)}`))
      }
    >
      <Users />
      <span>{l.name}</span>
    </CommandItem>
  ));

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Search actions, matters and lawyers"
      className="overflow-hidden p-0 sm:max-w-lg max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
    >
      <Command
        className="rounded-xl! bg-transparent max-sm:flex max-sm:h-full max-sm:flex-col max-sm:rounded-none!"
        key={page}
        filter={commandFilter}
      >
        <CommandInput
          aria-label={
            page === "assign"
              ? "Choose an unassigned matter"
              : page === "quote"
                ? "Choose a matter to quote"
                : "Search actions, matters, lawyers"
          }
          placeholder={
            page === "assign"
              ? "Choose an unassigned matter…"
              : page === "quote"
                ? "Choose a matter to quote…"
                : "Search actions, matters, lawyers…"
          }
        />
        <ResultCount />
        <CommandList className="max-sm:max-h-none max-sm:flex-1">
          <CommandEmpty>Nothing matches that.</CommandEmpty>

          {page === "assign" ? (
            <CommandGroup heading="Unassigned">
              {unassigned.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.reference} ${m.client_name}`}
                  keywords={["entity"]}
                  onSelect={() => run(() => openAssign(m.id, "assign"))}
                >
                  <UserPlus />
                  <span>
                    {m.reference} · {m.client_name}
                  </span>
                </CommandItem>
              ))}
              {unassigned.length === 0 ? (
                <CommandItem disabled value="none">
                  No unassigned matters
                </CommandItem>
              ) : null}
            </CommandGroup>
          ) : null}

          {page === "quote" ? (
            <CommandGroup heading="Unquoted">
              {unquoted.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.reference} ${m.client_name}`}
                  keywords={["entity"]}
                  onSelect={() =>
                    run(() =>
                      openQuote(m, {
                        suggestedFee: m.suggestedFee,
                        comparableCount: m.comparableCount,
                      })
                    )
                  }
                >
                  <Send />
                  <span>
                    {m.reference} · {m.client_name}
                  </span>
                </CommandItem>
              ))}
              {unquoted.length === 0 ? (
                <CommandItem disabled value="none">
                  No unquoted matters
                </CommandItem>
              ) : null}
            </CommandGroup>
          ) : null}

          {page === "root" ? (
            <>
              <CommandGroup heading="Actions">
                <CommandItem
                  keywords={["action"]}
                  onSelect={() => run(() => openNewMatter())}
                >
                  <FilePlus />
                  <span>New matter</span>
                  <CommandShortcut>N</CommandShortcut>
                </CommandItem>
                <CommandItem
                  keywords={["action"]}
                  onSelect={() => setPage("assign")}
                >
                  <UserPlus />
                  <span>Assign a matter</span>
                </CommandItem>
                <CommandItem
                  keywords={["action"]}
                  onSelect={() => setPage("quote")}
                >
                  <Send />
                  <span>Send a quote</span>
                </CommandItem>
                <CommandItem
                  keywords={["action"]}
                  onSelect={() => run(() => openChat())}
                >
                  <MessageSquare />
                  <span>Ask about the firm</span>
                  <CommandShortcut>⌘J</CommandShortcut>
                </CommandItem>
              </CommandGroup>

              <CommandGroup heading="Jump to">
                <CommandItem
                  keywords={["nav"]}
                  onSelect={() => run(() => router.push("/"))}
                >
                  <LayoutDashboard />
                  <span>Overview</span>
                </CommandItem>
                <CommandItem
                  keywords={["nav"]}
                  onSelect={() => run(() => router.push("/matters"))}
                >
                  <FileText />
                  <span>Matters</span>
                </CommandItem>
                <CommandItem
                  keywords={["nav"]}
                  value="Lawyers"
                  onSelect={() => run(() => router.push("/lawyers"))}
                >
                  <Users />
                  <span>Lawyers</span>
                </CommandItem>
              </CommandGroup>

              <CommandGroup heading="Filters">
                <CommandItem
                  keywords={["filter"]}
                  onSelect={() =>
                    run(() => router.push("/matters?filter=at-risk"))
                  }
                >
                  <AlertTriangle />
                  <span>At risk</span>
                </CommandItem>
                <CommandItem
                  keywords={["filter"]}
                  onSelect={() =>
                    run(() => router.push("/matters?filter=unassigned"))
                  }
                >
                  <UserPlus />
                  <span>Unassigned</span>
                </CommandItem>
                <CommandItem
                  keywords={["filter"]}
                  onSelect={() =>
                    run(() => router.push("/matters?filter=over-capacity"))
                  }
                >
                  <Search />
                  <span>Over capacity</span>
                </CommandItem>
              </CommandGroup>

              <CappedGroup
                heading="Matters"
                items={matterItems}
                expanded={!!expandedGroups.matters}
                onExpand={() => expand("matters")}
              />

              <CappedGroup
                heading="Lawyers"
                items={lawyerItems}
                expanded={!!expandedGroups.lawyers}
                onExpand={() => expand("lawyers")}
              />
            </>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
