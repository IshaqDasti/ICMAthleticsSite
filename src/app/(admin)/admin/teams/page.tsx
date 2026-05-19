import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth/session";
import { Plus, Edit } from "lucide-react";

export default async function AdminTeamsPage() {
  const session = await getServerSession();
  if (!session || session.role === "SCOREKEEPER") redirect("/admin");
  const teams = await prisma.team.findMany({
    include: { _count: { select: { players: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Teams</h1>
        <Link
          href="/admin/teams/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Add Team
        </Link>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Team</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Captain</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Players</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {teams.map((team) => (
              <tr key={team.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{team.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{team.captainName ?? "—"}</td>
                <td className="px-4 py-3 text-right">{team._count.players}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/teams/${team.id}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="w-3 h-3" />
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
