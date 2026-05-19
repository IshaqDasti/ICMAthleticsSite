"use client";

import { useState } from "react";
import Link from "next/link";
import { formatWinPct, winPct } from "@/lib/utils/stats";
import { formatStreak } from "@/lib/utils/standings";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown } from "lucide-react";

export interface StandingsRow {
  rank: number;
  teamId: string;
  teamName: string;
  teamSlug: string;
  logoUrl: string | null;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  differential: number;
  streak: number;
  gamesPlayed: number;
  winPct: number;
}

type SortKey = "rank" | "wins" | "losses" | "winPct" | "pointsFor" | "pointsAgainst" | "differential" | "streak";

interface Props {
  rows: StandingsRow[];
}

export function StandingsTable({ rows: initialRows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  }

  const sorted = [...initialRows].sort((a, b) => {
    let va = a[sortKey as keyof StandingsRow] as number;
    let vb = b[sortKey as keyof StandingsRow] as number;
    return sortDir === "asc" ? va - vb : vb - va;
  });

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  }

  function TH({ col, label, className }: { col: SortKey; label: string; className?: string }) {
    return (
      <th
        className={cn(
          "px-3 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-muted/60 transition-colors",
          className
        )}
        onClick={() => handleSort(col)}
      >
        <div className="flex items-center gap-1 justify-end">
          <span>{label}</span>
          <SortIcon col={col} />
        </div>
      </th>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <TH col="rank" label="#" className="w-10 text-center" />
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">
              Team
            </th>
            <TH col="wins" label="W" />
            <TH col="losses" label="L" />
            <TH col="winPct" label="PCT" />
            <TH col="pointsFor" label="PF" />
            <TH col="pointsAgainst" label="PA" />
            <TH col="differential" label="DIFF" />
            <TH col="streak" label="STRK" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((row, i) => (
            <tr
              key={row.teamId}
              className={cn(
                "transition-colors hover:bg-muted/30",
                i === 7 && "border-t-2 border-dashed border-muted-foreground/40"
              )}
            >
              <td className="px-3 py-3 text-center font-medium text-muted-foreground">
                {row.rank}
              </td>
              <td className="px-3 py-3">
                <Link
                  href={`/teams/${row.teamSlug}`}
                  className="font-semibold hover:text-primary transition-colors"
                >
                  {row.teamName}
                </Link>
              </td>
              <td className="px-3 py-3 text-right font-semibold">{row.wins}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{row.losses}</td>
              <td className="px-3 py-3 text-right">{formatWinPct(row.wins, row.losses)}</td>
              <td className="px-3 py-3 text-right">{row.pointsFor}</td>
              <td className="px-3 py-3 text-right">{row.pointsAgainst}</td>
              <td
                className={cn(
                  "px-3 py-3 text-right font-medium",
                  row.differential > 0
                    ? "text-green-600 dark:text-green-400"
                    : row.differential < 0
                    ? "text-red-500 dark:text-red-400"
                    : "text-muted-foreground"
                )}
              >
                {row.differential > 0 ? `+${row.differential}` : row.differential}
              </td>
              <td
                className={cn(
                  "px-3 py-3 text-right font-medium text-xs",
                  row.streak > 0
                    ? "text-green-600 dark:text-green-400"
                    : row.streak < 0
                    ? "text-red-500 dark:text-red-400"
                    : "text-muted-foreground"
                )}
              >
                {formatStreak(row.streak)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 bg-muted/30 border-t text-xs text-muted-foreground">
        Dashed line separates top 8 playoff seeds from eliminated teams.
      </div>
    </div>
  );
}
