"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Upload, CheckCircle } from "lucide-react";

export default function ImportPlayersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [seasons, setSeasons] = useState<Array<{ id: string; name: string }>>([]);
  const [seasonId, setSeasonId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  useEffect(() => {
    fetch("/api/seasons").then((r) => r.json()).then((d) => {
      setSeasons(d.seasons);
      const active = d.seasons.find((s: any) => s.status === "ACTIVE");
      if (active) setSeasonId(active.id);
    });
  }, []);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    if (seasonId) formData.append("seasonId", seasonId);

    const res = await fetch("/api/players/import", { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      setResult(data);
      toast.success(`Imported ${data.created} players`);
    } else {
      toast.error("Import failed");
    }
    setLoading(false);
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-2">Import Roster</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Upload the ICM Athletics registration CSV to bulk-add players.
      </p>

      {result ? (
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <h2 className="font-bold">Import Complete</h2>
          </div>
          <p className="text-sm mb-1">Created: <strong>{result.created}</strong></p>
          <p className="text-sm mb-1">Skipped: <strong>{result.skipped}</strong></p>
          {result.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-destructive mb-1">Errors ({result.errors.length}):</p>
              <div className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            </div>
          )}
          <button onClick={() => setResult(null)} className="mt-4 text-sm text-primary hover:underline">
            Import another file
          </button>
        </div>
      ) : (
        <form onSubmit={handleImport} className="bg-card border rounded-xl p-6 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Season</label>
            <select
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">No season</option>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">CSV File</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
              <Upload className="w-6 h-6 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {file ? file.name : "Click to upload CSV"}
              </p>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={!file || loading}
            className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Importing…" : "Import Players"}
          </button>
        </form>
      )}
    </div>
  );
}
