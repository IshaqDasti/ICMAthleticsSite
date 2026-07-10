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
            // Injured players are off the board unless they already have
            // stats in this game (injured mid-game — keep them undoable)
            where: {
              OR: [
                { isInjured: false },
                { playerGameStats: { some: { gameId: params.gameId } } },
              ],
            },
            select: { id: true, displayName: true, jerseyNumber: true },
            orderBy: { lastName: "asc" },
          },
        },
      },
      awayTeam: {
        include: {
          players: {
            where: {
              OR: [
                { isInjured: false },
                { playerGameStats: { some: { gameId: params.gameId } } },
              ],
            },
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
    // -m-6 / calc(100%+3rem) escapes the admin layout's p-6 so the board can
    // use the full viewport height without scrolling on desktop
    <div className="-m-6 p-3 flex flex-col gap-2 lg:h-[calc(100%+3rem)] lg:overflow-hidden">
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/admin/live"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          Games
        </Link>
        <span className="text-muted-foreground">·</span>
        <h1 className="text-sm font-bold truncate">
          {game.homeTeam.name} vs {game.awayTeam.name}
        </h1>
      </div>
      <ScorekeeperBoard initialGame={initialGame} />
    </div>
  );
}
