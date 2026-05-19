export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/withAuth";

export const PUT = withAuth(async (req: NextRequest, _user, { params }) => {
  const { role } = await req.json();
  const validRoles = ["SUPER_ADMIN", "SCOREKEEPER", "TEAM_MANAGER"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const user = await prisma.user.update({
    where: { id: params.id },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });
  return NextResponse.json({ user });
}, "SUPER_ADMIN");
