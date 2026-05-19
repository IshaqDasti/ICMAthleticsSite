import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlayerBySlug } from "@/lib/db/queries/players";
import { PlayerStatChart } from "@/components/players/PlayerStatChart";
import Link from "next/link";
import { ChevronLeft, User } from "lucide-react";
import { calculateAvg } from "@/lib/utils/stats";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const player = await getPlayerBySlug(params.slug);
  if (!player) return { title: "Player" };
  return { title: `${player.firstName} ${player.lastName}` };
}

export default async function PlayerProfilePage({ params }: { params: { slug: string } }) {
  const player = await getPlayerBySlug(params.slug);
  if (!player) notFound();

  const career = player.careerStats;
  const gamesPlayed = career?.gamesPlayed ?? 0;

  const chartData = player.playerGameStats
    .slice()
    .reverse()
    .map((gs, i) => ({
      game: `G${i + 1}`,
      points: gs.points,
      rebounds: gs.rebounds,
      assists: gs.assists,
    }));

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link
        href="/players"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Rankings
      </Link>

      <div className="rounded-xl border bg-card p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {player.photoUrl ? (
              <img src={player.photoUrl} alt={`${player.firstName} ${player.lastName}`} className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{player.firstName} {player.lastName}</h1>
            {player.jerseyNumber !== null && (
              <p className="text-muted-foreground">#{player.jerseyNumber}</p>
            )}
            {player.team && (
              <Link
                href={`/teams/${player.team.slug}`}
                className="text-primary hover:underline font-medium"
              >
                {player.team.name}
              </Link>
            )}
            {player.instagramHandle && (
              <p className="text-xs text-muted-foreground mt-1">@{player.instagramHandle}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "PPG", value: calculateAvg(career?.totalPoints ?? 0, gamesPlayed).toFixed(1) },
          { label: "RPG", value: calculateAvg(career?.totalRebounds ?? 0, gamesPlayed).toFixed(1) },
          { label: "APG", value: calculateAvg(career?.totalAssists ?? 0, gamesPlayed).toFixed(1) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-4 text-center">
            <p className="text-3xl font-black">{stat.value}</p>
            <p className="text-sm text-muted-foreground font-medium mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {chartData.length >= 2 && (
        <div className="rounded-xl border bg-card p-4 mb-6">
          <h2 className="font-semibold mb-3">Stat Trend</h2>
          <PlayerStatChart data={chartData} />
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold">Game Log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Game</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase">PTS</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase">REB</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase">AST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {player.playerGameStats.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground text-xs">
                    No games played yet
                  </td>
                </tr>
              ) : (
                player.playerGameStats.map((gs) => {
                  const opp =
                    gs.game.homeTeam.id === player.teamId ? gs.game.awayTeam : gs.game.homeTeam;
                  return (
                    <tr key={gs.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <Link href={`/games/${gs.game.id}`} className="hover:text-primary">
                          vs {opp.name}
                        </Link>
                        <span className="text-xs text-muted-foreground ml-2">
                          {gs.game.season.name}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{gs.points}</td>
                      <td className="px-3 py-2 text-right">{gs.rebounds}</td>
                      <td className="px-3 py-2 text-right">{gs.assists}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
