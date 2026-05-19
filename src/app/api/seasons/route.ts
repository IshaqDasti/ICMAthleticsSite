import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/withAuth";
import { slugify } from "@/lib/utils/slugify";

export async function GET() {
  const seasons = await prisma.season.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ seasons });
}

export const POST = withAuth(async (req) => {
  const body = await req.json();
  const slug = slugify(body.name);

  const season = await prisma.season.create({
    data: {
      name: body.name,
      slug,
      status: body.status ?? "UPCOMING",
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
    },
  });

  return NextResponse.json({ season }, { status: 201 });
}, "SUPER_ADMIN");
