"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function NewSeasonPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/seasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, status: "UPCOMING" }),
    });
    if (res.ok) {
      toast.success("Season created");
      router.push("/admin/seasons");
    } else {
      toast.error("Failed to create season");
    }
    setLoading(false);
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">New Season</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-card border rounded-xl p-6">
        <div>
          <label className="text-sm font-medium block mb-1">Season Name</label>
          <input type="text" required placeholder="e.g. Summer 2026" value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">Start Date</label>
            <input type="date" value={form.startDate}
              onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">End Date</label>
            <input type="date" value={form.endDate}
              onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50">
            {loading ? "Creating…" : "Create Season"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded-md text-sm text-muted-foreground hover:bg-muted">Cancel</button>
        </div>
      </form>
    </div>
  );
}
