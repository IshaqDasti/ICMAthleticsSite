import { prisma } from "@/lib/db/client";

function computeStreakFromResults(results: boolean[]): number {
  let streak = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (i === results.length - 1) { streak = results[i] ? 1 : -1; continue; }
    if (results[i] === results[i + 1]) streak = results[i] ? streak + 1 : streak - 1;
    else break;
  }
  return streak;
}

export async function recalculateTeams(teamIds: string[], seasonId: string) {
  const completedGames = await prisma.game.findMany({
    where: {
      seasonId,
      status: "COMPLETED",
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    },
    orderBy: { scheduledAt: "asc" },
  });

  const updates = teamIds.map((teamId) => {
    const games = completedGames.filter(
      (g) => g.homeTeamId === teamId || g.awayTeamId === teamId
    );
    let wins = 0, losses = 0, pointsFor = 0, pointsAgainst = 0;
    const results: boolean[] = [];
    for (const g of games) {
      const isHome = g.homeTeamId === teamId;
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;
      pointsFor += teamScore;
      pointsAgainst += oppScore;
      const won = teamScore > oppScore;
      if (won) wins++; else losses++;
      results.push(won);
    }
    return prisma.teamSeason.update({
      where: { teamId_seasonId: { teamId, seasonId } },
      data: { wins, losses, pointsFor, pointsAgainst, streak: computeStreakFromResults(results) },
    });
  });

  return prisma.$transaction(updates);
}

export async function recalculatePlayerCareerStats(playerIds: string[]) {
  if (playerIds.length === 0) return;

  const stats = await prisma.playerGameStats.groupBy({
    by: ["playerId"],
    where: { playerId: { in: playerIds }, gamePlayed: true },
    _sum: { points: true, rebounds: true, assists: true },
    _count: { gameId: true },
  });

  const statsMap = new Map(stats.map((s) => [s.playerId!, s]));

  const updates = playerIds.map((playerId) => {
    const s = statsMap.get(playerId);
    return prisma.playerCareerStats.upsert({
      where: { playerId },
      create: {
        playerId,
        totalPoints: s?._sum.points ?? 0,
        totalRebounds: s?._sum.rebounds ?? 0,
        totalAssists: s?._sum.assists ?? 0,
        gamesPlayed: s?._count.gameId ?? 0,
      },
      update: {
        totalPoints: s?._sum.points ?? 0,
        totalRebounds: s?._sum.rebounds ?? 0,
        totalAssists: s?._sum.assists ?? 0,
        gamesPlayed: s?._count.gameId ?? 0,
      },
    });
  });

  await prisma.$transaction(updates);
}

export async function unfinalizeGame(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      playerGameStats: { where: { playerId: { not: null } } },
    },
  });

  if (!game) throw new Error("Game not found");

  const playerIds = game.playerGameStats
    .map((s) => s.playerId)
    .filter((id): id is string => id !== null);

  await prisma.$transaction([
    prisma.gameEvent.deleteMany({ where: { gameId } }),
    prisma.playerGameStats.deleteMany({ where: { gameId } }),
    prisma.teamGameStats.deleteMany({ where: { gameId } }),
    prisma.game.update({
      where: { id: gameId },
      data: {
        status: "SCHEDULED",
        isLive: false,
        homeScore: 0,
        awayScore: 0,
        homeQuarterScores: [],
        awayQuarterScores: [],
        currentQuarter: 1,
        homeTeamFouls: 0,
        awayTeamFouls: 0,
        homeTeamTimeouts: 0,
        awayTeamTimeouts: 0,
      },
    }),
  ]);

  await recalculateTeams([game.homeTeamId, game.awayTeamId], game.seasonId);
  await recalculatePlayerCareerStats(playerIds);
}

export async function finalizeGame(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      playerGameStats: { where: { gamePlayed: true } },
    },
  });

  if (!game) throw new Error("Game not found");

  const homeWon = game.homeScore > game.awayScore;
  const awayWon = game.awayScore > game.homeScore;

  const [homeTs, awayTs] = await Promise.all([
    prisma.teamSeason.findUnique({
      where: { teamId_seasonId: { teamId: game.homeTeamId, seasonId: game.seasonId } },
    }),
    prisma.teamSeason.findUnique({
      where: { teamId_seasonId: { teamId: game.awayTeamId, seasonId: game.seasonId } },
    }),
  ]);

  const computeStreak = (current: number, won: boolean) => {
    if (won) return current >= 0 ? current + 1 : 1;
    return current <= 0 ? current - 1 : -1;
  };

  await prisma.$transaction([
    prisma.teamSeason.update({
      where: { teamId_seasonId: { teamId: game.homeTeamId, seasonId: game.seasonId } },
      data: {
        wins: homeWon ? { increment: 1 } : undefined,
        losses: !homeWon ? { increment: 1 } : undefined,
        pointsFor: { increment: game.homeScore },
        pointsAgainst: { increment: game.awayScore },
        streak: computeStreak(homeTs?.streak ?? 0, homeWon),
      },
    }),
    prisma.teamSeason.update({
      where: { teamId_seasonId: { teamId: game.awayTeamId, seasonId: game.seasonId } },
      data: {
        wins: awayWon ? { increment: 1 } : undefined,
        losses: !awayWon ? { increment: 1 } : undefined,
        pointsFor: { increment: game.awayScore },
        pointsAgainst: { increment: game.homeScore },
        streak: computeStreak(awayTs?.streak ?? 0, awayWon),
      },
    }),
    prisma.teamGameStats.upsert({
      where: { gameId_teamId: { gameId, teamId: game.homeTeamId } },
      create: { gameId, teamId: game.homeTeamId, isHome: true, score: game.homeScore, won: homeWon },
      update: { score: game.homeScore, won: homeWon },
    }),
    prisma.teamGameStats.upsert({
      where: { gameId_teamId: { gameId, teamId: game.awayTeamId } },
      create: { gameId, teamId: game.awayTeamId, isHome: false, score: game.awayScore, won: awayWon },
      update: { score: game.awayScore, won: awayWon },
    }),
    prisma.game.update({
      where: { id: gameId },
      data: { status: "COMPLETED", isLive: false },
    }),
  ]);

  const playerIds = game.playerGameStats
    .map((s) => s.playerId)
    .filter((id): id is string => id !== null);
  await recalculatePlayerCareerStats(playerIds);
}
