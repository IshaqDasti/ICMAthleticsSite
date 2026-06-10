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

  const careerUpdates = game.playerGameStats
    .filter((s) => s.playerId !== null)
    .map((s) =>
      prisma.playerCareerStats.upsert({
        where: { playerId: s.playerId! },
        create: {
          playerId: s.playerId!,
          totalPoints: s.points,
          totalRebounds: s.rebounds,
          totalAssists: s.assists,
          gamesPlayed: 1,
        },
        update: {
          totalPoints: { increment: s.points },
          totalRebounds: { increment: s.rebounds },
          totalAssists: { increment: s.assists },
          gamesPlayed: { increment: 1 },
        },
      })
    );

  return prisma.$transaction([
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
    ...careerUpdates,
  ]);
}
