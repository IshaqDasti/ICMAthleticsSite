"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function RecalculateCareerStatsButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [count, setCount] = useState<number | null>(null);

  async function handleClick() {
    setStatus("loading");
    try {
      const res = await fetch("/api/stats/recalculate-career", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setCount(data.playersUpdated);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "loading"}
      className="w-full rounded-xl border bg-card p-6 hover:bg-muted/30 transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`w-8 h-8 text-violet-500 mb-2 ${status === "loading" ? "animate-spin" : ""}`} />
      <h3 className="font-bold">Recalculate Career Stats</h3>
      <p className="text-sm text-muted-foreground mt-1">
        {status === "loading" && "Recalculating…"}
        {status === "done" && `Done — ${count} player${count === 1 ? "" : "s"} updated.`}
        {status === "error" && "Something went wrong. Try again."}
        {status === "idle" && "Recompute all player career totals from game stats."}
      </p>
    </button>
  );
}
