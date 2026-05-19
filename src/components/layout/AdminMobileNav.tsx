"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X, Trophy, Radio, Users, Calendar, Layers, LogOut, ClipboardEdit } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      <div className="lg:hidden flex items-center justify-between p-4 border-b bg-card">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <Image src="/icomd-logo.png" alt="ICM Athletics" width={20} height={20} />
          ICM Admin
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 rounded-md text-muted-foreground hover:bg-accent"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-card border-b">
          <nav className="p-4 grid grid-cols-3 gap-2">
            {[
              { href: "/admin/live", label: "Live", icon: Radio },
              { href: "/admin/boxscores", label: "Box Scores", icon: ClipboardEdit },
              { href: "/admin/teams", label: "Teams", icon: Trophy },
              { href: "/admin/players", label: "Players", icon: Users },
              { href: "/admin/schedule", label: "Schedule", icon: Calendar },
              { href: "/admin/seasons", label: "Seasons", icon: Layers },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex flex-col items-center gap-1 p-3 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="p-4 pt-0">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </>
  );
}
