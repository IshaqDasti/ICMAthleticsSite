import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId");

  const gameStatsWhere = seasonId
    ? { playerId: params.id, game: { seasonId } }
    : { playerId: params.id };

  const [gameStats, careerStats] = await Promise.all([
    prisma.playerGameStats.findMany({
      where: gameStatsWhere,
      include: {
        game: {
          include: {
            homeTeam: { select: { name: true, slug: true } },
            awayTeam: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { game: { scheduledAt: "desc" } },
    }),
    prisma.playerCareerStats.findUnique({ where: { playerId: params.id } }),
  ]);

  const gamesPlayed = gameStats.filter((s) => s.gamePlayed).length;
  const totals = gameStats.reduce(
    (acc, s) => ({
      points: acc.points + s.points,
      rebounds: acc.rebounds + s.rebounds,
      assists: acc.assists + s.assists,
    }),
    { points: 0, rebounds: 0, assists: 0 }
  );

  const averages =
    gamesPlayed > 0
      ? {
          points: +(totals.points / gamesPlayed).toFixed(1),
          rebounds: +(totals.rebounds / gamesPlayed).toFixed(1),
          assists: +(totals.assists / gamesPlayed).toFixed(1),
        }
      : { points: 0, rebounds: 0, assists: 0 };

  return NextResponse.json({ gameStats, careerStats, totals, averages, gamesPlayed });
}
