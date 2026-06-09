export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/withAuth";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const team = await prisma.team.findUnique({
    where: { id: params.id },
    include: {
      players: { orderBy: { lastName: "asc" } },
      seasons: { include: { season: true } },
    },
  });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ team });
}

export const PUT = withAuth(async (req, _user, { params }) => {
  const body = await req.json();
  const team = await prisma.team.update({
    where: { id: params.id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
      ...(body.primaryColor !== undefined && { primaryColor: body.primaryColor }),
      ...(body.captainName !== undefined && { captainName: body.captainName }),
    },
  });
  return NextResponse.json({ team });
}, "TEAM_MANAGER");

export const DELETE = withAuth(async (_req, _user, { params }) => {
  await prisma.team.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}, "SUPER_ADMIN");
