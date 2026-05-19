import { NextRequest, NextResponse } from "next/server";
import { getStandings } from "@/lib/db/queries/standings";
import { getActiveSeason } from "@/lib/db/queries/seasons";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let seasonId = searchParams.get("seasonId");

  if (!seasonId) {
    const active = await getActiveSeason();
    seasonId = active?.id ?? null;
  }

  if (!seasonId) return NextResponse.json({ standings: [] });

  const standings = await getStandings(seasonId);
  return NextResponse.json({ standings });
}
