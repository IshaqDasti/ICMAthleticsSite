import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// Called by Vercel Cron every 5 minutes (requires Vercel Pro) or daily (Hobby).
// Also callable manually: GET /api/cron/update-game-statuses
// with Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // SCHEDULED → IN_PROGRESS: scheduled time has arrived
  const started = await prisma.game.updateMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
    data: { status: "IN_PROGRESS" },
  });

  // IN_PROGRESS → COMPLETED: 3 hours past start and no active scorekeeper
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const completed = await prisma.game.updateMany({
    where: {
      status: "IN_PROGRESS",
      isLive: false,
      scheduledAt: { lte: threeHoursAgo },
    },
    data: { status: "COMPLETED" },
  });

  return NextResponse.json({
    ok: true,
    started: started.count,
    completed: completed.count,
    checkedAt: now.toISOString(),
  });
}
