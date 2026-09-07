import { cn } from "cn";
import type { ReactNode } from "react";

export function ZoneLabel({
  title,
  meta,
  className,
  visuallyHidden = false,
}: {
  title: string;
  meta?: ReactNode;
  className?: string;
  /** Keep an h2 for outline order while the tab label is visible. */
  visuallyHidden?: boolean;
}) {
  if (visuallyHidden) {
    return <h2 className="sr-only">{title}</h2>;
  }

  return (
    <div className={cn("mb-3 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2", className)}>
      <h2
        className="font-heading shrink-0 font-medium text-foreground"
        style={{ fontSize: "var(--text-24)" }}
      >
        {title}
      </h2>
      {meta ? (
        <span
          className="min-w-0 text-text-tertiary"
          style={{ fontSize: "var(--text-14)" }}
        >
          {meta}
        </span>
      ) : null}
    </div>
  );
}
