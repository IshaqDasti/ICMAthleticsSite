"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronUp, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateAvg } from "@/lib/utils/stats";

interface PlayerRow {
  player: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string;
    slug: string;
    jerseyNumber: string | null;
    team: { id: string; name: string; slug: string } | null;
  };
  gamesPlayed: number;
  totalPoints: number;
  totalRebounds: number;
  totalAssists: number;
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
}

type SortKey = "avgPoints" | "avgRebounds" | "avgAssists" | "totalPoints" | "totalRebounds" | "totalAssists" | "gamesPlayed";

interface Props {
  players: PlayerRow[];
}

export function PlayerRankingsTable({ players }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("avgPoints");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"avg" | "total">("avg");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    let rows = [...players];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (p) =>
          `${p.player.firstName} ${p.player.lastName}`.toLowerCase().includes(q) ||
          p.player.team?.name.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      const va = a[sortKey] as number;
      const vb = b[sortKey] as number;
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return rows;
  }, [players, search, sortKey, sortDir]);

  function TH({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <th
        className="px-3 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-muted/60 transition-colors text-right"
        onClick={() => handleSort(col)}
      >
        <div className="flex items-center justify-end gap-1">
          {label}
          {active ? (
            sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronUp className="w-3 h-3 opacity-30" />
          )}
        </div>
      </th>
    );
  }

  const statsKeys: [SortKey, SortKey, SortKey] =
    viewMode === "avg"
      ? ["avgPoints", "avgRebounds", "avgAssists"]
      : ["totalPoints", "totalRebounds", "totalAssists"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players or teams…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex rounded-md border overflow-hidden">
          {(["avg", "total"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setViewMode(mode);
                setSortKey(mode === "avg" ? "avgPoints" : "totalPoints");
              }}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                viewMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {mode === "avg" ? "Averages" : "Totals"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider w-10">#</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Player</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Team</th>
              <TH col={statsKeys[0]} label={viewMode === "avg" ? "PPG" : "PTS"} />
              <TH col={statsKeys[1]} label={viewMode === "avg" ? "RPG" : "REB"} />
              <TH col={statsKeys[2]} label={viewMode === "avg" ? "APG" : "AST"} />
              <TH col="gamesPlayed" label="GP" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No players found
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr key={row.player.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3 text-muted-foreground text-center">{i + 1}</td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/players/${row.player.slug}`}
                      className="font-semibold hover:text-primary transition-colors"
                    >
                      {row.player.jerseyNumber !== null && (
                        <span className="text-muted-foreground mr-1.5 text-xs">
                          #{row.player.jerseyNumber}
                        </span>
                      )}
                      {row.player.firstName} {row.player.lastName}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {row.player.team ? (
                      <Link
                        href={`/teams/${row.player.team.slug}`}
                        className="hover:text-foreground transition-colors"
                      >
                        {row.player.team.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold">
                    {viewMode === "avg" ? row.avgPoints.toFixed(1) : row.totalPoints}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {viewMode === "avg" ? row.avgRebounds.toFixed(1) : row.totalRebounds}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {viewMode === "avg" ? row.avgAssists.toFixed(1) : row.totalAssists}
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground">{row.gamesPlayed}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
