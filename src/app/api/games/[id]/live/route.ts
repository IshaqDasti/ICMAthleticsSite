export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { prisma } from "@/lib/db/client";
import { finalizeGame } from "@/lib/db/mutations/standings";
import { revalidatePath } from "next/cache";

export const POST = withAuth(async (req, _user, { params }) => {
  const { action } = await req.json();

  if (action === "start") {
    const game = await prisma.game.update({
      where: { id: params.id },
      data: { status: "IN_PROGRESS", isLive: true },
    });

    await Promise.all([
      prisma.teamGameStats.upsert({
        where: { gameId_teamId: { gameId: params.id, teamId: game.homeTeamId } },
        create: { gameId: params.id, teamId: game.homeTeamId, isHome: true },
        update: {},
      }),
      prisma.teamGameStats.upsert({
        where: { gameId_teamId: { gameId: params.id, teamId: game.awayTeamId } },
        create: { gameId: params.id, teamId: game.awayTeamId, isHome: false },
        update: {},
      }),
    ]);

    revalidatePath("/schedule");
    revalidatePath("/");
    revalidatePath("/teams", "layout");
    return NextResponse.json({ game });
  }

  if (action === "end") {
    await finalizeGame(params.id);
    revalidatePath("/schedule");
    revalidatePath("/");
    revalidatePath("/teams", "layout");
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}, "SCOREKEEPER");
