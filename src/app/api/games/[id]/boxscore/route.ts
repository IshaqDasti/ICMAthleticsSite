import { NextRequest, NextResponse } from "next/server";
import { getBoxScore } from "@/lib/db/queries/games";
import { withAuth } from "@/lib/auth/withAuth";
import { prisma } from "@/lib/db/client";
import { revalidatePath } from "next/cache";

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

export const PUT = withAuth(async (req, _user, { params }) => {
  const body = await req.json();
  const { playerStats, homeScore, awayScore } = body as {
    playerStats: PlayerStatInput[];
    homeScore?: number;
    awayScore?: number;
  };

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
    ...(homeScore !== undefined || awayScore !== undefined
      ? [
          prisma.game.update({
            where: { id: params.id },
            data: {
              ...(homeScore !== undefined && { homeScore }),
              ...(awayScore !== undefined && { awayScore }),
              status: "COMPLETED",
              isLive: false,
            },
          }),
        ]
      : []),
  ]);

  revalidatePath("/schedule");
  revalidatePath("/");
  revalidatePath("/teams", "layout");
  revalidatePath(`/games/${params.id}`);

  const data = await getBoxScore(params.id);
  return NextResponse.json(data);
}, "SCOREKEEPER");
