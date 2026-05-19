import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const players = await prisma.player.findMany({
    where: { teamId: params.id },
    orderBy: [{ jerseyNumber: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      jerseyNumber: true,
      slug: true,
      photoUrl: true,
    },
  });
  return NextResponse.json({ players });
}
