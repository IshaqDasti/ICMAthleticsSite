import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/withAuth";
import { slugify } from "@/lib/utils/slugify";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId") ?? undefined;

  const teams = await prisma.team.findMany({
    where: seasonId ? { seasons: { some: { seasonId } } } : undefined,
    include: { seasons: { where: seasonId ? { seasonId } : undefined } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ teams });
}

export const POST = withAuth(async (req) => {
  const body = await req.json();
  const slug = slugify(body.name);

  const team = await prisma.team.create({
    data: {
      name: body.name,
      slug,
      logoUrl: body.logoUrl,
      primaryColor: body.primaryColor,
      captainName: body.captainName,
    },
  });

  if (body.seasonId) {
    await prisma.teamSeason.create({
      data: { teamId: team.id, seasonId: body.seasonId },
    });
  }

  return NextResponse.json({ team }, { status: 201 });
}, "SUPER_ADMIN");
