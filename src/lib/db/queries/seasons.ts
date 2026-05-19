import { prisma } from "@/lib/db/client";

export async function getSeasons() {
  return prisma.season.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getActiveSeason() {
  return prisma.season.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSeasonBySlug(slug: string) {
  return prisma.season.findUnique({ where: { slug } });
}
