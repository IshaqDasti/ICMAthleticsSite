"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { RotateCcw, ChevronRight, CheckCircle, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
  players: Array<{
    id: string;
    displayName: string;
    jerseyNumber: string | null;
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

interface SubstituteEntry {
  statsId: string;
  displayName: string;
  jerseyNumber: string | null;
}

type SelectedEntry =
  | { type: "player"; id: string }
  | { type: "sub"; statsId: string }
  | null;

interface Props {
  initialGame: GameState;
}

type EventType = "POINT" | "REBOUND" | "ASSIST";

export function ScorekeeperBoard({ initialGame }: Props) {
  const [game, setGame] = useState(initialGame);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialGame.homeTeam.id);
  const [selectedEntry, setSelectedEntry] = useState<SelectedEntry>(null);
  const [lastEvent, setLastEvent] = useState<GameEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStat>>({});
  const [subStats, setSubStats] = useState<Record<string, PlayerStat>>({});
  const [substitutes, setSubstitutes] = useState<Record<string, SubstituteEntry[]>>({});
  const [showAddSub, setShowAddSub] = useState(false);
  const [subName, setSubName] = useState("");
  const [subJersey, setSubJersey] = useState("");
  const [addingSub, setAddingSub] = useState(false);

  const selectedTeam = game.homeTeam.id === selectedTeamId ? game.homeTeam : game.awayTeam;

  const fetchStats = useCallback(async () => {
    const res = await fetch(`/api/games/${game.id}/stats`);
    if (!res.ok) return;
    const data = await res.json();
    const pMap: Record<string, PlayerStat> = {};
    const sMap: Record<string, PlayerStat> = {};
    const subMap: Record<string, SubstituteEntry[]> = {};

    for (const s of data.stats) {
      if (s.playerId) {
        pMap[s.playerId] = { points: s.points, rebounds: s.rebounds, assists: s.assists };
      } else if (s.substituteName) {
        sMap[s.id] = { points: s.points, rebounds: s.rebounds, assists: s.assists };
        if (!subMap[s.teamId]) subMap[s.teamId] = [];
        subMap[s.teamId].push({
          statsId: s.id,
          displayName: s.substituteName,
          jerseyNumber: s.substituteJersey ?? null,
        });
      }
    }
    setPlayerStats(pMap);
    setSubStats(sMap);
    setSubstitutes(subMap);
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
    if (!selectedEntry) {
      toast.warning("Select a player first");
      return;
    }
    if (!game.isLive) {
      toast.warning("Start the game first");
      return;
    }

    setLoading(true);
    const isHome = selectedTeamId === game.homeTeam.id;

    if (type === "POINT") {
      setGame((prev) => ({
        ...prev,
        homeScore: isHome ? prev.homeScore + value : prev.homeScore,
        awayScore: !isHome ? prev.awayScore + value : prev.awayScore,
      }));
    }

    if (selectedEntry.type === "player") {
      setPlayerStats((prev) => {
        const cur = prev[selectedEntry.id] ?? { points: 0, rebounds: 0, assists: 0 };
        return {
          ...prev,
          [selectedEntry.id]: {
            points: type === "POINT" ? cur.points + value : cur.points,
            rebounds: type === "REBOUND" ? cur.rebounds + value : cur.rebounds,
            assists: type === "ASSIST" ? cur.assists + value : cur.assists,
          },
        };
      });
    } else {
      setSubStats((prev) => {
        const cur = prev[selectedEntry.statsId] ?? { points: 0, rebounds: 0, assists: 0 };
        return {
          ...prev,
          [selectedEntry.statsId]: {
            points: type === "POINT" ? cur.points + value : cur.points,
            rebounds: type === "REBOUND" ? cur.rebounds + value : cur.rebounds,
            assists: type === "ASSIST" ? cur.assists + value : cur.assists,
          },
        };
      });
    }

    const body =
      selectedEntry.type === "player"
        ? { type, playerId: selectedEntry.id, teamId: selectedTeamId, isHome, quarter: game.currentQuarter, value }
        : { type, substituteStatsId: selectedEntry.statsId, teamId: selectedTeamId, isHome, quarter: game.currentQuarter, value };

    const res = await fetch(`/api/games/${game.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (type === "POINT") {
        setGame((prev) => ({
          ...prev,
          homeScore: isHome ? prev.homeScore - value : prev.homeScore,
          awayScore: !isHome ? prev.awayScore - value : prev.awayScore,
        }));
      }
      if (selectedEntry.type === "player") {
        setPlayerStats((prev) => {
          const cur = prev[selectedEntry.id] ?? { points: 0, rebounds: 0, assists: 0 };
          return {
            ...prev,
            [selectedEntry.id]: {
              points: type === "POINT" ? cur.points - value : cur.points,
              rebounds: type === "REBOUND" ? cur.rebounds - value : cur.rebounds,
              assists: type === "ASSIST" ? cur.assists - value : cur.assists,
            },
          };
        });
      } else {
        setSubStats((prev) => {
          const cur = prev[selectedEntry.statsId] ?? { points: 0, rebounds: 0, assists: 0 };
          return {
            ...prev,
            [selectedEntry.statsId]: {
              points: type === "POINT" ? cur.points - value : cur.points,
              rebounds: type === "REBOUND" ? cur.rebounds - value : cur.rebounds,
              assists: type === "ASSIST" ? cur.assists - value : cur.assists,
            },
          };
        });
      }
      toast.error("Failed to record stat");
    } else {
      const data = await res.json();
      const playerName =
        selectedEntry.type === "player"
          ? (selectedTeam.players.find((p) => p.id === selectedEntry.id)?.displayName ?? "Player")
          : ((substitutes[selectedTeamId] ?? []).find((s) => s.statsId === selectedEntry.statsId)?.displayName ?? "Sub");
      setLastEvent({
        id: data.event.id,
        eventType: type,
        playerId: selectedEntry.type === "player" ? selectedEntry.id : null,
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

  async function handleAddSub() {
    if (!subName.trim()) return;
    setAddingSub(true);

    const res = await fetch(`/api/games/${game.id}/substitute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: subName.trim(),
        jersey: subJersey.trim() || undefined,
        teamId: selectedTeamId,
      }),
    });

    if (!res.ok) {
      toast.error("Failed to add substitute");
    } else {
      const data = await res.json();
      const newSub: SubstituteEntry = {
        statsId: data.substitute.id,
        displayName: data.substitute.substituteName,
        jerseyNumber: data.substitute.substituteJersey ?? null,
      };
      setSubstitutes((prev) => ({
        ...prev,
        [selectedTeamId]: [...(prev[selectedTeamId] ?? []), newSub],
      }));
      setSubStats((prev) => ({
        ...prev,
        [newSub.statsId]: { points: 0, rebounds: 0, assists: 0 },
      }));
      setShowAddSub(false);
      setSubName("");
      setSubJersey("");
      toast.success(`${newSub.displayName} added as substitute`);
    }
    setAddingSub(false);
  }

  function handleCancelAddSub() {
    setShowAddSub(false);
    setSubName("");
    setSubJersey("");
  }

  const canRecord = !loading && !!selectedEntry && game.isLive;
  const teamSubs = substitutes[selectedTeamId] ?? [];

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
            onClick={() => { setSelectedTeamId(team.id); setSelectedEntry(null); setShowAddSub(false); setSubName(""); setSubJersey(""); }}
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
            const isSelected = selectedEntry?.type === "player" && selectedEntry.id === player.id;
            return (
              <button
                key={player.id}
                onClick={() => setSelectedEntry(isSelected ? null : { type: "player", id: player.id })}
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
                  {stats ? `${stats.points}P · ${stats.rebounds}R · ${stats.assists}A` : "0P · 0R · 0A"}
                </div>
              </button>
            );
          })}

          {teamSubs.map((sub) => {
            const stats = subStats[sub.statsId];
            const isSelected = selectedEntry?.type === "sub" && selectedEntry.statsId === sub.statsId;
            return (
              <button
                key={sub.statsId}
                onClick={() => setSelectedEntry(isSelected ? null : { type: "sub", statsId: sub.statsId })}
                className={cn(
                  "px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 hover:bg-muted text-foreground"
                )}
              >
                <div className="flex items-center gap-1">
                  {sub.jerseyNumber !== null && (
                    <span className="text-xs opacity-60">#{sub.jerseyNumber}</span>
                  )}
                  <span>{sub.displayName}</span>
                  <span className={cn("text-xs", isSelected ? "opacity-60" : "text-muted-foreground")}>(sub)</span>
                </div>
                <div className={cn("text-xs mt-0.5 font-normal tabular-nums", isSelected ? "opacity-75" : "opacity-50")}>
                  {stats ? `${stats.points}P · ${stats.rebounds}R · ${stats.assists}A` : "0P · 0R · 0A"}
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-2 pb-2 border-t pt-2">
          {showAddSub ? (
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Name *"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSub()}
                className="flex-1 px-2 py-1.5 text-sm rounded border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <input
                type="text"
                placeholder="#"
                value={subJersey}
                onChange={(e) => setSubJersey(e.target.value)}
                className="w-14 px-2 py-1.5 text-sm rounded border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={handleAddSub}
                disabled={!subName.trim() || addingSub}
                className="px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded font-medium disabled:opacity-50 whitespace-nowrap"
              >
                {addingSub ? "…" : "Add"}
              </button>
              <button
                onClick={handleCancelAddSub}
                className="p-1.5 border rounded hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddSub(true)}
              className="w-full py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors flex items-center justify-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Substitute
            </button>
          )}
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
