"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export default function EditPlayerPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    firstName: "", lastName: "", displayName: "",
    jerseyNumber: "", teamId: "", email: "", instagramHandle: "",
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/players/${id}`).then((r) => r.json()),
      fetch("/api/teams").then((r) => r.json()),
    ]).then(([{ player }, { teams: t }]) => {
      setForm({
        firstName: player.firstName ?? "",
        lastName: player.lastName ?? "",
        displayName: player.displayName ?? "",
        jerseyNumber: player.jerseyNumber?.toString() ?? "",
        teamId: player.teamId ?? "",
        email: player.email ?? "",
        instagramHandle: player.instagramHandle ?? "",
      });
      setTeams(t);
      setFetching(false);
    });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/players/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        jerseyNumber: form.jerseyNumber ? parseInt(form.jerseyNumber) : null,
        teamId: form.teamId || null,
      }),
    });
    if (res.ok) {
      toast.success("Player updated");
      router.push("/admin/players");
    } else {
      toast.error("Failed to update player");
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this player? This cannot be undone.")) return;
    const res = await fetch(`/api/players/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Player deleted");
      router.push("/admin/players");
    } else {
      toast.error("Failed to delete player");
    }
  }

  if (fetching) return <div className="text-muted-foreground">Loading…</div>;

  const fields = [
    { name: "firstName", label: "First Name", required: true },
    { name: "lastName", label: "Last Name", required: true },
    { name: "displayName", label: "Jersey Name (display)", placeholder: "e.g. Diakite" },
    { name: "jerseyNumber", label: "Jersey Number", type: "number" },
    { name: "email", label: "Email", type: "email" },
    { name: "instagramHandle", label: "Instagram Handle", placeholder: "@handle" },
  ];

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Edit Player</h1>
        <button onClick={handleDelete} className="flex items-center gap-1 text-sm text-destructive hover:underline">
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 bg-card border rounded-xl p-6">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="text-sm font-medium block mb-1">{field.label}</label>
            <input
              type={field.type ?? "text"}
              required={field.required}
              placeholder={field.placeholder}
              value={form[field.name as keyof typeof form]}
              onChange={(e) => setForm((p) => ({ ...p, [field.name]: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}
        <div>
          <label className="text-sm font-medium block mb-1">Team</label>
          <select
            value={form.teamId}
            onChange={(e) => setForm((p) => ({ ...p, teamId: e.target.value }))}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">No team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save Changes"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded-md text-sm text-muted-foreground hover:bg-muted">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
