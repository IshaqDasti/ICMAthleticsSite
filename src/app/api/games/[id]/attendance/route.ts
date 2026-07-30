export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { prisma } from "@/lib/db/client";

// Attendance = the server-owned "played this game" flag (PlayerGameStats.gamePlayed),
// which feeds career gamesPlayed (see recalculatePlayerCareerStats). A player is marked
// played automatically when they record a stat; this route lets the scorekeeper mark a
// rostered player present even if they never recorded a stat (e.g. on the court but
// scoreless). No GameEvent is created — attendance is not a scoring action.
export const POST = withAuth(async (req: NextRequest, _user, { params }) => {
  const { playerId, teamId, present } = await req.json();

  if (!playerId || !teamId || typeof present !== "boolean") {
    return NextResponse.json({ error: "playerId, teamId and present are required" }, { status: 400 });
  }

  if (present) {
    const record = await prisma.playerGameStats.upsert({
      where: { gameId_playerId: { gameId: params.id, playerId } },
      create: { gameId: params.id, playerId, teamId, gamePlayed: true },
      update: { gamePlayed: true },
    });
    return NextResponse.json({ attendance: { id: record.id, playerId, gamePlayed: true } });
  }

  // present === false → un-mark. Only allowed when the player has no recorded stats;
  // a player with stats obviously played, so refuse (deduct the stats first instead).
  const stat = await prisma.playerGameStats.findUnique({
    where: { gameId_playerId: { gameId: params.id, playerId } },
  });

  if (!stat) {
    return NextResponse.json({ attendance: { playerId, gamePlayed: false } });
  }

  if (stat.points > 0 || stat.rebounds > 0 || stat.assists > 0 || stat.fouls > 0) {
    return NextResponse.json(
      { error: "Player has recorded stats. Deduct them before marking absent." },
      { status: 400 }
    );
  }

  await prisma.playerGameStats.delete({ where: { id: stat.id } });
  return NextResponse.json({ attendance: { playerId, gamePlayed: false } });
}, "SCOREKEEPER");
