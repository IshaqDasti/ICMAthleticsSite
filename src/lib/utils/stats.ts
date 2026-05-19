export function calculateAvg(total: number, games: number, decimals = 1): number {
  if (games === 0) return 0;
  return parseFloat((total / games).toFixed(decimals));
}

export function formatStat(value: number, decimals = 1): string {
  return value.toFixed(decimals);
}

export function winPct(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0;
  return parseFloat((wins / total).toFixed(3));
}

export function formatWinPct(wins: number, losses: number): string {
  const pct = winPct(wins, losses);
  return pct.toFixed(3).replace(/^0/, "");
}
