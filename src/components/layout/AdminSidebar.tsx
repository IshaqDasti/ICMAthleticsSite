"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Trophy,
  Users,
  Calendar,
  BarChart3,
  Settings,
  Layers,
  Radio,
  Megaphone,
  LayoutDashboard,
  LogOut,
  ClipboardEdit,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/live", label: "Live Scoring", icon: Radio },
  { href: "/admin/boxscores", label: "Box Scores", icon: ClipboardEdit },
  { href: "/admin/teams", label: "Teams", icon: Trophy },
  { href: "/admin/players", label: "Players", icon: Users },
  { href: "/admin/schedule", label: "Schedule", icon: Calendar },
  { href: "/admin/seasons", label: "Seasons", icon: Layers },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/users", label: "Users", icon: Settings },
];

const COLLAPSE_KEY = "admin-sidebar-collapsed";

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_KEY, prev ? "0" : "1");
      return !prev;
    });
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-full border-r bg-card transition-[width] duration-200 shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("border-b", collapsed ? "p-3 flex flex-col items-center gap-3" : "p-6")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between gap-2")}>
          <Link href="/" className="flex items-center gap-2 font-bold text-lg" title="ICM Athletics">
            <Image src="/icomd-logo.png" alt="ICM Athletics" width={24} height={24} />
            {!collapsed && "ICM Athletics"}
          </Link>
          {!collapsed && (
            <button
              onClick={toggleCollapsed}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
        {collapsed ? (
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">Admin Dashboard</p>
        )}
      </div>

      <nav className={cn("flex-1 space-y-1 overflow-y-auto", collapsed ? "p-2" : "p-4")}>
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href) && item.href !== "/admin";
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
                collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div className={cn("border-t", collapsed ? "p-2" : "p-4")}>
        <Link
          href="/"
          title="View Site"
          className={cn(
            "flex items-center gap-3 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground mb-1",
            collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
          )}
        >
          <BarChart3 className="w-4 h-4 shrink-0" />
          {!collapsed && "View Site"}
        </Link>
        <button
          onClick={handleLogout}
          title="Logout"
          className={cn(
            "flex items-center gap-3 w-full rounded-md text-sm text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors",
            collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && "Logout"}
        </button>
      </div>
    </aside>
  );
}
