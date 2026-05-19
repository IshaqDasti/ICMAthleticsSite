"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { RotateCcw, ChevronRight, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
  players: Array<{
    id: string;
    displayName: string;
    jerseyNumber: number | null;
  }>;
}

interface GameState {
  id: string;
  homeScore: number;
  awayScore: number;
  currentQuarter: number;
  isLive: boolean;
  status: string;
  homeTeam: Team;
  awayTeam: Team;
}

interface GameEvent {
  id: string;
  eventType: string;
  playerId: string | null;
  teamId: string | null;
  quarter: number;
  playerName?: string;
  teamName?: string;
  value: number;
}

interface PlayerStat {
  points: number;
  rebounds: number;
  assists: number;
}

interface Props {
  initialGame: GameState;
}

type EventType = "POINT" | "REBOUND" | "ASSIST";

export function ScorekeeperBoard({ initialGame }: Props) {
  const [game, setGame] = useState(initialGame);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialGame.homeTeam.id);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<GameEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStat>>({});

  const selectedTeam = game.homeTeam.id === selectedTeamId ? game.homeTeam : game.awayTeam;

  const fetchStats = useCallback(async () => {
    const res = await fetch(`/api/games/${game.id}/stats`);
    if (!res.ok) return;
    const data = await res.json();
    const map: Record<string, PlayerStat> = {};
    for (const s of data.stats) {
      map[s.playerId] = { points: s.points, rebounds: s.rebounds, assists: s.assists };
    }
    setPlayerStats(map);
  }, [game.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`scorekeeper-${game.id}`)
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
          }));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [game.id]);

  async function handleStartGame() {
    setIsStarting(true);
    const res = await fetch(`/api/games/${game.id}/live`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    if (!res.ok) toast.error("Failed to start game");
    setIsStarting(false);
  }

  async function handleEndGame() {
    if (!confirm("End game and finalize stats? This will update standings.")) return;
    setIsEnding(true);
    const res = await fetch(`/api/games/${game.id}/live`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end" }),
    });
    if (!res.ok) toast.error("Failed to end game");
    setIsEnding(false);
  }

  async function handleStartSecondHalf() {
    const res = await fetch(`/api/games/${game.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentQuarter: 2 }),
    });
    if (!res.ok) toast.error("Failed to start 2nd half");
  }

  async function handleStatEvent(type: EventType, value: number) {
    if (!selectedPlayerId) {
      toast.warning("Select a player first");
      return;
    }
    if (!game.isLive) {
      toast.warning("Start the game first");
      return;
    }

    setLoading(true);
    const isHome = selectedTeamId === game.homeTeam.id;

    // Optimistic score update
    if (type === "POINT") {
      setGame((prev) => ({
        ...prev,
        homeScore: isHome ? prev.homeScore + value : prev.homeScore,
        awayScore: !isHome ? prev.awayScore + value : prev.awayScore,
      }));
    }

    // Optimistic player stats update
    setPlayerStats((prev) => {
      const cur = prev[selectedPlayerId] ?? { points: 0, rebounds: 0, assists: 0 };
      return {
        ...prev,
        [selectedPlayerId]: {
          points: type === "POINT" ? cur.points + value : cur.points,
          rebounds: type === "REBOUND" ? cur.rebounds + value : cur.rebounds,
          assists: type === "ASSIST" ? cur.assists + value : cur.assists,
        },
      };
    });

    const res = await fetch(`/api/games/${game.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        playerId: selectedPlayerId,
        teamId: selectedTeamId,
        isHome,
        quarter: game.currentQuarter,
        value,
      }),
    });

    if (!res.ok) {
      // Rollback score
      if (type === "POINT") {
        setGame((prev) => ({
          ...prev,
          homeScore: isHome ? prev.homeScore - value : prev.homeScore,
          awayScore: !isHome ? prev.awayScore - value : prev.awayScore,
        }));
      }
      // Rollback player stats
      setPlayerStats((prev) => {
        const cur = prev[selectedPlayerId] ?? { points: 0, rebounds: 0, assists: 0 };
        return {
          ...prev,
          [selectedPlayerId]: {
            points: type === "POINT" ? cur.points - value : cur.points,
            rebounds: type === "REBOUND" ? cur.rebounds - value : cur.rebounds,
            assists: type === "ASSIST" ? cur.assists - value : cur.assists,
          },
        };
      });
      toast.error("Failed to record stat");
    } else {
      const data = await res.json();
      const playerName = selectedTeam.players.find((p) => p.id === selectedPlayerId)?.displayName ?? "Player";
      setLastEvent({
        id: data.event.id,
        eventType: type,
        playerId: selectedPlayerId,
        teamId: selectedTeamId,
        quarter: game.currentQuarter,
        playerName,
        teamName: selectedTeam.name,
        value,
      });
    }
    setLoading(false);
  }

  async function handleUndo() {
    if (!lastEvent) return;
    setLoading(true);
    const res = await fetch(`/api/games/${game.id}/events/${lastEvent.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to undo");
    } else {
      toast.success("Action undone");
      setLastEvent(null);
      fetchStats();
    }
    setLoading(false);
  }

  const canRecord = !loading && !!selectedPlayerId && game.isLive;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Score Display */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{game.currentQuarter === 1 ? "1st Half" : "2nd Half"}</span>
          {game.isLive ? (
            <span className="flex items-center gap-1 text-xs font-bold text-red-600">
              <span className="live-dot w-1.5 h-1.5 rounded-full bg-red-600" />
              LIVE
            </span>
          ) : (
            <span className="text-xs text-muted-foreground capitalize">{game.status.toLowerCase()}</span>
          )}
        </div>
        <div className="flex items-center justify-between text-center">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground truncate">{game.homeTeam.name}</p>
            <p className="text-5xl font-black tabular-nums">{game.homeScore}</p>
          </div>
          <span className="text-2xl text-muted-foreground mx-2">–</span>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground truncate">{game.awayTeam.name}</p>
            <p className="text-5xl font-black tabular-nums">{game.awayScore}</p>
          </div>
        </div>
      </div>

      {/* Game Controls */}
      {!game.isLive ? (
        <button
          onClick={handleStartGame}
          disabled={isStarting || game.status === "COMPLETED"}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl disabled:opacity-50"
        >
          {game.status === "COMPLETED" ? "Game Completed" : isStarting ? "Starting…" : "▶ Start Game"}
        </button>
      ) : (
        <div className="flex gap-2">
          {game.currentQuarter === 1 && (
            <button
              onClick={handleStartSecondHalf}
              className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-muted flex items-center justify-center gap-1"
            >
              <ChevronRight className="w-4 h-4" />
              Start 2nd Half
            </button>
          )}
          <button
            onClick={handleEndGame}
            disabled={isEnding}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <CheckCircle className="w-4 h-4" />
            {isEnding ? "Ending…" : "End Game"}
          </button>
        </div>
      )}

      {/* Team Selector */}
      <div className="flex rounded-lg border overflow-hidden">
        {[game.homeTeam, game.awayTeam].map((team) => (
          <button
            key={team.id}
            onClick={() => { setSelectedTeamId(team.id); setSelectedPlayerId(null); }}
            className={cn(
              "flex-1 py-3 text-sm font-semibold transition-colors",
              selectedTeamId === team.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {team.name}
          </button>
        ))}
      </div>

      {/* Player List */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">
          Select Player
        </p>
        <div className="grid grid-cols-2 gap-1 p-2">
          {selectedTeam.players.map((player) => {
            const stats = playerStats[player.id];
            const isSelected = selectedPlayerId === player.id;
            return (
              <button
                key={player.id}
                onClick={() => setSelectedPlayerId(player.id === selectedPlayerId ? null : player.id)}
                className={cn(
                  "px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 hover:bg-muted text-foreground"
                )}
              >
                <div>
                  {player.jerseyNumber !== null && (
                    <span className="text-xs opacity-60 mr-1">#{player.jerseyNumber}</span>
                  )}
                  {player.displayName}
                </div>
                <div className={cn("text-xs mt-0.5 font-normal tabular-nums", isSelected ? "opacity-75" : "opacity-50")}>
                  {stats
                    ? `${stats.points}P · ${stats.rebounds}R · ${stats.assists}A`
                    : "0P · 0R · 0A"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Points Buttons */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Points</p>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((pts) => (
            <button
              key={pts}
              onClick={() => handleStatEvent("POINT", pts)}
              disabled={!canRecord}
              className="py-5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              +{pts} PTS
            </button>
          ))}
        </div>
      </div>

      {/* Rebound & Assist Buttons */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Other Stats</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleStatEvent("REBOUND", 1)}
            disabled={!canRecord}
            className="py-5 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold text-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            +1 REB
          </button>
          <button
            onClick={() => handleStatEvent("ASSIST", 1)}
            disabled={!canRecord}
            className="py-5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            +1 AST
          </button>
        </div>
      </div>

      {/* Deduct Buttons */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Deduct</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { type: "POINT" as EventType, label: "−1 PTS", cls: "border-blue-400 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40" },
              { type: "REBOUND" as EventType, label: "−1 REB", cls: "border-green-400 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40" },
              { type: "ASSIST" as EventType, label: "−1 AST", cls: "border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40" },
            ] as const
          ).map(({ type, label, cls }) => (
            <button
              key={type}
              onClick={() => handleStatEvent(type, -1)}
              disabled={!canRecord}
              className={cn(
                "py-3 rounded-xl border font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed",
                cls
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Undo */}
      {lastEvent && (
        <button
          onClick={handleUndo}
          disabled={loading}
          className="w-full py-3 border rounded-xl text-sm font-medium hover:bg-muted flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Undo: {lastEvent.value > 0 ? "+" : "−"}{Math.abs(lastEvent.value)} {lastEvent.eventType} — {lastEvent.playerName}
        </button>
      )}
    </div>
  );
}
