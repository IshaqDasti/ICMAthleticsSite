import { NextRequest, NextResponse } from "next/server";
import { getLeagueLeaders } from "@/lib/db/queries/players";
import { getActiveSeason } from "@/lib/db/queries/seasons";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let seasonId = searchParams.get("seasonId");

  if (!seasonId) {
    const active = await getActiveSeason();
    seasonId = active?.id ?? null;
  }

  if (!seasonId) return NextResponse.json({ leaders: [] });

  const leaders = await getLeagueLeaders(seasonId);
  return NextResponse.json({ leaders });
}
