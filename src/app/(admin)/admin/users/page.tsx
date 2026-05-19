"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

const ROLES = ["SUPER_ADMIN", "SCOREKEEPER", "TEAM_MANAGER"];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((d) => setUsers(d.users ?? []));
  }, []);

  async function updateRole(userId: string, role: string) {
    setLoading(userId);
    const res = await fetch(`/api/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
      toast.success("Role updated");
    } else {
      toast.error("Failed to update role");
    }
    setLoading(null);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">User Management</h1>
      </div>

      {users.length === 0 ? (
        <p className="text-muted-foreground">No users found.</p>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name / Email</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id} className="bg-card">
                  <td className="px-4 py-3">
                    <p className="font-medium">{user.name ?? "—"}</p>
                    <p className="text-muted-foreground text-xs">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      disabled={loading === user.id}
                      onChange={(e) => updateRole(user.id, e.target.value)}
                      className="px-2 py-1 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
