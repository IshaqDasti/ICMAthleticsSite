import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/withAuth";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const season = await prisma.season.findUnique({ where: { id: params.id } });
  if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ season });
}

export const PUT = withAuth(async (req, _user, { params }) => {
  const body = await req.json();

  if (body.status === "ACTIVE") {
    await prisma.season.updateMany({
      where: { status: "ACTIVE" },
      data: { status: "COMPLETED" },
    });
  }

  const season = await prisma.season.update({
    where: { id: params.id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.status && { status: body.status }),
      ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
      ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
    },
  });

  return NextResponse.json({ season });
}, "SUPER_ADMIN");
