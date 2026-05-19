import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { getActiveSeason } from "@/lib/db/queries/seasons";
import { formatGameDateTime } from "@/lib/utils/dates";
import { Radio } from "lucide-react";

export default async function LiveSelectPage() {
  const season = await getActiveSeason();
  if (!season) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No active season.
      </div>
    );
  }

  const games = await prisma.game.findMany({
    where: {
      seasonId: season.id,
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
    },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Radio className="w-6 h-6 text-red-500" />
        <h1 className="text-2xl font-bold">Live Scoring</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-6">Select a game to start or continue scoring.</p>

      {games.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          No scheduled games found.
          <Link href="/admin/schedule/new" className="block mt-2 text-primary hover:underline text-sm">
            Schedule a game
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {games.map((game) => (
            <Link key={game.id} href={`/admin/live/${game.id}`}>
              <div className="rounded-xl border bg-card hover:bg-muted/30 transition-colors p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {game.homeTeam.name} vs {game.awayTeam.name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatGameDateTime(game.scheduledAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {game.isLive && (
                    <span className="flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
                      <span className="live-dot w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400" />
                      LIVE
                    </span>
                  )}
                  <span className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium">
                    {game.isLive ? "Continue" : "Start"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
