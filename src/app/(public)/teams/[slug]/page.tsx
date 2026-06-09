import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { getActiveSeason } from "@/lib/db/queries/seasons";
import { getGames } from "@/lib/db/queries/games";
import { GameCard } from "@/components/schedule/GameCard";
import { formatWinPct } from "@/lib/utils/stats";
import { ChevronLeft, Trophy, User } from "lucide-react";

export const revalidate = 10;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const team = await prisma.team.findUnique({ where: { slug: params.slug } });
  return { title: team?.name ?? "Team" };
}

export default async function TeamPage({ params }: { params: { slug: string } }) {
  const [team, season] = await Promise.all([
    prisma.team.findUnique({
      where: { slug: params.slug },
      include: {
        players: {
          include: { careerStats: true },
          orderBy: { lastName: "asc" },
        },
        seasons: true,
      },
    }),
    getActiveSeason(),
  ]);

  if (!team || !season) notFound();

  team.players.sort((a, b) => {
    const na = a.jerseyNumber, nb = b.jerseyNumber;
    if (na === null && nb === null) return 0;
    if (na === null) return 1;
    if (nb === null) return -1;
    const ia = parseInt(na, 10), ib = parseInt(nb, 10);
    if (ia !== ib) return ia - ib;
    return na.length - nb.length;
  });

  const teamSeason = team.seasons.find((s) => s.seasonId === season.id);
  const games = await getGames({ seasonId: season.id, teamId: team.id });

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link
        href="/teams"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Teams
      </Link>

      <div className="rounded-xl border bg-card p-6 mb-6 flex items-center gap-4">
        {team.logoUrl ? (
          <img src={team.logoUrl} alt={team.name} className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{team.name}</h1>
          {team.captainName && (
            <p className="text-muted-foreground text-sm">Captain: {team.captainName}</p>
          )}
          {teamSeason && (
            <p className="text-sm font-medium mt-1">
              {teamSeason.wins}–{teamSeason.losses}
              <span className="text-muted-foreground ml-2">
                ({formatWinPct(teamSeason.wins, teamSeason.losses)})
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden mb-6">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold">Roster</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Player</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase">GP</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase">PPG</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase">RPG</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase">APG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {team.players.map((player) => {
                const gp = player.careerStats?.gamesPlayed ?? 0;
                return (
                  <tr key={player.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">
                      {player.jerseyNumber ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/players/${player.slug}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {player.firstName} {player.lastName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{gp}</td>
                    <td className="px-3 py-2 text-right">
                      {gp > 0 ? ((player.careerStats?.totalPoints ?? 0) / gp).toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {gp > 0 ? ((player.careerStats?.totalRebounds ?? 0) / gp).toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {gp > 0 ? ((player.careerStats?.totalAssists ?? 0) / gp).toFixed(1) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Schedule</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {games.map((game) => (
            <GameCard key={game.id} game={game as any} />
          ))}
        </div>
      </div>
    </div>
  );
}
