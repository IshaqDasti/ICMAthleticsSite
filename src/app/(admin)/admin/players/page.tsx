import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { Plus, Upload } from "lucide-react";
import { AdminPlayersTable } from "@/components/players/AdminPlayersTable";

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: { teamId?: string };
}) {
  const players = await prisma.player.findMany({
    where: {
      ...(searchParams.teamId && { teamId: searchParams.teamId }),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      jerseyNumber: true,
      isInjured: true,
      team: { select: { id: true, name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Players</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/players/import"
            className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </Link>
          <Link
            href="/admin/players/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Add Player
          </Link>
        </div>
      </div>

      <AdminPlayersTable players={players} />
    </div>
  );
}
