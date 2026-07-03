import { Metadata } from "next";
import { getActiveSeason } from "@/lib/db/queries/seasons";
import { getStandings } from "@/lib/db/queries/standings";
import { StandingsTable } from "@/components/standings/StandingsTable";

export const metadata: Metadata = { title: "Standings" };
export const revalidate = 30;

export default async function StandingsPage() {
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
        <h1 className="text-3xl font-bold">Standings</h1>
        <p className="text-muted-foreground mt-1">{season.name}</p>
      </div>
      <StandingsTable rows={standings} />
    </div>
  );
}
