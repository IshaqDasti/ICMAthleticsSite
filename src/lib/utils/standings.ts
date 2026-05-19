import { winPct } from "./stats";

export interface StandingsRow {
  teamId: string;
  teamName: string;
  teamSlug: string;
  logoUrl: string | null;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: number;
  rank?: number;
}

export function sortStandings(rows: StandingsRow[]): StandingsRow[] {
  return [...rows].sort((a, b) => {
    const pctA = winPct(a.wins, a.losses);
    const pctB = winPct(b.wins, b.losses);
    if (pctB !== pctA) return pctB - pctA;

    const diffA = a.pointsFor - a.pointsAgainst;
    const diffB = b.pointsFor - b.pointsAgainst;
    return diffB - diffA;
  });
}

export function formatStreak(streak: number): string {
  if (streak === 0) return "-";
  return streak > 0 ? `W${streak}` : `L${Math.abs(streak)}`;
}
