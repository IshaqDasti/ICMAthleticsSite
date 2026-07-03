import { Metadata } from "next";
import { getActiveSeason } from "@/lib/db/queries/seasons";
import { getLeagueLeaders, getPlayers } from "@/lib/db/queries/players";
import { PlayerRankingsTable } from "@/components/players/PlayerRankingsTable";

export const metadata: Metadata = { title: "Player Rankings" };
export const revalidate = 60;

export default async function PlayersPage() {
  const season = await getActiveSeason();
  if (!season) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        No active season found.
      </div>
    );
  }

  let players = await getLeagueLeaders(season.id);

  if (players.length === 0) {
    const allPlayers = await getPlayers({ limit: 200 });
    players = allPlayers.map((p) => ({
      player: {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        displayName: p.displayName,
        slug: p.slug,
        jerseyNumber: p.jerseyNumber ?? null,
        photoUrl: p.photoUrl ?? null,
        team: p.team
          ? { id: p.team.id, name: p.team.name, slug: p.team.slug }
          : null,
      },
      gamesPlayed: 0,
      totalPoints: 0,
      totalRebounds: 0,
      totalAssists: 0,
      avgPoints: 0,
      avgRebounds: 0,
      avgAssists: 0,
    }));
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Player Rankings</h1>
        <p className="text-muted-foreground mt-1">{season.name}</p>
      </div>
      <PlayerRankingsTable players={players} />
    </div>
  );
}
