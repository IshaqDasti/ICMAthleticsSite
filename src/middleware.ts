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
  // API routes are intentionally excluded: withAuth() authenticates every
  // protected handler itself, so running the Supabase session round-trip
  // here would only add latency to public endpoints polled during live games.
  matcher: ["/admin/:path*"],
};
