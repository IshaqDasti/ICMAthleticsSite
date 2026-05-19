import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { undoGameEvent } from "@/lib/db/mutations/stats";

export const DELETE = withAuth(async (_req, _user, { params }) => {
  await undoGameEvent(params.eventId);
  return NextResponse.json({ success: true });
}, "SCOREKEEPER");
