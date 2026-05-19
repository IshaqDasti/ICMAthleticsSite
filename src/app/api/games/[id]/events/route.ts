import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { prisma } from "@/lib/db/client";
import { applyGameEvent } from "@/lib/db/mutations/stats";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const events = await prisma.gameEvent.findMany({
    where: { gameId: params.id, undone: false },
    orderBy: { sequence: "desc" },
    take: 20,
  });
  return NextResponse.json({ events });
}

export const POST = withAuth(async (req, user, { params }) => {
  const body = await req.json();
  const { type, playerId, teamId, isHome, quarter } = body;

  const [event, playerStat, teamStat, game] = await applyGameEvent({
    gameId: params.id,
    eventType: type,
    playerId,
    teamId,
    isHome,
    quarter,
    value: 1,
    createdBy: user.id,
  });

  return NextResponse.json({ event, playerStat, teamStat, game }, { status: 201 });
}, "SCOREKEEPER");
