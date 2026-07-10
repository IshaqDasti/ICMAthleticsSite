import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { Plus, Edit, Upload } from "lucide-react";

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: { search?: string; teamId?: string };
}) {
  const players = await prisma.player.findMany({
    where: {
      ...(searchParams.teamId && { teamId: searchParams.teamId }),
      ...(searchParams.search && {
        OR: [
          { firstName: { contains: searchParams.search, mode: "insensitive" } },
          { lastName: { contains: searchParams.search, mode: "insensitive" } },
          { displayName: { contains: searchParams.search, mode: "insensitive" } },
        ],
      }),
    },
    include: { team: { select: { id: true, name: true } } },
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

      <form className="mb-4 flex gap-2">
        <input
          name="search"
          defaultValue={searchParams.search}
          placeholder="Search players…"
          className="px-3 py-2 text-sm rounded-md border bg-background flex-1 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
          Search
        </button>
      </form>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Player</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Team</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {players.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-muted-foreground">{p.jerseyNumber ?? "—"}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {p.displayName}
                    {p.isInjured && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-destructive/10 text-destructive">
                        Injured
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.firstName} {p.lastName}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.team?.name ?? "No team"}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/players/${p.id}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="w-3 h-3" />
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
