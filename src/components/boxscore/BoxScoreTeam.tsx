import Link from "next/link";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerStat {
  id: string;
  points: number;
  rebounds: number;
  assists: number;
  gamePlayed: boolean;
  player: {
    id: string;
    displayName: string;
    slug: string;
    jerseyNumber: number | null;
    photoUrl: string | null;
  };
}

interface Props {
  teamName: string;
  stats: PlayerStat[];
  isWinner: boolean;
}

export function BoxScoreTeam({ teamName, stats, isWinner }: Props) {
  const played = stats.filter((s) => s.gamePlayed);
  const totals = played.reduce(
    (acc, s) => ({
      points: acc.points + s.points,
      rebounds: acc.rebounds + s.rebounds,
      assists: acc.assists + s.assists,
    }),
    { points: 0, rebounds: 0, assists: 0 }
  );

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className={cn("px-4 py-3 flex items-center gap-2", isWinner && "bg-primary/10")}>
        {isWinner && <Trophy className="w-4 h-4 text-primary" />}
        <h3 className="font-semibold">{teamName}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                Player
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider">PTS</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider">REB</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider">AST</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {played.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground text-xs">
                  No stats recorded yet
                </td>
              </tr>
            ) : (
              played.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link
                      href={`/players/${s.player.slug}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {s.player.jerseyNumber !== null && (
                        <span className="text-muted-foreground mr-1.5 text-xs">
                          #{s.player.jerseyNumber}
                        </span>
                      )}
                      {s.player.displayName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{s.points}</td>
                  <td className="px-3 py-2 text-right">{s.rebounds}</td>
                  <td className="px-3 py-2 text-right">{s.assists}</td>
                </tr>
              ))
            )}
          </tbody>
          {played.length > 0 && (
            <tfoot className="bg-muted/30 border-t font-semibold">
              <tr>
                <td className="px-3 py-2 text-xs uppercase text-muted-foreground">Team</td>
                <td className="px-3 py-2 text-right">{totals.points}</td>
                <td className="px-3 py-2 text-right">{totals.rebounds}</td>
                <td className="px-3 py-2 text-right">{totals.assists}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
