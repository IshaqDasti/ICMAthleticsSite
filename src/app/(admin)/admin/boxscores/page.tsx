import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { getActiveSeason } from "@/lib/db/queries/seasons";
import { formatGameDateTime } from "@/lib/utils/dates";
import { ClipboardEdit } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function BoxScoresListPage() {
  const season = await getActiveSeason();

  if (!season) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No active season.{" "}
        <Link href="/admin/seasons" className="text-primary hover:underline">
          Create one
        </Link>
      </div>
    );
  }

  const games = await prisma.game.findMany({
    where: { seasonId: season.id },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    orderBy: { scheduledAt: "desc" },
  });

  const live = games.filter((g) => g.isLive);
  const completed = games.filter((g) => g.status === "COMPLETED");
  const other = games.filter((g) => !g.isLive && g.status !== "COMPLETED");

  const groups = [
    { label: "Live", items: live },
    { label: "Completed", items: completed },
    { label: "Upcoming / Other", items: other },
  ].filter((g) => g.items.length > 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Box Score Editor</h1>

      <div className="space-y-8">
        {groups.map(({ label, items }) => (
          <div key={label}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {label}
            </h2>
            <div className="rounded-xl border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Matchup</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Score</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((game) => (
                    <tr key={game.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        {game.homeTeam.name} vs {game.awayTeam.name}
                        {game.isLive && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-semibold">
                            LIVE
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatGameDateTime(game.scheduledAt)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {game.status !== "SCHEDULED"
                          ? `${game.homeScore}–${game.awayScore}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/boxscores/${game.id}`}
                          className={cn(
                            "inline-flex items-center gap-1 text-xs font-medium hover:underline",
                            game.status === "SCHEDULED"
                              ? "text-muted-foreground"
                              : "text-primary"
                          )}
                        >
                          <ClipboardEdit className="w-3.5 h-3.5" />
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {games.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No games scheduled for the active season.
          </div>
        )}
      </div>
    </div>
  );
}
