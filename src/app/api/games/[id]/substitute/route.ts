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
