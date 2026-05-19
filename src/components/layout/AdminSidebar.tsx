"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 min-h-screen border-r bg-card">
      <div className="p-6 border-b">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Image src="/icomd-logo.png" alt="ICM Athletics" width={24} height={24} />
          ICM Athletics
        </Link>
        <p className="text-xs text-muted-foreground mt-1">Admin Dashboard</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href) && item.href !== "/admin";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground mb-1"
        >
          <BarChart3 className="w-4 h-4" />
          View Site
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
