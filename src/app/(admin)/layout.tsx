import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminMobileNav } from "@/components/layout/AdminMobileNav";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <AdminMobileNav />
        <div className="flex items-center justify-end p-4 border-b bg-card lg:hidden">
          <ThemeToggle />
        </div>
        <div className="hidden lg:flex items-center justify-end px-6 py-3 border-b bg-card">
          <ThemeToggle />
        </div>
        <main className="flex-1 p-6 bg-background overflow-auto">{children}</main>
      </div>
    </div>
  );
}
