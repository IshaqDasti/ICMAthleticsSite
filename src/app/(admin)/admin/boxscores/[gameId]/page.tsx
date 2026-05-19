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
            select: { id: true, displayName: true, jerseyNumber: true },
            orderBy: { jerseyNumber: "asc" },
          },
        },
      },
      awayTeam: {
        include: {
          players: {
            select: { id: true, displayName: true, jerseyNumber: true },
            orderBy: { jerseyNumber: "asc" },
          },
        },
      },
      playerGameStats: true,
    },
  });

  if (!game) notFound();

  const existingStats = new Map(game.playerGameStats.map((s) => [s.playerId, s]));

  const buildRows = (teamId: string, players: typeof game.homeTeam.players) =>
    players.map((p) => {
      const stat = existingStats.get(p.id);
      return {
        playerId: p.id,
        teamId,
        displayName: p.displayName,
        jerseyNumber: p.jerseyNumber,
        points: stat?.points ?? 0,
        rebounds: stat?.rebounds ?? 0,
        assists: stat?.assists ?? 0,
        gamePlayed: stat?.gamePlayed ?? false,
      };
    });

  const initialRows = [
    ...buildRows(game.homeTeamId, game.homeTeam.players),
    ...buildRows(game.awayTeamId, game.awayTeam.players),
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
      />
    </div>
  );
}
