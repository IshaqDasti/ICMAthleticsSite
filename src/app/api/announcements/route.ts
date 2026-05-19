export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/withAuth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId") ?? undefined;

  const announcements = await prisma.announcement.findMany({
    where: {
      published: true,
      ...(seasonId && { OR: [{ seasonId }, { seasonId: null }] }),
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 10,
  });

  return NextResponse.json({ announcements });
}

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const announcement = await prisma.announcement.create({
    data: {
      title: body.title,
      body: body.body,
      pinned: body.pinned ?? false,
      published: body.published ?? true,
      seasonId: body.seasonId ?? null,
      createdBy: user.id,
    },
  });
  return NextResponse.json({ announcement }, { status: 201 });
}, "SUPER_ADMIN");
