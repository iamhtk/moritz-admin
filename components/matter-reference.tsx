"use client";

import Link from "next/link";
import { cn } from "cn";

/** Links a matter reference to the Matters table with that row highlighted. */
export function MatterReference({
  reference,
  className,
}: {
  reference: string;
  className?: string;
}) {
  return (
    <Link
      href={`/matters?ref=${encodeURIComponent(reference)}`}
      className={cn(
        /* Visible text stays compact; padding expands the hit area on touch. */
        "inline-flex items-center font-medium text-foreground underline-offset-2",
        "min-h-11 py-2.5 -my-2.5 md:min-h-0 md:py-0 md:my-0",
        "hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
      style={{ fontSize: "inherit" }}
    >
      {reference}
    </Link>
  );
}
