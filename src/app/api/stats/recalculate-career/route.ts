export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/withAuth";
import { recalculatePlayerCareerStats } from "@/lib/db/mutations/standings";

export const POST = withAuth(async () => {
  const rows = await prisma.playerGameStats.findMany({
    where: { playerId: { not: null } },
    select: { playerId: true },
    distinct: ["playerId"],
  });

  const playerIds = rows.map((r) => r.playerId).filter((id): id is string => id !== null);
  await recalculatePlayerCareerStats(playerIds);

  return NextResponse.json({ success: true, playersUpdated: playerIds.length });
}, "SUPER_ADMIN");
