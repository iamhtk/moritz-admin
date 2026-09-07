"use client";

import { type ReactNode, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { transitionStandard } from "@/lib/motion";
import { cn } from "cn";

/**
 * Full-width People / Money / Pulse tabs for viewports below the Pulse rail
 * (`xl`). Sticky under the topbar so switching context does not scroll away.
 *
 * Sticky offset is `top-0` (not `--topbar-h`): these tabs live inside the main
 * page scroller, which already starts below the site header. Using topbar-h
 * here parked the bar mid-viewport and collided with scrolling cards.
 */
const TAB_ITEMS = [
  { value: "people", label: "People" },
  { value: "money", label: "Money" },
  { value: "pulse", label: "Pulse" },
] as const;

type TabValue = (typeof TAB_ITEMS)[number]["value"];

export function OverviewTabs({
  people,
  money,
  pulse,
  className,
}: {
  people: ReactNode;
  money: ReactNode;
  pulse: ReactNode;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState<TabValue>("people");

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as TabValue)}
      className={cn("gap-0", className)}
    >
      <div
        className={cn(
          "sticky top-0 z-20 -mx-4 border-b border-border bg-background px-4",
          "md:-mx-8 md:px-8",
          "isolate shadow-[0_1px_0_0_var(--border)]"
        )}
        style={{ minHeight: "var(--overview-tabs-h)" }}
      >
        <LayoutGroup>
          <TabsList
            variant="line"
            className="h-auto w-full justify-stretch gap-0 rounded-none border-0 bg-background p-0"
          >
            {TAB_ITEMS.map(({ value, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="relative min-h-11 flex-1 rounded-none bg-transparent px-2 py-2.5 after:hidden data-[state=active]:bg-transparent"
                style={{ fontSize: "var(--text-13)" }}
              >
                {label}
                {activeTab === value && (
                  <motion.span
                    layoutId="overview-tab-indicator"
                    className="absolute inset-x-2 bottom-[-1px] h-px rounded-full bg-foreground"
                    transition={transitionStandard}
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </LayoutGroup>
      </div>
      <TabsContent value="people" className="mt-3 outline-none">
        {people}
      </TabsContent>
      <TabsContent value="money" className="mt-3 outline-none">
        {money}
      </TabsContent>
      <TabsContent value="pulse" className="mt-3 outline-none">
        {pulse}
      </TabsContent>
    </Tabs>
  );
}
