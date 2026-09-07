"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/notification-center";
import { useDashboardActions } from "@/components/actions-provider";

const TITLES: Record<string, string> = {
  "/": "Overview",
  "/matters": "Matters",
  "/lawyers": "Lawyers",
  "/clients": "Clients",
  "/finance": "Finance",
  "/settings": "Settings",
  "/notifications": "Notifications",
};

/**
 * Header layout:
 * - Mobile: no hamburger (bottom nav owns destinations). Title + utilities + New Matter.
 * - Desktop: sidebar toggle + title; utility cluster; primary New Matter.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const { openCommandPalette, openNewMatter, openChat } =
    useDashboardActions();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const main = document.getElementById("main-content");
    const scroller =
      (main?.querySelector(".overflow-y-auto") as HTMLElement | null) ??
      main;
    if (!scroller) return;
    const handler = () => setScrolled(scroller.scrollTop > 12);
    handler();
    scroller.addEventListener("scroll", handler, { passive: true });
    return () => scroller.removeEventListener("scroll", handler);
  }, [pathname]);

  const page =
    TITLES[pathname] ??
    TITLES[`/${pathname.split("/")[1]}`] ??
    "Overview";

  return (
    <header className={`sticky top-0 z-30 flex h-(--topbar-h) shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4 sm:gap-3 transition-shadow duration-[var(--motion-duration)] ease-[var(--motion-ease-out)] ${scrolled ? "shadow-sm" : ""}`}>
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1 hidden min-h-8 min-w-8 md:inline-flex" />
        <Separator orientation="vertical" className="mr-1 hidden h-4 md:block" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden sm:inline-flex">
              <span className="text-muted-foreground">Moritz</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{page}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="sr-only">{page}</h1>
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 lg:hidden"
            aria-keyshortcuts="Meta+K Control+K"
            aria-label="Search matters, lawyers, clients"
            onClick={() => openCommandPalette()}
          >
            <Search className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="hidden h-8 w-72 min-w-0 justify-between gap-2 px-2.5 font-normal text-text-tertiary lg:inline-flex xl:w-96"
            style={{ fontSize: "var(--text-13)" }}
            aria-keyshortcuts="Meta+K Control+K"
            onClick={() => openCommandPalette()}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Search className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">Search</span>
            </span>
            <kbd
              className="pointer-events-none inline-flex h-5 items-center rounded-md border border-border px-1.5 font-medium text-text-tertiary"
              style={{ fontSize: "var(--text-11)" }}
            >
              ⌘K
            </kbd>
          </Button>
          <NotificationBell />
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 shrink-0 gap-1.5 px-0 sm:h-8 sm:min-h-8 sm:min-w-0 sm:px-3"
            aria-keyshortcuts="Meta+J Control+J"
            aria-label="Ask"
            onClick={() => openChat()}
          >
            <Sparkles className="size-4 sm:size-3.5" aria-hidden />
            <span className="hidden sm:inline">Ask</span>
          </Button>
        </div>

        <Separator
          orientation="vertical"
          className="hidden h-5 sm:block"
          aria-hidden
        />

        <Button
          type="button"
          size="icon"
          className="min-h-11 min-w-11 min-[390px]:hidden"
          onClick={() => openNewMatter()}
        >
          <Plus className="size-4" aria-hidden />
          <span className="sr-only">New matter</span>
        </Button>
        <Button
          type="button"
          size="sm"
          className="hidden shrink-0 min-[390px]:inline-flex"
          onClick={() => openNewMatter()}
        >
          New matter
        </Button>
      </div>
    </header>
  );
}
