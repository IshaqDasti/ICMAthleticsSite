import Link from "next/link";
import { getActiveSeason } from "@/lib/db/queries/seasons";
import { getStandings } from "@/lib/db/queries/standings";
import { getUpcomingGames, getRecentGames } from "@/lib/db/queries/games";
import { getLeagueLeaders } from "@/lib/db/queries/players";
import { prisma } from "@/lib/db/client";
import { GameCard } from "@/components/schedule/GameCard";
import { formatWinPct } from "@/lib/utils/stats";
import { formatStreak } from "@/lib/utils/standings";
import { ArrowRight, Trophy, Megaphone } from "lucide-react";

export const revalidate = 10;

export default async function HomePage() {
  const season = await getActiveSeason();

  if (!season) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-bold mb-2">ICM Athletics</h1>
        <p className="text-muted-foreground">Season coming soon. Stay tuned!</p>
      </div>
    );
  }

  const [standings, upcoming, recent, leaders, announcements] = await Promise.all([
    getStandings(season.id),
    getUpcomingGames(season.id, 4),
    getRecentGames(season.id, 4),
    getLeagueLeaders(season.id),
    prisma.announcement.findMany({
      where: { published: true, OR: [{ seasonId: season.id }, { seasonId: null }] },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 3,
    }),
  ]);

  const topScorers = [...leaders].sort((a, b) => b.avgPoints - a.avgPoints).slice(0, 3);
  const topRebounders = [...leaders].sort((a, b) => b.avgRebounds - a.avgRebounds).slice(0, 3);
  const topAssists = [...leaders].sort((a, b) => b.avgAssists - a.avgAssists).slice(0, 3);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-black">ICM Athletics</h1>
        <p className="text-muted-foreground text-lg mt-1">{season.name}</p>
      </div>

      {announcements.length > 0 && (
        <div className="mb-8 space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border p-4 ${a.pinned ? "border-primary bg-primary/5" : "bg-card"}`}
            >
              {a.pinned && (
                <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Megaphone className="w-3 h-3" /> Pinned
                </span>
              )}
              <p className="font-semibold">{a.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {upcoming.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold">Upcoming Games</h2>
                <Link href="/schedule" className="text-sm text-primary hover:underline flex items-center gap-1">
                  Full schedule <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {upcoming.map((game) => <GameCard key={game.id} game={game as any} />)}
              </div>
            </section>
          )}

          {recent.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold">Recent Scores</h2>
                <Link href="/schedule" className="text-sm text-primary hover:underline flex items-center gap-1">
                  All scores <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {recent.map((game) => <GameCard key={game.id} game={game as any} />)}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Standings</h2>
              <Link href="/standings" className="text-sm text-primary hover:underline">
                Full
              </Link>
            </div>
            <div className="rounded-xl border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Team</th>
                    <th className="px-3 py-2 text-right">W</th>
                    <th className="px-3 py-2 text-right">L</th>
                    <th className="px-3 py-2 text-right">STRK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {standings.slice(0, 8).map((row) => (
                    <tr key={row.teamId} className="hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground">{row.rank}</td>
                      <td className="px-3 py-2">
                        <Link href={`/teams/${row.teamSlug}`} className="font-medium hover:text-primary truncate block max-w-[100px]">
                          {row.teamName}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{row.wins}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{row.losses}</td>
                      <td className="px-3 py-2 text-right text-xs">{formatStreak(row.streak)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">League Leaders</h2>
              <Link href="/players" className="text-sm text-primary hover:underline">
                All
              </Link>
            </div>
            <div className="space-y-3">
              {[
                { label: "Points", players: topScorers, stat: "avgPoints" as const },
                { label: "Rebounds", players: topRebounders, stat: "avgRebounds" as const },
                { label: "Assists", players: topAssists, stat: "avgAssists" as const },
              ].map(({ label, players, stat }) => (
                <div key={label} className="rounded-xl border bg-card overflow-hidden">
                  <div className="px-3 py-2 bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                    {label}
                  </div>
                  {players.map((p, i) => (
                    <div key={p.player.id} className="flex items-center justify-between px-3 py-2 border-t">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                        <Link href={`/players/${p.player.slug}`} className="text-sm font-medium hover:text-primary">
                          {p.player.firstName} {p.player.lastName}
                        </Link>
                      </div>
                      <span className="font-bold text-sm">{p[stat].toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
