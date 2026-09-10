"use client";

import { AppShell } from "@/components/app-shell";
import { PulsePanel } from "@/components/pulse-rail";

/**
 * Pulse as a primary destination below the desktop rail breakpoint.
 * Same feed and filters as the Overview rail; full-width for phone and tablet.
 */
export default function PulsePage() {
  return (
    <AppShell>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pt-6 pb-6 md:px-8">
        <div className="mx-auto flex min-h-0 w-full min-w-0 max-w-[720px] flex-1 flex-col">
          <PulsePanel />
        </div>
      </div>
    </AppShell>
  );
}
