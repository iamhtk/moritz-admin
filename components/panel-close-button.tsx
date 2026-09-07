"use client";

import type { ComponentProps } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

/**
 * Shared panel dismiss control — top-right X used on sheets, dialogs,
 * command palette, and the notification tray.
 */
export function PanelCloseButton({
  className,
  onClick,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Close"
      className={cn(
        "absolute top-3 right-3 z-20 min-h-11 min-w-11 shrink-0 md:min-h-8 md:min-w-8",
        className
      )}
      onClick={onClick}
      {...props}
    >
      <XIcon className="size-4" aria-hidden />
      <span className="sr-only">Close</span>
    </Button>
  );
}
