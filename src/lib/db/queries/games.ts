import { prisma } from "@/lib/db/client";
import { GameStatus, GameType } from "@prisma/client";

interface GetGamesOptions {
  seasonId?: string;
  teamId?: string;
  status?: GameStatus;
  weekNumber?: number;
  limit?: number;
  isLive?: boolean;
}

export async function getGames(options: GetGamesOptions = {}) {
  const { seasonId, teamId, status, weekNumber, limit, isLive } = options;

  return prisma.game.findMany({
    where: {
      ...(seasonId && { seasonId }),
      ...(status && { status }),
      ...(weekNumber && { weekNumber }),
      ...(isLive !== undefined && { isLive }),
      ...(teamId && {
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      }),
    },
    include: {
      homeTeam: { select: { id: true, name: true, slug: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, slug: true, logoUrl: true } },
      season: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { scheduledAt: "asc" },
    ...(limit && { take: limit }),
  });
}

export async function getGameById(id: string) {
  return prisma.game.findUnique({
    where: { id },
    include: {
      homeTeam: { select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true } },
      awayTeam: { select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true } },
      season: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function getBoxScore(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      homeTeam: { select: { id: true, name: true, slug: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, slug: true, logoUrl: true } },
      season: { select: { id: true, name: true } },
      playerGameStats: {
        include: {
          player: {
            select: {
              id: true,
              displayName: true,
              slug: true,
              jerseyNumber: true,
              photoUrl: true,
            },
          },
        },
        orderBy: { points: "desc" },
      },
    },
  });

  if (!game) return null;

  const homeStats = game.playerGameStats.filter(
    (s) => s.teamId === game.homeTeamId
  );
  const awayStats = game.playerGameStats.filter(
    (s) => s.teamId === game.awayTeamId
  );

  return { game, homeStats, awayStats };
}

export async function getLiveGames() {
  return prisma.game.findMany({
    where: { isLive: true },
    include: {
      homeTeam: { select: { id: true, name: true, slug: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
  });
}

export async function getRecentGames(seasonId: string, limit = 5) {
  return prisma.game.findMany({
    where: { seasonId, status: "COMPLETED" },
    include: {
      homeTeam: { select: { id: true, name: true, slug: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
    orderBy: { scheduledAt: "desc" },
    take: limit,
  });
}

export async function getUpcomingGames(seasonId: string, limit = 5) {
  return prisma.game.findMany({
    where: { seasonId, status: "SCHEDULED" },
    include: {
      homeTeam: { select: { id: true, name: true, slug: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });
}
