"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Bell, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { SheetHandle } from "@/components/sheet-handle";
import { PanelCloseButton } from "@/components/panel-close-button";
import { AutoHideScroll } from "@/components/auto-hide-scroll";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOverview } from "@/hooks/use-overview";
import { useNotificationReads } from "@/hooks/use-notification-reads";
import { useSheetSide } from "@/hooks/use-sheet-side";
import {
  activitySentencePlain,
  buildActivitySentence,
} from "@/lib/activity-copy";
import { formatRelativeTime } from "@/lib/format";
import type { ActivityItem } from "@/lib/supabase";
import { cn } from "cn";

const DROPDOWN_LIMIT = 7;

function notificationHref(item: ActivityItem): string | null {
  if (item.reference) {
    return `/matters?ref=${encodeURIComponent(item.reference)}`;
  }
  return null;
}

function RelativeTime({ iso }: { iso: string }) {
  const [label, setLabel] = useState(() => formatRelativeTime(iso));
  useEffect(() => {
    setLabel(formatRelativeTime(iso));
    const id = window.setInterval(() => {
      setLabel(formatRelativeTime(iso));
    }, 60_000);
    return () => window.clearInterval(id);
  }, [iso]);

  return (
    <time
      dateTime={iso}
      className="mt-0.5 block text-text-tertiary"
      style={{ fontSize: "var(--text-11)" }}
      suppressHydrationWarning
    >
      {label}
    </time>
  );
}

export function NotificationRow({
  item,
  unread,
  onActivate,
  dense = false,
}: {
  item: ActivityItem;
  unread: boolean;
  onActivate?: () => void;
  dense?: boolean;
}) {
  const href = notificationHref(item);
  const plain = activitySentencePlain(item);

  const body = (
    <>
      <span
        className={cn(
          "mt-1.5 size-1.5 shrink-0 rounded-full",
          unread ? "bg-[var(--rowan-400,#c45c4a)]" : "bg-transparent"
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "line-clamp-2 text-foreground",
            unread && "font-medium"
          )}
          style={{ fontSize: "var(--text-12)", lineHeight: 1.45 }}
        >
          {buildActivitySentence(item, { linkMatterRefs: false })}
        </span>
        <RelativeTime iso={item.at} />
      </span>
    </>
  );

  const className = cn(
    "flex w-full items-start gap-2.5 rounded-md text-left outline-none transition-colors",
    dense ? "px-2.5 py-2" : "px-3 py-2.5",
    "hover:bg-surface-hover focus-visible:bg-surface-hover"
  );

  if (href) {
    return (
      <Link
        href={href}
        className={className}
        aria-label={plain}
        onClick={onActivate}
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={plain}
      onClick={onActivate}
    >
      {body}
    </button>
  );
}

function NotificationList({
  recent,
  isPending,
  isError,
  onRetry,
  isFetching,
  isUnread,
  markRead,
  onNavigate,
  asMenuItems = false,
}: {
  recent: ActivityItem[];
  isPending: boolean;
  isError?: boolean;
  onRetry?: () => void;
  isFetching?: boolean;
  isUnread: (id: number) => boolean;
  markRead: (id: number) => void;
  onNavigate?: (href: string | null) => void;
  asMenuItems?: boolean;
}) {
  const router = useRouter();

  if (isPending) {
    return (
      <div className="space-y-2 px-3 py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-2.5">
            <Skeleton className="mt-1.5 size-1.5 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <AlertCircle
          className="size-8 text-destructive"
          strokeWidth={1.5}
          aria-hidden
        />
        <div className="space-y-1">
          <p
            className="font-semibold text-foreground"
            style={{ fontSize: "var(--text-14)" }}
          >
            Couldn&apos;t load notifications
          </p>
          <p
            className="text-text-secondary"
            style={{ fontSize: "var(--text-12)" }}
          >
            Check the connection and try again.
          </p>
        </div>
        {onRetry ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11 md:min-h-8"
            onClick={onRetry}
            disabled={isFetching}
          >
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  if (recent.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <Bell
          className="size-8 text-text-tertiary"
          strokeWidth={1.5}
          aria-hidden
        />
        <p
          className="font-semibold text-foreground"
          style={{ fontSize: "var(--text-14)" }}
        >
          You&apos;re all caught up
        </p>
        <p
          className="text-text-secondary"
          style={{ fontSize: "var(--text-12)" }}
        >
          New firm activity will show up here.
        </p>
      </div>
    );
  }

  return (
    <AutoHideScroll
      className={cn("py-1", !asMenuItems && "h-full min-h-0")}
      style={
        asMenuItems ? { maxHeight: "min(22rem, 50vh)" } : undefined
      }
    >
      {recent.map((item) => {
        const unread = isUnread(item.id);
        const href = notificationHref(item);
        const activate = () => {
          markRead(item.id);
          if (onNavigate) onNavigate(href);
          else if (href) router.push(href);
        };

        if (asMenuItems) {
          return (
            <DropdownMenuItem
              key={item.id}
              className="cursor-pointer items-start gap-2.5 rounded-none px-2.5 py-2 focus:bg-surface-hover focus:text-foreground"
              onSelect={activate}
            >
              <span
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  unread ? "bg-[var(--rowan-400,#c45c4a)]" : "bg-transparent"
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "line-clamp-2 text-foreground",
                    unread && "font-medium"
                  )}
                  style={{ fontSize: "var(--text-12)", lineHeight: 1.45 }}
                >
                  {buildActivitySentence(item, { linkMatterRefs: false })}
                </span>
                <RelativeTime iso={item.at} />
              </span>
            </DropdownMenuItem>
          );
        }

        return (
          <NotificationRow
            key={item.id}
            item={item}
            unread={unread}
            onActivate={activate}
          />
        );
      })}
    </AutoHideScroll>
  );
}

function NotificationHeader({
  count,
  onMarkAll,
  onClose,
}: {
  count: number;
  onMarkAll: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="relative flex items-center justify-between gap-2 px-3 py-2.5 pr-12">
      <span
        className="font-semibold text-foreground"
        style={{ fontSize: "var(--text-13)" }}
      >
        Notifications
      </span>
      <button
        type="button"
        className="font-medium text-text-secondary transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        style={{ fontSize: "var(--text-12)" }}
        disabled={count === 0}
        onClick={onMarkAll}
      >
        Mark all read
      </button>
      {onClose ? (
        <PanelCloseButton
          className="top-1.5 right-1.5"
          onClick={onClose}
        />
      ) : null}
    </div>
  );
}

function BellTrigger({
  count,
  badge,
  ring,
  className,
  ...props
}: {
  count: number;
  badge: string | null;
  ring?: boolean;
} & ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "relative min-h-11 min-w-11 md:min-h-8 md:min-w-8 transition-[background-color,transform] duration-[var(--motion-duration)] ease-[var(--motion-ease-out)]",
        ring && "[animation:status-badge-pop_0.4s_var(--motion-ease-out)_1]",
        className
      )}
      aria-label={
        count > 0 ? `Notifications, ${count} unread` : "Notifications"
      }
      {...props}
    >
      <Bell className="size-4" aria-hidden />
      {badge ? (
        <span
          className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-semibold text-primary-foreground md:top-0.5 md:right-0.5"
          style={{
            fontSize: "0.625rem",
            background: "var(--rowan-500, var(--destructive))",
          }}
          aria-hidden
        >
          {badge}
        </span>
      ) : null}
    </Button>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const side = useSheetSide();
  const [open, setOpen] = useState(false);
  const [ring, setRing] = useState(false);
  const prevCount = useRef(0);
  const { data, error, isPending, isFetching, refetch } = useOverview();
  const activity = data?.activity ?? [];
  const isError = Boolean(error) || (!isPending && !data);
  const { isUnread, markRead, markAllRead, unreadCount } =
    useNotificationReads();

  const recent = isError ? [] : activity.slice(0, DROPDOWN_LIMIT);
  const allIds = activity.map((a) => a.id);
  const count = isError ? 0 : unreadCount(allIds);
  const badge = count > 9 ? "9+" : count > 0 ? String(count) : null;

  useEffect(() => {
    if (count > prevCount.current) {
      setRing(true);
      const t = window.setTimeout(() => setRing(false), 420);
      prevCount.current = count;
      return () => window.clearTimeout(t);
    }
    prevCount.current = count;
  }, [count]);

  const footer = (
    <div className="border-t border-border p-1.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-center font-medium"
        onClick={() => {
          setOpen(false);
          router.push("/notifications");
        }}
      >
        Show all
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <BellTrigger count={count} badge={badge} ring={ring} onClick={() => setOpen(true)} />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side={side}
            className={cn(
              "flex flex-col gap-0 p-0",
              side === "right" &&
                "h-full w-[400px] max-w-[400px] border-l sm:max-w-[400px]",
              side === "bottom" && "h-[85vh] max-h-[85vh] w-full border-t"
            )}
          >
            <SheetHandle visible={side === "bottom"} />
            <SheetHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
              <div className="flex items-center justify-between gap-2 pr-2">
                <SheetTitle style={{ fontSize: "var(--text-16)" }}>
                  Notifications
                </SheetTitle>
                <button
                  type="button"
                  className="font-medium text-text-secondary transition-colors hover:text-foreground disabled:opacity-40"
                  style={{ fontSize: "var(--text-12)" }}
                  disabled={count === 0}
                  onClick={() => markAllRead(allIds)}
                >
                  Mark all read
                </button>
              </div>
              <SheetDescription className="text-text-tertiary" style={{ fontSize: "var(--text-12)" }}>
                Recent firm activity from Pulse
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-hidden">
              <NotificationList
                recent={recent}
                isPending={isPending}
                isError={isError}
                onRetry={() => refetch()}
                isFetching={isFetching}
                isUnread={isUnread}
                markRead={markRead}
                onNavigate={(href) => {
                  setOpen(false);
                  if (href) router.push(href);
                }}
              />
            </div>
            {footer}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <BellTrigger count={count} badge={badge} ring={ring} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-1.5rem))] min-w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden p-0"
      >
        <NotificationHeader
          count={count}
          onMarkAll={() => markAllRead(allIds)}
          onClose={() => setOpen(false)}
        />
        <DropdownMenuSeparator className="my-0" />
        <NotificationList
          recent={recent}
          isPending={isPending}
          isError={isError}
          onRetry={() => refetch()}
          isFetching={isFetching}
          isUnread={isUnread}
          markRead={markRead}
          asMenuItems
        />
        <DropdownMenuSeparator className="my-0" />
        <div className="p-1.5">
          <DropdownMenuItem asChild>
            <Link
              href="/notifications"
              className="cursor-pointer justify-center font-medium"
              style={{ fontSize: "var(--text-12)" }}
            >
              Show all
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
