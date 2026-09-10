"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "cn";

const NARROW = "(max-width: 767px)";

function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Shared breakpoint for Money chart axis density. */
export function useMoneyChartNarrow() {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false
  );
}

const CAPTION_GAP = "pt-2.5";

/**
 * Shared Money chart panel: title, fixed-height plot, caption.
 * Captions sit directly under the plot so wrapped and single-line
 * captions keep their first lines level across the pair.
 */
export function MoneyChartCard({
  title,
  ariaLabel,
  config,
  caption,
  children,
}: {
  title: string;
  ariaLabel: string;
  config: ChartConfig;
  caption: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="flex h-full flex-col gap-0 rounded-lg p-4 [--card-spacing:0px]">
      <p
        className="mb-2 font-medium text-text-secondary"
        style={{ fontSize: "var(--text-11)" }}
      >
        {title}
      </p>
      <ChartContainer
        config={config}
        className="aspect-auto h-28 w-full sm:h-32 md:h-40"
        aria-label={ariaLabel}
      >
        {children}
      </ChartContainer>
      <p
        className={cn(CAPTION_GAP, "text-text-secondary")}
        style={{ fontSize: "var(--text-12)" }}
      >
        {caption}
      </p>
    </Card>
  );
}

export function MoneyChartCardSkeleton({
  titleClassName = "w-48",
  captionClassName = "w-3/5 max-w-sm",
}: {
  titleClassName?: string;
  captionClassName?: string;
}) {
  return (
    <Card className="flex h-full flex-col gap-0 rounded-lg p-4 [--card-spacing:0px]">
      <Skeleton className={cn("h-3", titleClassName)} />
      <Skeleton className="mt-2 h-28 w-full rounded-md sm:h-32 md:h-40" />
      <Skeleton className={cn("mt-2.5 h-3", captionClassName)} />
    </Card>
  );
}
