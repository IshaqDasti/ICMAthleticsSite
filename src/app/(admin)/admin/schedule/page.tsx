import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth/session";
import { getActiveSeason } from "@/lib/db/queries/seasons";
import { formatGameDateTime } from "@/lib/utils/dates";
import { Plus, Edit } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function AdminSchedulePage() {
  const session = await getServerSession();
  if (!session || session.role === "SCOREKEEPER") redirect("/admin");
  const season = await getActiveSeason();
  if (!season) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No active season. <Link href="/admin/seasons" className="text-primary hover:underline">Create one</Link>
      </div>
    );
  }

  const games = await prisma.game.findMany({
    where: { seasonId: season.id },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <Link
          href="/admin/schedule/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Game
        </Link>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Week</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Matchup</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Date/Time</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Score</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {games.map((game) => (
              <tr key={game.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-muted-foreground">
                  {game.weekNumber ?? game.gameType.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-3 font-medium">
                  {game.homeTeam.name} vs {game.awayTeam.name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatGameDateTime(game.scheduledAt)}
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    game.status === "COMPLETED" ? "bg-muted text-muted-foreground" :
                    game.isLive ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                    "bg-primary/10 text-primary"
                  )}>
                    {game.isLive ? "LIVE" : game.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {game.status !== "SCHEDULED" ? `${game.homeScore}–${game.awayScore}` : "—"}
                </td>
                <td className="px-4 py-3 text-right flex justify-end gap-2">
                  {!game.isLive && game.status !== "COMPLETED" && (
                    <Link
                      href={`/admin/live/${game.id}`}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      Score
                    </Link>
                  )}
                  <Link
                    href={`/admin/schedule/${game.id}`}
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
