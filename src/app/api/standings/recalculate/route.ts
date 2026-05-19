export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/withAuth";

export const POST = withAuth(async (req: NextRequest) => {
  const { seasonId } = await req.json();
  if (!seasonId) return NextResponse.json({ error: "seasonId required" }, { status: 400 });

  const completedGames = await prisma.game.findMany({
    where: { seasonId, status: "COMPLETED" },
    include: { teamGameStats: true },
  });

  const teamSeasons = await prisma.teamSeason.findMany({ where: { seasonId } });

  await prisma.$transaction(
    teamSeasons.map((ts) => {
      const teamGames = completedGames.filter((g) =>
        g.teamGameStats.some((tgs) => tgs.teamId === ts.teamId)
      );
      let wins = 0, losses = 0, pointsFor = 0, pointsAgainst = 0, streak = 0;
      const results: boolean[] = [];

      for (const game of teamGames) {
        const tgs = game.teamGameStats.find((s) => s.teamId === ts.teamId);
        const oppTgs = game.teamGameStats.find((s) => s.teamId !== ts.teamId);
        if (!tgs || !oppTgs) continue;
        pointsFor += tgs.score;
        pointsAgainst += oppTgs.score;
        if (tgs.won) { wins++; results.push(true); }
        else { losses++; results.push(false); }
      }

      // Compute streak from most recent games
      for (let i = results.length - 1; i >= 0; i--) {
        if (i === results.length - 1) { streak = results[i] ? 1 : -1; continue; }
        if (results[i] === results[i + 1]) streak = results[i] ? streak + 1 : streak - 1;
        else break;
      }

      return prisma.teamSeason.update({
        where: { id: ts.id },
        data: { wins, losses, pointsFor, pointsAgainst, streak },
      });
    })
  );

  return NextResponse.json({ success: true, gamesProcessed: completedGames.length });
}, "SUPER_ADMIN");
