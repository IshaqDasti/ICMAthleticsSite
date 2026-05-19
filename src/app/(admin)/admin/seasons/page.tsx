import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth/session";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function AdminSeasonsPage() {
  const session = await getServerSession();
  if (!session || session.role === "SCOREKEEPER") redirect("/admin");
  const seasons = await prisma.season.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Seasons</h1>
        <Link href="/admin/seasons/new" className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" />
          New Season
        </Link>
      </div>

      <div className="space-y-3">
        {seasons.map((season) => (
          <div key={season.id} className="rounded-xl border bg-card p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{season.name}</p>
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block",
                season.status === "ACTIVE" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                season.status === "ARCHIVED" ? "bg-muted text-muted-foreground" :
                "bg-primary/10 text-primary"
              )}>
                {season.status}
              </span>
            </div>
            <div className="flex gap-2">
              {season.status !== "ACTIVE" && (
                <form action={async () => {
                  "use server";
                  const { prisma: p } = await import("@/lib/db/client");
                  await p.season.updateMany({ where: { status: "ACTIVE" }, data: { status: "COMPLETED" } });
                  await p.season.update({ where: { id: season.id }, data: { status: "ACTIVE" } });
                }}>
                  <button type="submit" className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700">
                    Set Active
                  </button>
                </form>
              )}
              {season.status !== "ARCHIVED" && (
                <form action={async () => {
                  "use server";
                  const { prisma: p } = await import("@/lib/db/client");
                  await p.season.update({ where: { id: season.id }, data: { status: "ARCHIVED" } });
                }}>
                  <button type="submit" className="px-3 py-1.5 text-xs border rounded-md text-muted-foreground hover:bg-muted">
                    Archive
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
