export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/withAuth";
import { slugify } from "@/lib/utils/slugify";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? undefined;
  const teamId = searchParams.get("teamId") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "200");

  const players = await prisma.player.findMany({
    where: {
      ...(teamId && { teamId }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { displayName: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      team: { select: { id: true, name: true, slug: true } },
      careerStats: true,
    },
    orderBy: { lastName: "asc" },
    take: limit,
  });

  return NextResponse.json({ players });
}

export const POST = withAuth(async (req) => {
  const body = await req.json();
  const baseSlug = slugify(`${body.firstName}-${body.lastName}`);

  let slug = baseSlug;
  let attempt = 0;
  while (await prisma.player.findUnique({ where: { slug } })) {
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  const player = await prisma.player.create({
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      displayName: body.displayName ?? body.firstName,
      slug,
      jerseyNumber: body.jerseyNumber ?? null,
      teamId: body.teamId ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      instagramHandle: body.instagramHandle ?? null,
    },
  });

  return NextResponse.json({ player }, { status: 201 });
}, "TEAM_MANAGER");
