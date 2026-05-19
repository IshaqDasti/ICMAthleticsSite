import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/teams/:path*",
    "/api/players/:path*",
    "/api/games/:path*",
    "/api/seasons/:path*",
    "/api/standings/recalculate",
    "/api/announcements/:path*",
    "/api/upload",
    "/api/stats/export",
  ],
};
