import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/withAuth";
import { GameStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId") ?? undefined;
  const teamId = searchParams.get("teamId") ?? undefined;
  const status = (searchParams.get("status") as GameStatus) ?? undefined;
  const weekNumber = searchParams.get("weekNumber") ? parseInt(searchParams.get("weekNumber")!) : undefined;
  const isLive = searchParams.has("isLive") ? searchParams.get("isLive") === "true" : undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 100;

  const games = await prisma.game.findMany({
    where: {
      ...(seasonId && { seasonId }),
      ...(status && { status }),
      ...(weekNumber && { weekNumber }),
      ...(isLive !== undefined && { isLive }),
      ...(teamId && { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] }),
    },
    include: {
      homeTeam: { select: { id: true, name: true, slug: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, slug: true, logoUrl: true } },
      season: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });

  return NextResponse.json({ games });
}

export const POST = withAuth(async (req) => {
  const body = await req.json();
  const game = await prisma.game.create({
    data: {
      seasonId: body.seasonId,
      homeTeamId: body.homeTeamId,
      awayTeamId: body.awayTeamId,
      weekNumber: body.weekNumber,
      gameNumber: body.gameNumber,
      gameType: body.gameType ?? "REGULAR_SEASON",
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      location: body.location,
      notes: body.notes,
    },
  });
  return NextResponse.json({ game }, { status: 201 });
}, "SUPER_ADMIN");
