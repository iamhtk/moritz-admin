import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import type { AttentionItem, Stage } from "@/lib/supabase";

export type StatusTone = "risk" | "watch" | "ok" | "info" | "neutral";

/** Stage badge tones stay separate from the clock (Left) signal. */
export function stageTone(stage: Stage): StatusTone {
  switch (stage) {
    case "submitted":
      return "neutral";
    case "quoted":
    case "drafting":
      return "info";
    case "review":
      return "watch";
    case "delivered":
      return "ok";
  }
}

export function stageLabel(stage: Stage): string {
  switch (stage) {
    case "submitted":
      return "Submitted";
    case "quoted":
      return "Quoted";
    case "drafting":
      return "Drafting";
    case "review":
      return "In review";
    case "delivered":
      return "Delivered";
  }
}

const toneVars: Record<
  StatusTone,
  { bg: string; border: string; fg: string }
> = {
  risk: {
    bg: "var(--status-risk-bg)",
    border: "var(--status-risk-border)",
    fg: "var(--status-risk-fg)",
  },
  watch: {
    bg: "var(--status-watch-bg)",
    border: "var(--status-watch-border)",
    fg: "var(--status-watch-fg)",
  },
  ok: {
    bg: "var(--status-ok-bg)",
    border: "var(--status-ok-border)",
    fg: "var(--status-ok-fg)",
  },
  info: {
    bg: "var(--status-info-bg)",
    border: "var(--status-info-border)",
    fg: "var(--status-info-fg)",
  },
  neutral: {
    bg: "var(--status-neutral-bg)",
    border: "var(--status-neutral-border)",
    fg: "var(--status-neutral-fg)",
  },
};

export function kindToTone(kind: AttentionItem["kind"]): StatusTone {
  switch (kind) {
    case "breach":
      return "risk";
    case "watch":
      return "watch";
    case "unassigned":
      return "info";
    case "overCapacity":
      return "risk";
    case "unquoted":
      return "neutral";
  }
}

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  const vars = toneVars[tone];
  const [pulsing, setPulsing] = useState(false);
  const prevKey = useRef(`${tone}-${String(children)}`);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const key = `${tone}-${String(children)}`;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevKey.current = key;
      return;
    }
    if (key !== prevKey.current) {
      prevKey.current = key;
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 320);
      return () => clearTimeout(t);
    }
  }, [tone, children]);

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 font-medium whitespace-nowrap transition-transform duration-[var(--motion-duration)]",
        pulsing && "[animation:status-badge-pop_0.32s_var(--motion-ease-out)_1]",
        className
      )}
      style={{
        background: vars.bg,
        borderColor: vars.border,
        color: vars.fg,
        fontSize: "var(--text-11)",
      }}
    >
      {children}
    </Badge>
  );
}
