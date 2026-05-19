export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const stats = await prisma.playerGameStats.findMany({
    where: { gameId: params.id },
    select: { playerId: true, points: true, rebounds: true, assists: true },
  });
  return NextResponse.json({ stats });
}
