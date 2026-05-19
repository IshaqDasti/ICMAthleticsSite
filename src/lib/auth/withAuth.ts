import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/client";
import { UserRole, User } from "@prisma/client";

const roleHierarchy: Record<UserRole, number> = {
  TEAM_MANAGER: 1,
  SCOREKEEPER: 2,
  SUPER_ADMIN: 3,
};

type Handler = (
  req: NextRequest,
  user: User,
  context: { params: Record<string, string> }
) => Promise<NextResponse | Response>;

export function withAuth(handler: Handler, requiredRole: UserRole = "SCOREKEEPER") {
  return async (
    req: NextRequest,
    context: { params: Record<string, string> }
  ) => {
    try {
      const supabase = createClient();
      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser();

      if (!supabaseUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const user = await prisma.user.findUnique({
        where: { supabaseId: supabaseUser.id },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 401 });
      }

      if (roleHierarchy[user.role] < roleHierarchy[requiredRole]) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return handler(req, user, context);
    } catch (error) {
      console.error("Auth error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
