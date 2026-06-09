"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function NewPlayerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    firstName: "", lastName: "", displayName: "",
    jerseyNumber: "", teamId: "", email: "", instagramHandle: "",
  });

  useEffect(() => {
    fetch("/api/teams").then((r) => r.json()).then((d) => setTeams(d.teams));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        jerseyNumber: form.jerseyNumber || null,
        teamId: form.teamId || null,
      }),
    });
    if (res.ok) {
      toast.success("Player created");
      router.push("/admin/players");
    } else {
      toast.error("Failed to create player");
    }
    setLoading(false);
  }

  const fields = [
    { name: "firstName", label: "First Name", required: true },
    { name: "lastName", label: "Last Name", required: true },
    { name: "displayName", label: "Jersey Name (display)", placeholder: "e.g. Diakite" },
    { name: "jerseyNumber", label: "Jersey Number", placeholder: "e.g. 00, 0, 23" },
    { name: "email", label: "Email", type: "email" },
    { name: "instagramHandle", label: "Instagram Handle", placeholder: "@handle" },
  ];

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Add Player</h1>
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
            {loading ? "Creating…" : "Create Player"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded-md text-sm text-muted-foreground hover:bg-muted">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
