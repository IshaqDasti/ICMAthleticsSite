export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const [stats, game] = await Promise.all([
    prisma.playerGameStats.findMany({
      where: { gameId: params.id },
      select: {
        id: true,
        playerId: true,
        teamId: true,
        points: true,
        rebounds: true,
        assists: true,
        fouls: true,
        substituteName: true,
        substituteJersey: true,
      },
    }),
    prisma.game.findUnique({
      where: { id: params.id },
      select: { homeTeamId: true, awayTeamId: true, homeTeamFouls: true, awayTeamFouls: true },
    }),
  ]);
  return NextResponse.json({ stats, teamFouls: game ? { [game.homeTeamId]: game.homeTeamFouls, [game.awayTeamId]: game.awayTeamFouls } : {} });
}
