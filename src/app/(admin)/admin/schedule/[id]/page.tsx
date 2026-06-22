"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Trash2, RotateCcw } from "lucide-react";

export default function EditGamePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [gameStatus, setGameStatus] = useState<string>("SCHEDULED");
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [seasons, setSeasons] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    seasonId: "", homeTeamId: "", awayTeamId: "",
    weekNumber: "", gameType: "REGULAR_SEASON",
    scheduledAt: "", location: "", notes: "",
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/games/${id}`).then((r) => r.json()),
      fetch("/api/teams").then((r) => r.json()),
      fetch("/api/seasons").then((r) => r.json()),
    ]).then(([{ game }, { teams: t }, { seasons: s }]) => {
      setTeams(t);
      setSeasons(s);
      const scheduled = game.scheduledAt
        ? new Date(game.scheduledAt).toISOString().slice(0, 16)
        : "";
      setGameStatus(game.status ?? "SCHEDULED");
      setForm({
        seasonId: game.seasonId ?? "",
        homeTeamId: game.homeTeamId ?? "",
        awayTeamId: game.awayTeamId ?? "",
        weekNumber: game.weekNumber?.toString() ?? "",
        gameType: game.gameType ?? "REGULAR_SEASON",
        scheduledAt: scheduled,
        location: game.location ?? "",
        notes: game.notes ?? "",
      });
      setFetching(false);
    });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/games/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        weekNumber: form.weekNumber ? parseInt(form.weekNumber) : null,
      }),
    });
    if (res.ok) {
      toast.success("Game updated");
      router.push("/admin/schedule");
    } else {
      toast.error("Failed to update game");
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this game? This cannot be undone.")) return;
    const res = await fetch(`/api/games/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Game deleted");
      router.push("/admin/schedule");
    } else {
      toast.error("Failed to delete game");
    }
  }

  async function handleResetGame() {
    if (!confirm("Reset this game? This will delete all stats, box scores, and game events, and revert standings. This cannot be undone.")) return;
    setResetting(true);
    const res = await fetch(`/api/games/${id}/live`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    if (res.ok) {
      toast.success("Game reset to scheduled");
      setGameStatus("SCHEDULED");
    } else {
      toast.error("Failed to reset game");
    }
    setResetting(false);
  }

  if (fetching) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Edit Game</h1>
        <div className="flex items-center gap-4">
          {(gameStatus === "COMPLETED" || gameStatus === "IN_PROGRESS") && (
            <button
              onClick={handleResetGame}
              disabled={resetting}
              className="flex items-center gap-1 text-sm text-amber-600 hover:underline disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              {resetting ? "Resetting…" : "Reset Game"}
            </button>
          )}
          <button onClick={handleDelete} className="flex items-center gap-1 text-sm text-destructive hover:underline">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 bg-card border rounded-xl p-6">
        <div>
          <label className="text-sm font-medium block mb-1">Season</label>
          <select value={form.seasonId} onChange={(e) => setForm((p) => ({ ...p, seasonId: e.target.value }))}
            required className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">Home Team</label>
            <select value={form.homeTeamId} onChange={(e) => setForm((p) => ({ ...p, homeTeamId: e.target.value }))}
              required className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Away Team</label>
            <select value={form.awayTeamId} onChange={(e) => setForm((p) => ({ ...p, awayTeamId: e.target.value }))}
              required className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">Week #</label>
            <input type="number" value={form.weekNumber} onChange={(e) => setForm((p) => ({ ...p, weekNumber: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Game Type</label>
            <select value={form.gameType} onChange={(e) => setForm((p) => ({ ...p, gameType: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {["REGULAR_SEASON","QUARTERFINAL","SEMIFINAL","FINAL","ALLSTAR"].map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Date & Time</label>
          <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Location</label>
          <input type="text" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Notes</label>
          <input type="text" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50">
            {loading ? "Saving…" : "Save Changes"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded-md text-sm text-muted-foreground hover:bg-muted">Cancel</button>
        </div>
      </form>
    </div>
  );
}
