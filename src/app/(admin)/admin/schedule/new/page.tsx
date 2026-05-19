"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function NewGamePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [seasons, setSeasons] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [form, setForm] = useState({
    seasonId: "", homeTeamId: "", awayTeamId: "",
    weekNumber: "", gameNumber: "", gameType: "REGULAR_SEASON",
    scheduledAt: "", location: "", notes: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/teams").then((r) => r.json()),
      fetch("/api/seasons").then((r) => r.json()),
    ]).then(([td, sd]) => {
      setTeams(td.teams);
      setSeasons(sd.seasons);
      const active = sd.seasons.find((s: any) => s.status === "ACTIVE");
      if (active) setForm((p) => ({ ...p, seasonId: active.id }));
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        weekNumber: form.weekNumber ? parseInt(form.weekNumber) : null,
        gameNumber: form.gameNumber ? parseInt(form.gameNumber) : null,
      }),
    });
    if (res.ok) {
      toast.success("Game created");
      router.push("/admin/schedule");
    } else {
      toast.error("Failed to create game");
    }
    setLoading(false);
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Schedule New Game</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-card border rounded-xl p-6">
        <div>
          <label className="text-sm font-medium block mb-1">Season</label>
          <select value={form.seasonId} onChange={(e) => setForm((p) => ({ ...p, seasonId: e.target.value }))}
            required className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Select season…</option>
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">Home Team</label>
            <select value={form.homeTeamId} onChange={(e) => setForm((p) => ({ ...p, homeTeamId: e.target.value }))}
              required className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Select…</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Away Team</label>
            <select value={form.awayTeamId} onChange={(e) => setForm((p) => ({ ...p, awayTeamId: e.target.value }))}
              required className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Select…</option>
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
          <input type="text" placeholder="e.g. Seed #1 vs #8" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50">
            {loading ? "Creating…" : "Create Game"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded-md text-sm text-muted-foreground hover:bg-muted">Cancel</button>
        </div>
      </form>
    </div>
  );
}
