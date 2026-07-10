"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Edit, Search } from "lucide-react";

interface PlayerRow {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  jerseyNumber: string | null;
  isInjured: boolean;
  team: { id: string; name: string } | null;
}

interface Props {
  players: PlayerRow[];
}

export function AdminPlayersTable({ players }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return players;
    const q = search.toLowerCase();
    return players.filter(
      (p) =>
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        p.displayName.toLowerCase().includes(q)
    );
  }, [players, search]);

  return (
    <>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No players found
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
