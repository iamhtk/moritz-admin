"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { SiteHeader } from "@/components/site-header";
import { RealtimeOverview } from "@/components/realtime-overview";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PageTransition } from "@/components/page-transition";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:ring-3 focus:ring-ring/50"
      >
        Skip to main content
      </a>
      <RealtimeOverview />
      <AppSidebar />
      <SidebarInset className="h-full min-h-0 min-w-0 overflow-hidden">
        <SiteHeader />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px))] outline-none xl:pb-0"
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </SidebarInset>
      <MobileBottomNav />
    </SidebarProvider>
  );
}

export function OutOfScopePage({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-12">
        <div className="max-w-[420px] space-y-4 text-center">
          <h2
            className="font-heading font-medium text-foreground"
            style={{ fontSize: "var(--text-24)" }}
          >
            {title}
          </h2>
          <p
            className="text-text-secondary"
            style={{ fontSize: "var(--text-14)" }}
          >
            {body}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Back to overview</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-12">
        <div className="max-w-[420px] space-y-4 text-center">
          <h2
            className="font-semibold text-foreground"
            style={{ fontSize: "var(--text-14)" }}
          >
            {title}
          </h2>
          <p
            className="text-text-secondary"
            style={{ fontSize: "var(--text-13)" }}
          >
            This page is being built. The palette and sidebar land here so the
            product reads as a system, not a poster.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Back to overview</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
