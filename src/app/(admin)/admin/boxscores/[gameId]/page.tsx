import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { ChevronLeft } from "lucide-react";
import { BoxScoreEditor } from "@/components/boxscore/BoxScoreEditor";

export default async function BoxScoreEditorPage({ params }: { params: { gameId: string } }) {
  const game = await prisma.game.findUnique({
    where: { id: params.gameId },
    include: {
      homeTeam: {
        include: {
          players: {
            select: { id: true, firstName: true, lastName: true, jerseyNumber: true },
            orderBy: { lastName: "asc" },
          },
        },
      },
      awayTeam: {
        include: {
          players: {
            select: { id: true, firstName: true, lastName: true, jerseyNumber: true },
            orderBy: { lastName: "asc" },
          },
        },
      },
      playerGameStats: true,
    },
  });

  if (!game) notFound();

  const existingStats = new Map(
    game.playerGameStats.filter((s) => s.playerId !== null).map((s) => [s.playerId!, s])
  );

  function jerseySort<T extends { jerseyNumber: string | null }>(arr: T[]): T[] {
    return [...arr].sort((a, b) => {
      const na = a.jerseyNumber, nb = b.jerseyNumber;
      if (na === null && nb === null) return 0;
      if (na === null) return 1;
      if (nb === null) return -1;
      const ia = parseInt(na, 10), ib = parseInt(nb, 10);
      if (ia !== ib) return ia - ib;
      return na.length - nb.length;
    });
  }

  const buildRows = (teamId: string, players: typeof game.homeTeam.players) =>
    jerseySort(players).map((p) => {
      const stat = existingStats.get(p.id);
      return {
        rowKey: p.id,
        playerId: p.id,
        substituteStatsId: null,
        teamId,
        displayName: `${p.firstName} ${p.lastName}`,
        jerseyNumber: p.jerseyNumber,
        isSubstitute: false,
        points: stat?.points ?? 0,
        rebounds: stat?.rebounds ?? 0,
        assists: stat?.assists ?? 0,
        gamePlayed: stat?.gamePlayed ?? false,
      };
    });

  const subRows = game.playerGameStats
    .filter((s) => s.playerId === null && s.substituteName)
    .map((s) => ({
      rowKey: s.id,
      playerId: null,
      substituteStatsId: s.id,
      teamId: s.teamId,
      displayName: s.substituteName!,
      jerseyNumber: s.substituteJersey ?? null,
      isSubstitute: true,
      points: s.points,
      rebounds: s.rebounds,
      assists: s.assists,
      gamePlayed: s.gamePlayed,
    }));

  const initialRows = [
    ...buildRows(game.homeTeamId, game.homeTeam.players),
    ...buildRows(game.awayTeamId, game.awayTeam.players),
    ...subRows,
  ];

  return (
    <div>
      <Link
        href="/admin/boxscores"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Box Scores
      </Link>
      <h1 className="text-2xl font-bold mb-1">
        {game.homeTeam.name} vs {game.awayTeam.name}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Manually edit player stats and final score for this game.
      </p>
      <BoxScoreEditor
        gameId={game.id}
        homeTeam={{ id: game.homeTeamId, name: game.homeTeam.name }}
        awayTeam={{ id: game.awayTeamId, name: game.awayTeam.name }}
        initialHomeScore={game.homeScore}
        initialAwayScore={game.awayScore}
        initialRows={initialRows}
        initialScorekeeperName={game.scorekeeperName}
      />
    </div>
  );
}
