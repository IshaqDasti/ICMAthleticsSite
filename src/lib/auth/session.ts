import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/client";
import { UserRole } from "@prisma/client";

export async function getServerSession() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { managedTeam: true },
  });

  return dbUser;
}

export async function requireAuth() {
  const session = await getServerSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireRole(role: UserRole) {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");

  const roleHierarchy: Record<UserRole, number> = {
    TEAM_MANAGER: 1,
    SCOREKEEPER: 2,
    SUPER_ADMIN: 3,
  };

  if (roleHierarchy[session.role] < roleHierarchy[role]) {
    throw new Error("Forbidden");
  }

  return session;
}
