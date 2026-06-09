import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const players = await prisma.player.findMany({
    where: { teamId: params.id },
    orderBy: { lastName: "asc" },
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

  players.sort((a, b) => {
    const na = a.jerseyNumber, nb = b.jerseyNumber;
    if (na === null && nb === null) return 0;
    if (na === null) return 1;
    if (nb === null) return -1;
    const ia = parseInt(na, 10), ib = parseInt(nb, 10);
    if (ia !== ib) return ia - ib;
    return na.length - nb.length;
  });

  return NextResponse.json({ players });
}
