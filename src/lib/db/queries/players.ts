import { prisma } from "@/lib/db/client";

interface GetPlayersOptions {
  search?: string;
  teamId?: string;
  limit?: number;
  offset?: number;
}

export async function getPlayers(options: GetPlayersOptions = {}) {
  const { search, teamId, limit = 100, offset = 0 } = options;

  return prisma.player.findMany({
    where: {
      ...(teamId && { teamId }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { displayName: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      team: { select: { id: true, name: true, slug: true, logoUrl: true } },
      careerStats: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: limit,
    skip: offset,
  });
}

export async function getPlayerBySlug(slug: string) {
  return prisma.player.findUnique({
    where: { slug },
    include: {
      team: { select: { id: true, name: true, slug: true, logoUrl: true } },
      careerStats: true,
      playerGameStats: {
        include: {
          game: {
            include: {
              homeTeam: { select: { id: true, name: true, slug: true } },
              awayTeam: { select: { id: true, name: true, slug: true } },
              season: { select: { id: true, name: true } },
            },
          },
        },
        where: { gamePlayed: true },
        orderBy: { game: { scheduledAt: "desc" } },
        take: 20,
      },
    },
  });
}

export async function getPlayerById(id: string) {
  return prisma.player.findUnique({
    where: { id },
    include: {
      team: { select: { id: true, name: true, slug: true } },
      careerStats: true,
    },
  });
}

export async function getLeagueLeaders(seasonId: string) {
  const stats = await prisma.playerGameStats.groupBy({
    by: ["playerId"],
    where: { game: { seasonId, status: "COMPLETED" }, gamePlayed: true },
    _sum: { points: true, rebounds: true, assists: true },
    _count: { gameId: true },
  });

  const playerIds = stats.map((s) => s.playerId).filter((id): id is string => id !== null);
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      slug: true,
      photoUrl: true,
      jerseyNumber: true,
      team: { select: { id: true, name: true, slug: true } },
    },
  });

  const playerMap = new Map(players.map((p) => [p.id, p]));

  return stats
    .filter((s) => s.playerId !== null)
    .map((s) => ({
      player: playerMap.get(s.playerId!)!,
      gamesPlayed: s._count.gameId,
      totalPoints: s._sum.points ?? 0,
      totalRebounds: s._sum.rebounds ?? 0,
      totalAssists: s._sum.assists ?? 0,
      avgPoints: parseFloat(((s._sum.points ?? 0) / s._count.gameId).toFixed(1)),
      avgRebounds: parseFloat(((s._sum.rebounds ?? 0) / s._count.gameId).toFixed(1)),
      avgAssists: parseFloat(((s._sum.assists ?? 0) / s._count.gameId).toFixed(1)),
    }))
    .filter((s) => s.player);
}
