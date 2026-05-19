import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/withAuth";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const player = await prisma.player.findUnique({
    where: { id: params.id },
    include: { team: true, careerStats: true },
  });
  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ player });
}

export const PUT = withAuth(async (req, _user, { params }) => {
  const body = await req.json();
  const player = await prisma.player.update({
    where: { id: params.id },
    data: {
      ...(body.firstName && { firstName: body.firstName }),
      ...(body.lastName && { lastName: body.lastName }),
      ...(body.displayName && { displayName: body.displayName }),
      ...(body.jerseyNumber !== undefined && { jerseyNumber: body.jerseyNumber }),
      ...(body.teamId !== undefined && { teamId: body.teamId }),
      ...(body.photoUrl !== undefined && { photoUrl: body.photoUrl }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.instagramHandle !== undefined && { instagramHandle: body.instagramHandle }),
    },
  });
  return NextResponse.json({ player });
}, "TEAM_MANAGER");

export const DELETE = withAuth(async (_req, _user, { params }) => {
  await prisma.player.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}, "SUPER_ADMIN");
