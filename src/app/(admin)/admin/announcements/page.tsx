"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Megaphone, Pin, Trash2 } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  published: boolean;
  createdAt: string;
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [form, setForm] = useState({ title: "", body: "", pinned: false });
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/announcements");
    if (res.ok) { const d = await res.json(); setAnnouncements(d.announcements); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { toast.success("Announcement posted"); setForm({ title: "", body: "", pinned: false }); load(); }
    else toast.error("Failed");
    setLoading(false);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Megaphone className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Announcements</h1>
      </div>

      <form onSubmit={handleCreate} className="bg-card border rounded-xl p-4 space-y-3 mb-6">
        <input type="text" required placeholder="Title" value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        <textarea placeholder="Body" value={form.body}
          onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm((p) => ({ ...p, pinned: e.target.checked }))} />
            Pin announcement
          </label>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50">
            {loading ? "Posting…" : "Post"}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {announcements.map((a) => (
          <div key={a.id} className="bg-card border rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {a.pinned && <Pin className="w-3 h-3 text-primary inline mr-1" />}
                <p className="font-semibold inline">{a.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    const res = await fetch(`/api/announcements/${a.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ pinned: !a.pinned }),
                    });
                    if (res.ok) load();
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  title={a.pinned ? "Unpin" : "Pin"}
                >
                  <Pin className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("Delete this announcement?")) return;
                    const res = await fetch(`/api/announcements/${a.id}`, { method: "DELETE" });
                    if (res.ok) load();
                    else toast.error("Failed to delete");
                  }}
                  className="text-xs text-destructive hover:text-destructive/80"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
