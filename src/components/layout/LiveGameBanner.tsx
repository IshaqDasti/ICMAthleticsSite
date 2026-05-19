"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface LiveGame {
  id: string;
  homeScore: number;
  awayScore: number;
  homeTeam: { name: string; slug: string };
  awayTeam: { name: string; slug: string };
}

export function LiveGameBanner() {
  const [liveGames, setLiveGames] = useState<LiveGame[]>([]);

  useEffect(() => {
    let mounted = true;

    async function fetchLiveGames() {
      const res = await fetch("/api/games?isLive=true&limit=3");
      if (res.ok) {
        const data = await res.json();
        if (mounted) setLiveGames(data.games ?? []);
      }
    }

    fetchLiveGames();

    const supabase = createClient();
    const channel = supabase
      .channel("live-games-banner")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: "is_live=eq.true" },
        (payload) => {
          setLiveGames((prev) =>
            prev.map((g) =>
              g.id === payload.new.id
                ? { ...g, homeScore: payload.new.home_score, awayScore: payload.new.away_score }
                : g
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games" },
        () => fetchLiveGames()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  if (liveGames.length === 0) return null;

  return (
    <div className="bg-red-600 dark:bg-red-700 text-white">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="live-dot w-2 h-2 rounded-full bg-white inline-block" />
            <span className="text-xs font-bold uppercase tracking-wider">Live</span>
          </div>
          <div className="flex items-center gap-4">
            {liveGames.map((game) => (
              <Link
                key={game.id}
                href={`/games/${game.id}`}
                className="text-sm font-medium whitespace-nowrap hover:underline"
              >
                {game.homeTeam.name}{" "}
                <span className="font-bold">{game.homeScore}</span>
                {" – "}
                <span className="font-bold">{game.awayScore}</span>{" "}
                {game.awayTeam.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
