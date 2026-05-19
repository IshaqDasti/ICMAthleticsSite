import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/withAuth";

export const PUT = withAuth(async (req: NextRequest, _user, { params }) => {
  const body = await req.json();
  const announcement = await prisma.announcement.update({
    where: { id: params.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.body !== undefined && { body: body.body }),
      ...(body.pinned !== undefined && { pinned: body.pinned }),
      ...(body.published !== undefined && { published: body.published }),
    },
  });
  return NextResponse.json({ announcement });
}, "SUPER_ADMIN");

export const DELETE = withAuth(async (_req, _user, { params }) => {
  await prisma.announcement.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}, "SUPER_ADMIN");
