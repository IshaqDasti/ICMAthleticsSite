import { prisma } from "@/lib/db/client";

export async function getStandings(seasonId: string) {
  const rows = await prisma.teamSeason.findMany({
    where: { seasonId },
    include: {
      team: {
        select: { id: true, name: true, slug: true, logoUrl: true },
      },
    },
    orderBy: [{ wins: "desc" }, { pointsFor: "desc" }],
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    teamId: row.teamId,
    teamName: row.team.name,
    teamSlug: row.team.slug,
    logoUrl: row.team.logoUrl,
    wins: row.wins,
    losses: row.losses,
    pointsFor: row.pointsFor,
    pointsAgainst: row.pointsAgainst,
    differential: row.pointsFor - row.pointsAgainst,
    streak: row.streak,
    gamesPlayed: row.wins + row.losses,
    winPct:
      row.wins + row.losses > 0
        ? parseFloat((row.wins / (row.wins + row.losses)).toFixed(3))
        : 0,
  }));
}
