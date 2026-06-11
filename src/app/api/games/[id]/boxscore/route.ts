export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getBoxScore } from "@/lib/db/queries/games";
import { withAuth } from "@/lib/auth/withAuth";
import { prisma } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { finalizeGame, recalculateTeams } from "@/lib/db/mutations/standings";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const data = await getBoxScore(params.id);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

interface PlayerStatInput {
  playerId: string;
  teamId: string;
  points: number;
  rebounds: number;
  assists: number;
  gamePlayed: boolean;
}

interface SubstituteStatInput {
  substituteStatsId: string;
  points: number;
  rebounds: number;
  assists: number;
  gamePlayed: boolean;
}

export const PUT = withAuth(async (req, _user, { params }) => {
  const body = await req.json();
  const { playerStats, substituteStats, homeScore, awayScore, scorekeeperName } = body as {
    playerStats: PlayerStatInput[];
    substituteStats?: SubstituteStatInput[];
    homeScore?: number;
    awayScore?: number;
    scorekeeperName?: string;
  };

  const scoresProvided = homeScore !== undefined || awayScore !== undefined;
  const scorekeeperOnly = !scoresProvided && scorekeeperName !== undefined;

  const prevGame = scoresProvided
    ? await prisma.game.findUnique({ where: { id: params.id }, select: { status: true, homeTeamId: true, awayTeamId: true, seasonId: true } })
    : null;

  await prisma.$transaction([
    ...playerStats.map((s) =>
      prisma.playerGameStats.upsert({
        where: { gameId_playerId: { gameId: params.id, playerId: s.playerId } },
        create: {
          gameId: params.id,
          playerId: s.playerId,
          teamId: s.teamId,
          points: s.points,
          rebounds: s.rebounds,
          assists: s.assists,
          gamePlayed: s.gamePlayed,
        },
        update: {
          points: s.points,
          rebounds: s.rebounds,
          assists: s.assists,
          gamePlayed: s.gamePlayed,
        },
      })
    ),
    ...(substituteStats ?? []).map((s) =>
      prisma.playerGameStats.update({
        where: { id: s.substituteStatsId },
        data: {
          points: s.points,
          rebounds: s.rebounds,
          assists: s.assists,
          gamePlayed: s.gamePlayed,
        },
      })
    ),
    ...(scorekeeperOnly
      ? [
          prisma.game.update({
            where: { id: params.id },
            data: { scorekeeperName: scorekeeperName || null },
          }),
        ]
      : []),
    ...(scoresProvided
      ? [
          prisma.game.update({
            where: { id: params.id },
            data: {
              ...(homeScore !== undefined && { homeScore }),
              ...(awayScore !== undefined && { awayScore }),
              ...(scorekeeperName !== undefined && { scorekeeperName: scorekeeperName || null }),
              status: "COMPLETED",
              isLive: false,
            },
          }),
        ]
      : []),
  ]);

  if (scoresProvided) {
    if (prevGame?.status !== "COMPLETED") {
      await finalizeGame(params.id);
    } else {
      await recalculateTeams(
        [prevGame.homeTeamId, prevGame.awayTeamId],
        prevGame.seasonId
      );
    }
  }

  revalidatePath("/schedule");
  revalidatePath("/");
  revalidatePath("/standings");
  revalidatePath("/teams", "layout");
  revalidatePath(`/games/${params.id}`);

  const data = await getBoxScore(params.id);
  return NextResponse.json(data);
}, "SCOREKEEPER");
