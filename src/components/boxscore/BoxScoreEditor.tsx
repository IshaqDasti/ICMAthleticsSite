"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save, UserPlus, X, Trash2 } from "lucide-react";

interface PlayerRow {
  rowKey: string;
  playerId: string | null;
  substituteStatsId: string | null;
  teamId: string;
  displayName: string;
  jerseyNumber: string | null;
  isSubstitute: boolean;
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
  initialScorekeeperName: string | null;
}

export function BoxScoreEditor({
  gameId,
  homeTeam,
  awayTeam,
  initialHomeScore,
  initialAwayScore,
  initialRows,
  initialScorekeeperName,
}: Props) {
  const [rows, setRows] = useState<PlayerRow[]>(initialRows);
  const [homeScore, setHomeScore] = useState(initialHomeScore);
  const [awayScore, setAwayScore] = useState(initialAwayScore);
  const [scorekeeperName, setScorekeeperName] = useState(initialScorekeeperName ?? "");
  const [saving, setSaving] = useState(false);
  const [addingSubForTeam, setAddingSubForTeam] = useState<string | null>(null);
  const [subName, setSubName] = useState("");
  const [subJersey, setSubJersey] = useState("");
  const [addingSub, setAddingSub] = useState(false);

  function updateRow(rowKey: string, field: "points" | "rebounds" | "assists" | "gamePlayed", value: number | boolean) {
    setRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, [field]: value } : r)));
  }

  async function handleAddSub(teamId: string) {
    if (!subName.trim()) return;
    setAddingSub(true);

    const res = await fetch(`/api/games/${gameId}/substitute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: subName.trim(),
        jersey: subJersey.trim() || undefined,
        teamId,
      }),
    });

    if (!res.ok) {
      toast.error("Failed to add substitute");
    } else {
      const data = await res.json();
      const newRow: PlayerRow = {
        rowKey: data.substitute.id,
        playerId: null,
        substituteStatsId: data.substitute.id,
        teamId,
        displayName: data.substitute.substituteName,
        jerseyNumber: data.substitute.substituteJersey ?? null,
        isSubstitute: true,
        points: 0,
        rebounds: 0,
        assists: 0,
        gamePlayed: true,
      };
      setRows((prev) => [...prev, newRow]);
      setAddingSubForTeam(null);
      setSubName("");
      setSubJersey("");
      toast.success(`${newRow.displayName} added as substitute`);
    }
    setAddingSub(false);
  }

  function cancelAddSub() {
    setAddingSubForTeam(null);
    setSubName("");
    setSubJersey("");
  }

  async function handleDeleteSub(substituteStatsId: string, displayName: string) {
    if (!confirm(`Remove ${displayName}? Their stats will be deleted from this game.`)) return;

    const res = await fetch(`/api/games/${gameId}/substitute`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statsId: substituteStatsId }),
    });

    if (!res.ok) {
      toast.error("Failed to remove substitute");
    } else {
      setRows((prev) => prev.filter((r) => r.substituteStatsId !== substituteStatsId));
      toast.success(`${displayName} removed`);
    }
  }

  async function handleSave() {
    setSaving(true);

    const playerStats = rows
      .filter((r) => !r.isSubstitute)
      .map(({ playerId, teamId, points, rebounds, assists, gamePlayed }) => ({
        playerId: playerId!,
        teamId,
        points,
        rebounds,
        assists,
        gamePlayed,
      }));

    const substituteStats = rows
      .filter((r) => r.isSubstitute)
      .map(({ substituteStatsId, points, rebounds, assists, gamePlayed }) => ({
        substituteStatsId: substituteStatsId!,
        points,
        rebounds,
        assists,
        gamePlayed,
      }));

    const res = await fetch(`/api/games/${gameId}/boxscore`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerStats, substituteStats, homeScore, awayScore, scorekeeperName: scorekeeperName.trim() || null }),
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

  function renderTeamTable(team: { id: string; name: string }, teamRows: PlayerRow[]) {
    return (
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
              <th className="px-4 py-2 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {teamRows.map((row) => (
              <tr key={row.rowKey} className="hover:bg-muted/20">
                <td className="px-4 py-2 font-medium">
                  {row.jerseyNumber !== null && (
                    <span className="text-xs text-muted-foreground mr-1.5">#{row.jerseyNumber}</span>
                  )}
                  {row.displayName}
                  {row.isSubstitute && (
                    <span className="text-xs text-muted-foreground ml-1.5">(sub)</span>
                  )}
                </td>
                {(["points", "rebounds", "assists"] as const).map((field) => (
                  <td key={field} className="px-4 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      value={row[field]}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        updateRow(row.rowKey, field, Math.max(0, parseInt(e.target.value) || 0))
                      }
                      className="w-14 text-center px-2 py-1 rounded border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </td>
                ))}
                <td className="px-4 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={row.gamePlayed}
                    onChange={(e) => updateRow(row.rowKey, "gamePlayed", e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  {row.isSubstitute && (
                    <button
                      onClick={() => handleDeleteSub(row.substituteStatsId!, row.displayName)}
                      className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      title="Remove substitute"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
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

        <div className="px-4 py-3 border-t bg-muted/10">
          {addingSubForTeam === team.id ? (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Name *"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSub(team.id)}
                className="flex-1 px-3 py-1.5 text-sm rounded border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <input
                type="text"
                placeholder="#"
                value={subJersey}
                onChange={(e) => setSubJersey(e.target.value)}
                className="w-16 px-2 py-1.5 text-sm rounded border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={() => handleAddSub(team.id)}
                disabled={!subName.trim() || addingSub}
                className="px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded font-medium disabled:opacity-50"
              >
                {addingSub ? "…" : "Add"}
              </button>
              <button
                onClick={cancelAddSub}
                className="p-1.5 border rounded hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setAddingSubForTeam(team.id); setSubName(""); setSubJersey(""); }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add Substitute
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score override */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Final Score
        </h2>
        <div className="mb-4">
          <label className="text-xs text-muted-foreground block mb-1">Scorekeeper</label>
          <input
            type="text"
            value={scorekeeperName}
            onChange={(e) => setScorekeeperName(e.target.value)}
            placeholder="Enter scorekeeper name…"
            className="w-full max-w-xs px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderTeamTable(homeTeam, homeRows)}
        {renderTeamTable(awayTeam, awayRows)}
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
