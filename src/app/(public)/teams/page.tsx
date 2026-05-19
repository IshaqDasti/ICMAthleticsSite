import { Metadata } from "next";
import Link from "next/link";
import { getActiveSeason } from "@/lib/db/queries/seasons";
import { getStandings } from "@/lib/db/queries/standings";
import { formatWinPct } from "@/lib/utils/stats";
import { Trophy } from "lucide-react";

export const metadata: Metadata = { title: "Teams" };
export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const season = await getActiveSeason();
  if (!season) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        No active season found.
      </div>
    );
  }

  const standings = await getStandings(season.id);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Teams</h1>
        <p className="text-muted-foreground mt-1">{season.name}</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {standings.map((row) => (
          <Link key={row.teamId} href={`/teams/${row.teamSlug}`}>
            <div className="rounded-xl border bg-card hover:bg-muted/30 transition-colors p-5">
              <div className="flex items-center gap-3 mb-3">
                {row.logoUrl ? (
                  <img
                    src={row.logoUrl}
                    alt={row.teamName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div>
                  <p className="font-bold">{row.teamName}</p>
                  <p className="text-sm text-muted-foreground">
                    #{row.rank} seed
                  </p>
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <p className="font-bold text-lg">{row.wins}-{row.losses}</p>
                  <p className="text-xs text-muted-foreground">Record</p>
                </div>
                <div>
                  <p className="font-bold text-lg">{formatWinPct(row.wins, row.losses)}</p>
                  <p className="text-xs text-muted-foreground">Win%</p>
                </div>
                <div>
                  <p className={`font-bold text-lg ${row.differential >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                    {row.differential > 0 ? `+${row.differential}` : row.differential}
                  </p>
                  <p className="text-xs text-muted-foreground">Diff</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
