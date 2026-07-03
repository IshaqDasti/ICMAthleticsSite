export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getBoxScore } from "@/lib/db/queries/games";
import { withAuth } from "@/lib/auth/withAuth";
import { prisma } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { finalizeGame, recalculateTeams, recalculatePlayerCareerStats } from "@/lib/db/mutations/standings";

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

  const subs = substituteStats ?? [];

  await prisma.$transaction([
    ...(playerStats.length > 0
      ? [
          prisma.$executeRaw`
            INSERT INTO player_game_stats ("id", "gameId", "playerId", "teamId", "points", "rebounds", "assists", "gamePlayed")
            SELECT gen_random_uuid()::text, ${params.id}, u."playerId", u."teamId", u.points, u.rebounds, u.assists, u."gamePlayed"
            FROM unnest(
              ${playerStats.map((s) => s.playerId)}::text[],
              ${playerStats.map((s) => s.teamId)}::text[],
              ${playerStats.map((s) => s.points)}::int[],
              ${playerStats.map((s) => s.rebounds)}::int[],
              ${playerStats.map((s) => s.assists)}::int[],
              ${playerStats.map((s) => s.gamePlayed)}::boolean[]
            ) AS u("playerId", "teamId", points, rebounds, assists, "gamePlayed")
            ON CONFLICT ("gameId", "playerId") DO UPDATE SET
              points = EXCLUDED.points,
              rebounds = EXCLUDED.rebounds,
              assists = EXCLUDED.assists,
              "gamePlayed" = EXCLUDED."gamePlayed"
          `,
        ]
      : []),
    ...(subs.length > 0
      ? [
          prisma.$executeRaw`
            UPDATE player_game_stats p SET
              points = u.points,
              rebounds = u.rebounds,
              assists = u.assists,
              "gamePlayed" = u."gamePlayed"
            FROM unnest(
              ${subs.map((s) => s.substituteStatsId)}::text[],
              ${subs.map((s) => s.points)}::int[],
              ${subs.map((s) => s.rebounds)}::int[],
              ${subs.map((s) => s.assists)}::int[],
              ${subs.map((s) => s.gamePlayed)}::boolean[]
            ) AS u(id, points, rebounds, assists, "gamePlayed")
            WHERE p.id = u.id
          `,
        ]
      : []),
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
      const playerIds = playerStats.map((s) => s.playerId);
      await Promise.all([
        recalculateTeams(
          [prevGame.homeTeamId, prevGame.awayTeamId],
          prevGame.seasonId
        ),
        recalculatePlayerCareerStats(playerIds),
      ]);
    }
  }

  revalidatePath("/schedule");
  revalidatePath("/");
  revalidatePath("/standings");
  revalidatePath("/teams", "layout");
  revalidatePath(`/games/${params.id}`);

  return NextResponse.json({ ok: true });
}, "SCOREKEEPER");
