import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/withAuth";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const game = await prisma.game.findUnique({
    where: { id: params.id },
    include: {
      homeTeam: { select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true } },
      awayTeam: { select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true } },
      season: { select: { id: true, name: true } },
    },
  });
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ game });
}

export const PUT = withAuth(async (req, _user, { params }) => {
  const body = await req.json();
  const game = await prisma.game.update({
    where: { id: params.id },
    data: {
      ...(body.weekNumber !== undefined && { weekNumber: body.weekNumber }),
      ...(body.gameType && { gameType: body.gameType }),
      ...(body.status && { status: body.status }),
      ...(body.homeTeamId && { homeTeamId: body.homeTeamId }),
      ...(body.awayTeamId && { awayTeamId: body.awayTeamId }),
      ...(body.scheduledAt !== undefined && { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null }),
      ...(body.location !== undefined && { location: body.location }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.currentQuarter !== undefined && { currentQuarter: body.currentQuarter }),
    },
  });
  return NextResponse.json({ game });
}, "SCOREKEEPER");

export const DELETE = withAuth(async (_req, _user, { params }) => {
  await prisma.game.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}, "SUPER_ADMIN");
