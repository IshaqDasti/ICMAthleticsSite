import { prisma } from "@/lib/db/client";
import { getActiveSeason } from "@/lib/db/queries/seasons";
import Link from "next/link";
import { Users, Trophy, Calendar, Radio, ClipboardEdit } from "lucide-react";

export default async function AdminDashboard() {
  const season = await getActiveSeason();

  const [teamCount, playerCount, gameCount, liveGames] = await Promise.all([
    prisma.team.count(),
    prisma.player.count(),
    season ? prisma.game.count({ where: { seasonId: season.id } }) : 0,
    prisma.game.findMany({
      where: { isLive: true },
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    }),
  ]);

  const stats = [
    { label: "Teams", value: teamCount, icon: Trophy, href: "/admin/teams" },
    { label: "Players", value: playerCount, icon: Users, href: "/admin/players" },
    { label: "Games", value: gameCount, icon: Calendar, href: "/admin/schedule" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {liveGames.length > 0 && (
        <div className="mb-6 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="live-dot w-2 h-2 rounded-full bg-red-600" />
            <h2 className="font-bold text-red-700 dark:text-red-400">Games In Progress</h2>
          </div>
          <div className="space-y-2">
            {liveGames.map((g) => (
              <Link
                key={g.id}
                href={`/admin/live/${g.id}`}
                className="block text-sm font-medium hover:text-red-600 dark:hover:text-red-400"
              >
                {g.homeTeam.name} {g.homeScore} — {g.awayScore} {g.awayTeam.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <div className="rounded-xl border bg-card p-5 hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <s.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-3xl font-black mt-2">{s.value}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/admin/live">
          <div className="rounded-xl border bg-card p-6 hover:bg-muted/30 transition-colors">
            <Radio className="w-8 h-8 text-red-500 mb-2" />
            <h3 className="font-bold">Live Scoring</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Track a game in real time with scorekeeping controls.
            </p>
          </div>
        </Link>
        <Link href="/admin/players/import">
          <div className="rounded-xl border bg-card p-6 hover:bg-muted/30 transition-colors">
            <Users className="w-8 h-8 text-blue-500 mb-2" />
            <h3 className="font-bold">Import Roster</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a CSV file to bulk-add players.
            </p>
          </div>
        </Link>
        <Link href="/admin/boxscores">
          <div className="rounded-xl border bg-card p-6 hover:bg-muted/30 transition-colors">
            <ClipboardEdit className="w-8 h-8 text-emerald-500 mb-2" />
            <h3 className="font-bold">Edit Box Scores</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Manually update player stats and final scores for any game.
            </p>
          </div>
        </Link>
      </div>

      {season && (
        <p className="text-sm text-muted-foreground mt-6">
          Active season: <span className="font-medium text-foreground">{season.name}</span>
        </p>
      )}
    </div>
  );
}
