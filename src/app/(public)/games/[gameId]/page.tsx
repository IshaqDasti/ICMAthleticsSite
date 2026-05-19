import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBoxScore } from "@/lib/db/queries/games";
import { BoxScoreView } from "@/components/boxscore/BoxScoreView";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const revalidate = 10;

export async function generateMetadata({ params }: { params: { gameId: string } }): Promise<Metadata> {
  const data = await getBoxScore(params.gameId);
  if (!data) return { title: "Game" };
  return {
    title: `${data.game.homeTeam.name} vs ${data.game.awayTeam.name}`,
  };
}

export default async function GamePage({ params }: { params: { gameId: string } }) {
  const data = await getBoxScore(params.gameId);
  if (!data) notFound();

  const { game, homeStats, awayStats } = data;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link
        href="/schedule"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Schedule
      </Link>
      <BoxScoreView game={game as any} homeStats={homeStats as any} awayStats={awayStats as any} />
    </div>
  );
}
