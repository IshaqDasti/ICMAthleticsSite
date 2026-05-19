"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface GameStatPoint {
  game: string;
  points: number;
  rebounds: number;
  assists: number;
}

interface Props {
  data: GameStatPoint[];
}

export function PlayerStatChart({ data }: Props) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Not enough games to show trend
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="game" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="points" stroke="#3b82f6" strokeWidth={2} dot={false} name="PTS" />
        <Line type="monotone" dataKey="rebounds" stroke="#22c55e" strokeWidth={2} dot={false} name="REB" />
        <Line type="monotone" dataKey="assists" stroke="#f59e0b" strokeWidth={2} dot={false} name="AST" />
      </LineChart>
    </ResponsiveContainer>
  );
}
