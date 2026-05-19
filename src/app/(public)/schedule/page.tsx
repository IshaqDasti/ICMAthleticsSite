import { Metadata } from "next";
import { getActiveSeason } from "@/lib/db/queries/seasons";
import { getGames } from "@/lib/db/queries/games";
import { GameCard } from "@/components/schedule/GameCard";
import { ScheduleRefresher } from "@/components/schedule/ScheduleRefresher";
import { prisma } from "@/lib/db/client";

export const metadata: Metadata = { title: "Schedule" };
export const dynamic = "force-dynamic";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: { week?: string; teamId?: string };
}) {
  const season = await getActiveSeason();
  if (!season) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        No active season found.
      </div>
    );
  }

  const weekNumber = searchParams.week ? parseInt(searchParams.week) : undefined;
  const teamId = searchParams.teamId;

  const [games, teams] = await Promise.all([
    getGames({ seasonId: season.id, weekNumber, teamId }),
    prisma.team.findMany({
      where: { seasons: { some: { seasonId: season.id } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const now = new Date();
  const oneHourMs = 60 * 60 * 1000;
  // Find the minimum weekNumber of SCHEDULED games that haven't expired (start + 1hr > now)
  const upcomingWeekNumber = games.reduce<number | null>((min, game) => {
    if ((game.status !== "SCHEDULED" && game.status !== "IN_PROGRESS") || game.weekNumber === null) return min;
    const start = game.scheduledAt ? new Date(game.scheduledAt as Date).getTime() : Infinity;
    if (start + oneHourMs <= now.getTime()) return min;
    return min === null || game.weekNumber < min ? game.weekNumber : min;
  }, null);

  const hasLiveGames = games.some((g) => g.isLive);

  const grouped = games.reduce<Record<string, typeof games>>((acc, game) => {
    const key = game.weekNumber ? `Week ${game.weekNumber}` : game.gameType.replace(/_/g, " ");
    if (!acc[key]) acc[key] = [];
    acc[key].push(game);
    return acc;
  }, {});

  return (
    <div className="container mx-auto px-4 py-8">
      <ScheduleRefresher hasLiveGames={hasLiveGames} />
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Schedule</h1>
        <p className="text-muted-foreground mt-1">{season.name}</p>
      </div>

      <form className="flex gap-3 mb-6 flex-wrap">
        <select
          name="teamId"
          defaultValue={teamId ?? ""}
          className="px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Filter
        </button>
        <a href="/schedule" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          Clear
        </a>
      </form>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No games found.</p>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([week, weekGames]) => (
            <div key={week}>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                {week}
                <span className="text-sm font-normal text-muted-foreground">
                  · {weekGames[0]?.scheduledAt
                    ? new Date(weekGames[0].scheduledAt as Date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "America/New_York",
                      })
                    : ""}
                </span>
              </h2>
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {weekGames.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game as any}
                    isUpcomingWeek={
                      upcomingWeekNumber !== null
                        ? game.weekNumber === upcomingWeekNumber
                        : true
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
