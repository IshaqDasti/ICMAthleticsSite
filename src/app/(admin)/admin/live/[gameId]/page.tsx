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
    },
  });

  if (!game) notFound();

  const initialGame = {
    id: game.id,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    currentQuarter: game.currentQuarter,
    isLive: game.isLive,
    status: game.status,
    homeTeam: {
      id: game.homeTeam.id,
      name: game.homeTeam.name,
      players: game.homeTeam.players,
    },
    awayTeam: {
      id: game.awayTeam.id,
      name: game.awayTeam.name,
      players: game.awayTeam.players,
    },
  };

  return (
    <div>
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
