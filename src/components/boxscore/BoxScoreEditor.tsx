"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface PlayerRow {
  playerId: string;
  teamId: string;
  displayName: string;
  jerseyNumber: number | null;
  points: number;
  rebounds: number;
  assists: number;
  gamePlayed: boolean;
}

interface Props {
  gameId: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  initialHomeScore: number;
  initialAwayScore: number;
  initialRows: PlayerRow[];
}

export function BoxScoreEditor({
  gameId,
  homeTeam,
  awayTeam,
  initialHomeScore,
  initialAwayScore,
  initialRows,
}: Props) {
  const [rows, setRows] = useState<PlayerRow[]>(initialRows);
  const [homeScore, setHomeScore] = useState(initialHomeScore);
  const [awayScore, setAwayScore] = useState(initialAwayScore);
  const [saving, setSaving] = useState(false);

  function updateRow(playerId: string, field: keyof PlayerRow, value: number | boolean) {
    setRows((prev) =>
      prev.map((r) => (r.playerId === playerId ? { ...r, [field]: value } : r))
    );
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/games/${gameId}/boxscore`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerStats: rows.map(({ playerId, teamId, points, rebounds, assists, gamePlayed }) => ({
          playerId,
          teamId,
          points,
          rebounds,
          assists,
          gamePlayed,
        })),
        homeScore,
        awayScore,
      }),
    });
    if (res.ok) {
      toast.success("Box score saved");
    } else {
      toast.error("Failed to save box score");
    }
    setSaving(false);
  }

  const homeRows = rows.filter((r) => r.teamId === homeTeam.id);
  const awayRows = rows.filter((r) => r.teamId === awayTeam.id);

  return (
    <div className="space-y-6">
      {/* Score override */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Final Score
        </h2>
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">{homeTeam.name}</label>
            <input
              type="number"
              min={0}
              value={homeScore}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setHomeScore(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <span className="text-muted-foreground font-bold mt-5">—</span>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">{awayTeam.name}</label>
            <input
              type="number"
              min={0}
              value={awayScore}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setAwayScore(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Player stats tables — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { team: homeTeam, teamRows: homeRows },
          { team: awayTeam, teamRows: awayRows },
        ].map(({ team, teamRows }) => (
          <div key={team.id} className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h2 className="font-semibold">{team.name}</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/20">
                <tr>
                  <th className="px-4 py-2 text-left">Player</th>
                  <th className="px-4 py-2 text-center w-16">PTS</th>
                  <th className="px-4 py-2 text-center w-16">REB</th>
                  <th className="px-4 py-2 text-center w-16">AST</th>
                  <th className="px-4 py-2 text-center w-20">Played</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teamRows.map((row) => (
                  <tr key={row.playerId} className="hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium">
                      {row.jerseyNumber !== null && (
                        <span className="text-xs text-muted-foreground mr-1.5">#{row.jerseyNumber}</span>
                      )}
                      {row.displayName}
                    </td>
                    {(["points", "rebounds", "assists"] as const).map((field) => (
                      <td key={field} className="px-4 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          value={row[field]}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            updateRow(row.playerId, field, Math.max(0, parseInt(e.target.value) || 0))
                          }
                          className="w-14 text-center px-2 py-1 rounded border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.gamePlayed}
                        onChange={(e) => updateRow(row.playerId, "gamePlayed", e.target.checked)}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
                {teamRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-sm">
                      No players on this team yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        <Save className="w-4 h-4" />
        {saving ? "Saving…" : "Save Box Score"}
      </button>
    </div>
  );
}
