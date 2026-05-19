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
    let poll: ReturnType<typeof setInterval> | null = null;

    async function fetchLiveGames() {
      const res = await fetch("/api/games?isLive=true&limit=3");
      if (res.ok) {
        const data = await res.json();
        if (mounted) {
          const games: LiveGame[] = data.games ?? [];
          setLiveGames(games);

          if (games.length > 0 && !poll) {
            poll = setInterval(fetchLiveGames, 10_000);
          } else if (games.length === 0 && poll) {
            clearInterval(poll);
            poll = null;
          }
        }
      }
    }

    fetchLiveGames();

    const supabase = createClient();
    const channel = supabase
      .channel("live-games-banner")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        () => fetchLiveGames()
      )
      .subscribe();

    return () => {
      mounted = false;
      if (poll) clearInterval(poll);
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
