"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { transitionStandard } from "@/lib/motion";
import {
  Activity,
  Building2,
  FileText,
  LayoutDashboard,
  MoreHorizontal,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SheetHandle } from "@/components/sheet-handle";
import { UserMenu } from "@/components/user-menu";
import { cn } from "cn";

const primaryItems = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Matters", href: "/matters", icon: FileText },
  { title: "Lawyers", href: "/lawyers", icon: Users },
  { title: "Pulse", href: "/pulse", icon: Activity },
] as const;

const moreItems = [
  { title: "Clients", href: "/clients", icon: Building2, soon: true },
  { title: "Finance", href: "/finance", icon: TrendingUp, soon: true },
  { title: "Settings", href: "/settings", icon: Settings, soon: true },
] as const;

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Primary navigation below the Pulse-rail breakpoint (1280px, Tailwind `xl`).
 * Desktop (≥1280) uses the sidebar + Overview rail instead.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = moreItems.some((item) =>
    isActivePath(pathname, item.href)
  );

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] xl:hidden"
        style={{
          height: "calc(var(--bottom-nav-h) + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <LayoutGroup>
          <ul className="grid h-(--bottom-nav-h) grid-cols-5">
            {primaryItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href} className="min-w-0">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-full flex-col items-center justify-center gap-0.5 px-0.5 outline-none transition-colors",
                      "focus-visible:ring-3 focus-visible:ring-ring/50",
                      active
                        ? "text-sidebar-accent"
                        : "text-text-tertiary hover:text-foreground"
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="bottom-nav-indicator"
                        className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-sidebar-accent"
                        transition={transitionStandard}
                        aria-hidden
                      />
                    ) : null}
                    <item.icon className="size-5" aria-hidden />
                    <span
                      className={cn(
                        "truncate font-medium",
                        active && "text-sidebar-accent"
                      )}
                      style={{ fontSize: "var(--text-11)" }}
                    >
                      {item.title}
                    </span>
                  </Link>
                </li>
              );
            })}
            <li className="min-w-0">
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-haspopup="dialog"
                onClick={() => setMoreOpen(true)}
                className={cn(
                  "relative flex h-full w-full flex-col items-center justify-center gap-0.5 px-0.5 outline-none transition-colors",
                  "focus-visible:ring-3 focus-visible:ring-ring/50",
                  moreActive || moreOpen
                    ? "text-sidebar-accent"
                    : "text-text-tertiary hover:text-foreground"
                )}
              >
                {moreActive || moreOpen ? (
                  <motion.span
                    layoutId="bottom-nav-indicator"
                    className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-sidebar-accent"
                    transition={transitionStandard}
                    aria-hidden
                  />
                ) : null}
                <MoreHorizontal className="size-5" aria-hidden />
                <span
                  className="truncate font-medium"
                  style={{ fontSize: "var(--text-11)" }}
                >
                  More
                </span>
              </button>
            </li>
          </ul>
        </LayoutGroup>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="gap-0 rounded-t-xl p-0"
          style={{ maxHeight: "70vh" }}
        >
          <SheetHandle visible />
          <SheetHeader className="border-b border-border px-5 py-3 text-left">
            <SheetTitle style={{ fontSize: "var(--text-14)" }}>More</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-2 py-2">
            <ul className="space-y-0.5">
              {moreItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      aria-label={
                        item.soon
                          ? `${item.title} (coming soon)`
                          : undefined
                      }
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-foreground hover:bg-surface-hover"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden />
                      <span
                        className="min-w-0 flex-1 font-medium"
                        style={{ fontSize: "var(--text-13)" }}
                      >
                        {item.title}
                      </span>
                      {item.soon ? (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "shrink-0 rounded-md border px-1.5 py-0.5 font-medium",
                            active
                              ? "border-sidebar-accent-foreground/20 text-sidebar-accent-foreground/55"
                              : "border-border text-text-secondary"
                          )}
                          style={{
                            fontSize: "var(--text-11)",
                            background: active
                              ? "color-mix(in oklch, var(--sidebar-accent-foreground) 8%, transparent)"
                              : "color-mix(in oklch, var(--foreground) 6%, transparent)",
                          }}
                        >
                          Soon
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="my-2 border-t border-border" />

            <div className="px-2 py-1">
              <UserMenu />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
