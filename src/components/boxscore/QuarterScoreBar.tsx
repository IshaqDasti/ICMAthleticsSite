interface Props {
  homeScores: number[];
  awayScores: number[];
  homeTeamName: string;
  awayTeamName: string;
}

export function QuarterScoreBar({ homeScores, awayScores, homeTeamName, awayTeamName }: Props) {
  const quarters = Math.max(homeScores.length, awayScores.length);
  const labels = Array.from({ length: quarters }, (_, i) =>
    i < 4 ? `Q${i + 1}` : `OT${i - 3}`
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-center">
        <thead>
          <tr className="text-muted-foreground text-xs">
            <th className="px-2 py-1 text-left font-medium">Team</th>
            {labels.map((l) => (
              <th key={l} className="px-3 py-1 font-medium">{l}</th>
            ))}
            <th className="px-3 py-1 font-semibold">T</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <td className="px-2 py-1 text-left font-medium text-xs truncate max-w-[80px]">
              {homeTeamName}
            </td>
            {labels.map((_, i) => (
              <td key={i} className="px-3 py-1 tabular-nums">
                {homeScores[i] ?? 0}
              </td>
            ))}
            <td className="px-3 py-1 font-bold tabular-nums">
              {homeScores.reduce((a, b) => a + b, 0)}
            </td>
          </tr>
          <tr className="border-t">
            <td className="px-2 py-1 text-left font-medium text-xs truncate max-w-[80px]">
              {awayTeamName}
            </td>
            {labels.map((_, i) => (
              <td key={i} className="px-3 py-1 tabular-nums">
                {awayScores[i] ?? 0}
              </td>
            ))}
            <td className="px-3 py-1 font-bold tabular-nums">
              {awayScores.reduce((a, b) => a + b, 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
