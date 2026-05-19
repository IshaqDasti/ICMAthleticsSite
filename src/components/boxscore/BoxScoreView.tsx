"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BoxScoreTeam } from "./BoxScoreTeam";
import { QuarterScoreBar } from "./QuarterScoreBar";
import { LiveScoreBadge } from "./LiveScoreBadge";
import { formatGameDateTime } from "@/lib/utils/dates";
import { MapPin } from "lucide-react";

interface PlayerStat {
  id: string;
  points: number;
  rebounds: number;
  assists: number;
  gamePlayed: boolean;
  player: {
    id: string;
    displayName: string;
    slug: string;
    jerseyNumber: number | null;
    photoUrl: string | null;
  };
}

interface BoxScoreGame {
  id: string;
  status: string;
  isLive: boolean;
  currentQuarter: number;
  homeScore: number;
  awayScore: number;
  homeQuarterScores: number[];
  awayQuarterScores: number[];
  scheduledAt: Date | string | null;
  location: string | null;
  notes: string | null;
  homeTeam: { id: string; name: string; slug: string; logoUrl: string | null };
  awayTeam: { id: string; name: string; slug: string; logoUrl: string | null };
  season: { id: string; name: string };
}

interface Props {
  game: BoxScoreGame;
  homeStats: PlayerStat[];
  awayStats: PlayerStat[];
}

export function BoxScoreView({ game: initialGame, homeStats: initialHome, awayStats: initialAway }: Props) {
  const [game, setGame] = useState(initialGame);
  const [homeStats, setHomeStats] = useState(initialHome);
  const [awayStats, setAwayStats] = useState(initialAway);

  useEffect(() => {
    if (!game.isLive) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`game-boxscore-${game.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${game.id}` },
        (payload) => {
          setGame((prev) => ({
            ...prev,
            homeScore: payload.new.home_score,
            awayScore: payload.new.away_score,
            currentQuarter: payload.new.current_quarter,
            isLive: payload.new.is_live,
            status: payload.new.status,
            homeQuarterScores: payload.new.home_quarter_scores ?? prev.homeQuarterScores,
            awayQuarterScores: payload.new.away_quarter_scores ?? prev.awayQuarterScores,
          }));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_game_stats", filter: `game_id=eq.${game.id}` },
        async () => {
          const res = await fetch(`/api/games/${game.id}/boxscore`);
          if (res.ok) {
            const data = await res.json();
            setHomeStats(data.homeStats);
            setAwayStats(data.awayStats);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [game.id, game.isLive]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{game.season.name}</span>
          <LiveScoreBadge isLive={game.isLive} quarter={game.currentQuarter} />
        </div>

        {game.notes && (
          <p className="text-sm text-center text-muted-foreground mb-4">{game.notes}</p>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-center">
            <p className="font-bold text-lg">{game.homeTeam.name}</p>
            <p className="text-5xl font-black tabular-nums mt-2">{game.homeScore}</p>
          </div>
          <div className="text-center text-muted-foreground text-sm font-medium">
            {game.status === "SCHEDULED" ? "vs" : "—"}
          </div>
          <div className="flex-1 text-center">
            <p className="font-bold text-lg">{game.awayTeam.name}</p>
            <p className="text-5xl font-black tabular-nums mt-2">{game.awayScore}</p>
          </div>
        </div>

        {(game.homeQuarterScores.length > 0 || game.awayQuarterScores.length > 0) && (
          <div className="mt-4">
            <QuarterScoreBar
              homeScores={game.homeQuarterScores}
              awayScores={game.awayQuarterScores}
              homeTeamName={game.homeTeam.name}
              awayTeamName={game.awayTeam.name}
            />
          </div>
        )}

        {(game.scheduledAt || game.location) && (
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            {game.scheduledAt && <span>{formatGameDateTime(game.scheduledAt)}</span>}
            {game.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {game.location}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <BoxScoreTeam
          teamName={game.homeTeam.name}
          stats={homeStats}
          isWinner={game.status === "COMPLETED" && game.homeScore > game.awayScore}
        />
        <BoxScoreTeam
          teamName={game.awayTeam.name}
          stats={awayStats}
          isWinner={game.status === "COMPLETED" && game.awayScore > game.homeScore}
        />
      </div>
    </div>
  );
}
