import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { ScorekeeperBoard } from "@/components/live/ScorekeeperBoard";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function LiveGamePage({ params }: { params: { gameId: string } }) {
  const game = await prisma.game.findUnique({
    where: { id: params.gameId },
    include: {
      homeTeam: {
        include: {
          players: {
            select: { id: true, displayName: true, jerseyNumber: true },
            orderBy: { lastName: "asc" },
          },
        },
      },
      awayTeam: {
        include: {
          players: {
            select: { id: true, displayName: true, jerseyNumber: true },
            orderBy: { lastName: "asc" },
          },
        },
      },
    },
  });

  if (!game) notFound();

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

  const initialGame = {
    id: game.id,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    currentQuarter: game.currentQuarter,
    isLive: game.isLive,
    status: game.status,
    homeTeamFouls: game.homeTeamFouls,
    awayTeamFouls: game.awayTeamFouls,
    homeTeamTimeouts: game.homeTeamTimeouts,
    awayTeamTimeouts: game.awayTeamTimeouts,
    scorekeeperName: game.scorekeeperName,
    homeTeam: {
      id: game.homeTeam.id,
      name: game.homeTeam.name,
      players: jerseySort(game.homeTeam.players),
    },
    awayTeam: {
      id: game.awayTeam.id,
      name: game.awayTeam.name,
      players: jerseySort(game.awayTeam.players),
    },
  };

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/admin/live"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to game select
      </Link>
      <h1 className="text-xl font-bold mb-6">
        {game.homeTeam.name} vs {game.awayTeam.name}
      </h1>
      <ScorekeeperBoard initialGame={initialGame} />
    </div>
  );
}
