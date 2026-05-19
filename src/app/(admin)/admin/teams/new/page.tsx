"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function NewTeamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", captainName: "", primaryColor: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast.success("Team created");
      router.push("/admin/teams");
    } else {
      toast.error("Failed to create team");
    }
    setLoading(false);
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">New Team</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-card border rounded-xl p-6">
        {[
          { name: "name", label: "Team Name", required: true },
          { name: "captainName", label: "Captain Name" },
          { name: "primaryColor", label: "Primary Color (hex)", placeholder: "#3b82f6" },
        ].map((field) => (
          <div key={field.name}>
            <label className="text-sm font-medium block mb-1">{field.label}</label>
            <input
              type="text"
              required={field.required}
              placeholder={field.placeholder}
              value={form[field.name as keyof typeof form]}
              onChange={(e) => setForm((p) => ({ ...p, [field.name]: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create Team"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border rounded-md text-sm text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
