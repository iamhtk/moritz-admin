"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { transitionStandard } from "@/lib/motion";
import {
  Building2,
  FileText,
  LayoutDashboard,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/user-menu";
import { cn } from "cn";

const navItems = [
  { title: "Overview", href: "/", icon: LayoutDashboard, soon: false },
  { title: "Matters", href: "/matters", icon: FileText, soon: false },
  { title: "Lawyers", href: "/lawyers", icon: Users, soon: false },
  { title: "Clients", href: "/clients", icon: Building2, soon: true },
  { title: "Finance", href: "/finance", icon: TrendingUp, soon: true },
  { title: "Settings", href: "/settings", icon: Settings, soon: true },
] as const;

const emptySubscribe = () => () => {};

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader className="px-3 py-3">
        <div className="flex items-center gap-2.5 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-primary-foreground"
            style={{ background: "var(--brand)" }}
            aria-hidden
          >
            <span
              className="font-semibold leading-none"
              style={{ fontSize: "var(--text-12)" }}
            >
              M
            </span>
          </div>
          <span
            className="font-semibold text-foreground group-data-[collapsible=icon]:hidden"
            style={{ fontSize: "var(--text-14)" }}
          >
            Moritz
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
          <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label="Primary">
              <LayoutGroup>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const active =
                      mounted &&
                      (item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href));
                    return (
                      <SidebarMenuItem key={item.title} className="relative">
                        {active && (
                          <motion.div
                            layoutId="sidebar-active"
                            className="pointer-events-none absolute inset-0 rounded-md bg-sidebar-accent"
                            transition={transitionStandard}
                          />
                        )}
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={
                            item.soon ? `${item.title} (Soon)` : item.title
                          }
                          className={cn(
                            "relative z-[1] h-[34px] rounded-md",
                            active
                              ? "bg-transparent text-sidebar-accent-foreground hover:bg-transparent hover:text-sidebar-accent-foreground"
                              : item.soon
                                ? "text-sidebar-foreground/55 hover:bg-surface-hover hover:text-sidebar-foreground/70"
                                : "text-sidebar-foreground hover:bg-surface-hover hover:text-sidebar-foreground"
                          )}
                        >
                          <Link
                            href={item.href}
                            aria-current={mounted && active ? "page" : undefined}
                          >
                            <item.icon />
                            <span className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="truncate">{item.title}</span>
                              {item.soon ? (
                                <span
                                  className="ml-auto shrink-0 rounded-md border border-sidebar-border px-1.5 py-0.5 font-medium text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden"
                                  style={{
                                    fontSize: "var(--text-11)",
                                    lineHeight: 1.2,
                                    background:
                                      "color-mix(in oklch, var(--sidebar-foreground) 10%, transparent)",
                                  }}
                                >
                                  Soon
                                </span>
                              ) : null}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </LayoutGroup>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-3">
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
