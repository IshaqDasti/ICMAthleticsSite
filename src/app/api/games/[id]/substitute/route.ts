export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { prisma } from "@/lib/db/client";

export const POST = withAuth(async (req: NextRequest, _user, { params }) => {
  const { name, jersey, teamId } = await req.json();

  if (!name?.trim() || !teamId) {
    return NextResponse.json({ error: "Name and teamId are required" }, { status: 400 });
  }

  const record = await prisma.playerGameStats.create({
    data: {
      gameId: params.id,
      teamId,
      substituteName: name.trim(),
      substituteJersey: jersey?.trim() || null,
      gamePlayed: true,
    },
  });

  return NextResponse.json({ substitute: record }, { status: 201 });
}, "SCOREKEEPER");

export const DELETE = withAuth(async (req: NextRequest, _user, { params }) => {
  const { statsId } = await req.json();

  if (!statsId) {
    return NextResponse.json({ error: "statsId is required" }, { status: 400 });
  }

  const stat = await prisma.playerGameStats.findUnique({
    where: { id: statsId },
    include: { game: { select: { id: true, homeTeamId: true } } },
  });

  if (!stat || !stat.substituteName || stat.gameId !== params.id) {
    return NextResponse.json({ error: "Substitute not found" }, { status: 404 });
  }

  const isHome = stat.game.homeTeamId === stat.teamId;
  const scoreField = isHome ? "homeScore" : "awayScore";
  const foulField = isHome ? "homeTeamFouls" : "awayTeamFouls";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = [
    prisma.gameEvent.updateMany({
      where: { substituteStatsId: statsId, undone: false },
      data: { undone: true, undoneAt: new Date() },
    }),
    prisma.playerGameStats.delete({ where: { id: statsId } }),
  ];

  const gameUpdate: Record<string, unknown> = {};
  if (stat.points > 0) gameUpdate[scoreField] = { decrement: stat.points };
  if (stat.fouls > 0) gameUpdate[foulField] = { decrement: stat.fouls };
  if (Object.keys(gameUpdate).length > 0) {
    ops.push(prisma.game.update({ where: { id: stat.gameId }, data: gameUpdate }));
  }

  if (stat.points > 0) {
    ops.push(
      prisma.teamGameStats.updateMany({
        where: { gameId: stat.gameId, teamId: stat.teamId },
        data: { score: { decrement: stat.points } },
      })
    );
  }

  await prisma.$transaction(ops);

  return NextResponse.json({ ok: true, pointsRemoved: stat.points, foulsRemoved: stat.fouls, isHome });
}, "SCOREKEEPER");
