import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { getLeagueLeaders } from "@/lib/db/queries/players";
import { getActiveSeason } from "@/lib/db/queries/seasons";
import { generateCSVString } from "@/lib/utils/csv";

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  let seasonId = searchParams.get("seasonId");

  if (!seasonId) {
    const active = await getActiveSeason();
    seasonId = active?.id ?? null;
  }

  if (!seasonId) return NextResponse.json({ error: "No season" }, { status: 400 });

  const leaders = await getLeagueLeaders(seasonId);
  const rows = leaders.map((l) => ({
    Player: l.player.displayName,
    Team: l.player.team?.name ?? "",
    GP: l.gamesPlayed,
    PTS: l.totalPoints,
    REB: l.totalRebounds,
    AST: l.totalAssists,
    PPG: l.avgPoints,
    RPG: l.avgRebounds,
    APG: l.avgAssists,
  }));

  const csv = generateCSVString(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="stats-export.csv"`,
    },
  });
}, "SCOREKEEPER");
