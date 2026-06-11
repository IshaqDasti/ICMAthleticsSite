"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { RotateCcw, ChevronRight, CheckCircle, UserPlus, X, Trash2 } from "lucide-react";
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
  homeTeamFouls: number;
  awayTeamFouls: number;
  homeTeamTimeouts: number;
  awayTeamTimeouts: number;
  scorekeeperName: string | null;
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
  fouls: number;
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

type EventType = "POINT" | "REBOUND" | "ASSIST" | "FOUL";

export function ScorekeeperBoard({ initialGame }: Props) {
  const [game, setGame] = useState(initialGame);
  const [scorekeeperName, setScorekeeperName] = useState(initialGame.scorekeeperName ?? "");
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialGame.homeTeam.id);
  const [selectedEntry, setSelectedEntry] = useState<SelectedEntry>(null);
  const [lastEvent, setLastEvent] = useState<GameEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStat>>({});
  const [subStats, setSubStats] = useState<Record<string, PlayerStat>>({});
  const [substitutes, setSubstitutes] = useState<Record<string, SubstituteEntry[]>>({});
  const [showAddSubTeamId, setShowAddSubTeamId] = useState<string | null>(null);
  const [subName, setSubName] = useState("");
  const [subJersey, setSubJersey] = useState("");
  const [addingSub, setAddingSub] = useState(false);

  const selectedTeam = game.homeTeam.id === selectedTeamId ? game.homeTeam : game.awayTeam;

  const selectedPlayerName = (() => {
    if (!selectedEntry) return null;
    if (selectedEntry.type === "player") {
      return (
        game.homeTeam.players.find((p) => p.id === selectedEntry.id)?.displayName ??
        game.awayTeam.players.find((p) => p.id === selectedEntry.id)?.displayName ??
        "Player"
      );
    }
    const allSubs = [
      ...(substitutes[game.homeTeam.id] ?? []),
      ...(substitutes[game.awayTeam.id] ?? []),
    ];
    return allSubs.find((s) => s.statsId === selectedEntry.statsId)?.displayName ?? "Sub";
  })();

  const fetchStats = useCallback(async () => {
    const res = await fetch(`/api/games/${game.id}/stats`);
    if (!res.ok) return;
    const data = await res.json();
    const pMap: Record<string, PlayerStat> = {};
    const sMap: Record<string, PlayerStat> = {};
    const subMap: Record<string, SubstituteEntry[]> = {};

    for (const s of data.stats) {
      if (s.playerId) {
        pMap[s.playerId] = { points: s.points, rebounds: s.rebounds, assists: s.assists, fouls: s.fouls ?? 0 };
      } else if (s.substituteName) {
        sMap[s.id] = { points: s.points, rebounds: s.rebounds, assists: s.assists, fouls: s.fouls ?? 0 };
        if (!subMap[s.teamId]) subMap[s.teamId] = [];
        subMap[s.teamId].push({
          statsId: s.id,
          displayName: s.substituteName,
          jerseyNumber: s.substituteJersey ?? null,
        });
      }
    }

    if (data.teamFouls) {
      setGame((prev) => ({
        ...prev,
        homeTeamFouls: data.teamFouls[prev.homeTeam.id] ?? prev.homeTeamFouls,
        awayTeamFouls: data.teamFouls[prev.awayTeam.id] ?? prev.awayTeamFouls,
      }));
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
            homeTeamFouls: payload.new.home_team_fouls ?? prev.homeTeamFouls,
            awayTeamFouls: payload.new.away_team_fouls ?? prev.awayTeamFouls,
            homeTeamTimeouts: payload.new.home_team_timeouts ?? prev.homeTeamTimeouts,
            awayTeamTimeouts: payload.new.away_team_timeouts ?? prev.awayTeamTimeouts,
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
    if (!res.ok) {
      toast.error("Failed to start game");
    } else {
      setGame((prev) => ({ ...prev, isLive: true, status: "IN_PROGRESS" }));
    }
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
    if (!res.ok) {
      toast.error("Failed to end game");
    } else {
      setGame((prev) => ({ ...prev, isLive: false, status: "COMPLETED" }));
    }
    setIsEnding(false);
  }

  async function handleStartSecondHalf() {
    const res = await fetch(`/api/games/${game.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentQuarter: 2 }),
    });
    if (!res.ok) {
      toast.error("Failed to start 2nd half");
    } else {
      setGame((prev) => ({ ...prev, currentQuarter: 2, homeTeamFouls: 0, awayTeamFouls: 0, homeTeamTimeouts: 0, awayTeamTimeouts: 0 }));
    }
  }

  async function handleTimeout(teamId: string, delta: number) {
    if (!game.isLive) {
      toast.warning("Start the game first");
      return;
    }
    const isHome = teamId === game.homeTeam.id;
    const field = isHome ? "homeTeamTimeouts" : "awayTeamTimeouts";
    const current = isHome ? game.homeTeamTimeouts : game.awayTeamTimeouts;
    const next = Math.max(0, current + delta);

    setGame((prev) => ({ ...prev, [field]: next }));

    const res = await fetch(`/api/games/${game.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: next }),
    });
    if (!res.ok) {
      setGame((prev) => ({ ...prev, [field]: current }));
      toast.error("Failed to update timeout");
    }
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

    const isHome = selectedTeamId === game.homeTeam.id;

    if (type === "POINT") {
      setGame((prev) => ({
        ...prev,
        homeScore: isHome ? prev.homeScore + value : prev.homeScore,
        awayScore: !isHome ? prev.awayScore + value : prev.awayScore,
      }));
    }

    if (type === "FOUL") {
      setGame((prev) => ({
        ...prev,
        homeTeamFouls: isHome ? prev.homeTeamFouls + value : prev.homeTeamFouls,
        awayTeamFouls: !isHome ? prev.awayTeamFouls + value : prev.awayTeamFouls,
      }));
    }

    if (selectedEntry.type === "player") {
      setPlayerStats((prev) => {
        const cur = prev[selectedEntry.id] ?? { points: 0, rebounds: 0, assists: 0, fouls: 0 };
        return {
          ...prev,
          [selectedEntry.id]: {
            points: type === "POINT" ? cur.points + value : cur.points,
            rebounds: type === "REBOUND" ? cur.rebounds + value : cur.rebounds,
            assists: type === "ASSIST" ? cur.assists + value : cur.assists,
            fouls: type === "FOUL" ? cur.fouls + value : cur.fouls,
          },
        };
      });
    } else {
      setSubStats((prev) => {
        const cur = prev[selectedEntry.statsId] ?? { points: 0, rebounds: 0, assists: 0, fouls: 0 };
        return {
          ...prev,
          [selectedEntry.statsId]: {
            points: type === "POINT" ? cur.points + value : cur.points,
            rebounds: type === "REBOUND" ? cur.rebounds + value : cur.rebounds,
            assists: type === "ASSIST" ? cur.assists + value : cur.assists,
            fouls: type === "FOUL" ? cur.fouls + value : cur.fouls,
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
      if (type === "FOUL") {
        setGame((prev) => ({
          ...prev,
          homeTeamFouls: isHome ? prev.homeTeamFouls - value : prev.homeTeamFouls,
          awayTeamFouls: !isHome ? prev.awayTeamFouls - value : prev.awayTeamFouls,
        }));
      }
      if (selectedEntry.type === "player") {
        setPlayerStats((prev) => {
          const cur = prev[selectedEntry.id] ?? { points: 0, rebounds: 0, assists: 0, fouls: 0 };
          return {
            ...prev,
            [selectedEntry.id]: {
              points: type === "POINT" ? cur.points - value : cur.points,
              rebounds: type === "REBOUND" ? cur.rebounds - value : cur.rebounds,
              assists: type === "ASSIST" ? cur.assists - value : cur.assists,
              fouls: type === "FOUL" ? cur.fouls - value : cur.fouls,
            },
          };
        });
      } else {
        setSubStats((prev) => {
          const cur = prev[selectedEntry.statsId] ?? { points: 0, rebounds: 0, assists: 0, fouls: 0 };
          return {
            ...prev,
            [selectedEntry.statsId]: {
              points: type === "POINT" ? cur.points - value : cur.points,
              rebounds: type === "REBOUND" ? cur.rebounds - value : cur.rebounds,
              assists: type === "ASSIST" ? cur.assists - value : cur.assists,
              fouls: type === "FOUL" ? cur.fouls - value : cur.fouls,
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
      const isHome = lastEvent.teamId === game.homeTeam.id;
      if (lastEvent.eventType === "POINT") {
        setGame((prev) => ({
          ...prev,
          homeScore: isHome ? prev.homeScore - lastEvent.value : prev.homeScore,
          awayScore: !isHome ? prev.awayScore - lastEvent.value : prev.awayScore,
        }));
      }
      if (lastEvent.eventType === "FOUL") {
        setGame((prev) => ({
          ...prev,
          homeTeamFouls: isHome ? prev.homeTeamFouls - lastEvent.value : prev.homeTeamFouls,
          awayTeamFouls: !isHome ? prev.awayTeamFouls - lastEvent.value : prev.awayTeamFouls,
        }));
      }
      setLastEvent(null);
      fetchStats();
    }
    setLoading(false);
  }

  async function handleAddSub() {
    if (!subName.trim() || !showAddSubTeamId) return;
    setAddingSub(true);

    const res = await fetch(`/api/games/${game.id}/substitute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: subName.trim(),
        jersey: subJersey.trim() || undefined,
        teamId: showAddSubTeamId,
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
        [showAddSubTeamId]: [...(prev[showAddSubTeamId] ?? []), newSub],
      }));
      setSubStats((prev) => ({
        ...prev,
        [newSub.statsId]: { points: 0, rebounds: 0, assists: 0, fouls: 0 },
      }));
      setShowAddSubTeamId(null);
      setSubName("");
      setSubJersey("");
      toast.success(`${newSub.displayName} added as substitute`);
    }
    setAddingSub(false);
  }

  function handleCancelAddSub() {
    setShowAddSubTeamId(null);
    setSubName("");
    setSubJersey("");
  }

  async function handleScorekeeperBlur() {
    await fetch(`/api/games/${game.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scorekeeperName: scorekeeperName.trim() || null }),
    });
  }

  async function handleDeleteSub(statsId: string, teamId: string) {
    if (!confirm("Remove this substitute? Their recorded stats will be reversed.")) return;

    const subData = subStats[statsId] ?? { points: 0, rebounds: 0, assists: 0, fouls: 0 };
    const isHome = teamId === game.homeTeam.id;

    const res = await fetch(`/api/games/${game.id}/substitute`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statsId }),
    });

    if (!res.ok) {
      toast.error("Failed to remove substitute");
      return;
    }

    if (selectedEntry?.type === "sub" && selectedEntry.statsId === statsId) {
      setSelectedEntry(null);
    }

    setGame((prev) => ({
      ...prev,
      homeScore: isHome ? prev.homeScore - subData.points : prev.homeScore,
      awayScore: !isHome ? prev.awayScore - subData.points : prev.awayScore,
      homeTeamFouls: isHome ? prev.homeTeamFouls - subData.fouls : prev.homeTeamFouls,
      awayTeamFouls: !isHome ? prev.awayTeamFouls - subData.fouls : prev.awayTeamFouls,
    }));

    setSubstitutes((prev) => ({
      ...prev,
      [teamId]: (prev[teamId] ?? []).filter((s) => s.statsId !== statsId),
    }));
    setSubStats((prev) => {
      const next = { ...prev };
      delete next[statsId];
      return next;
    });

    toast.success("Substitute removed");
  }

  const canRecord = !!selectedEntry && game.isLive;

  function renderTeamPanel(team: Team, fouls: number) {
    const subs = substitutes[team.id] ?? [];
    const isAddingSubHere = showAddSubTeamId === team.id;

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-bold truncate">{team.name}</span>
          <span className={cn("text-xs font-semibold tabular-nums", fouls >= 7 ? "text-red-500" : "text-muted-foreground")}>
            {fouls} fouls
          </span>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-1.5 overflow-y-auto max-h-[55vh]">
            {team.players.map((player) => {
              const stats = playerStats[player.id];
              const isSelected = selectedEntry?.type === "player" && selectedEntry.id === player.id;
              return (
                <button
                  key={player.id}
                  onClick={() => {
                    setSelectedTeamId(team.id);
                    setSelectedEntry(isSelected ? null : { type: "player", id: player.id });
                  }}
                  className={cn(
                    "px-2 py-2 rounded-lg text-xs font-medium transition-colors text-left",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 hover:bg-muted text-foreground"
                  )}
                >
                  <div>
                    {player.jerseyNumber !== null && (
                      <span className="opacity-60 mr-1">#{player.jerseyNumber}</span>
                    )}
                    {player.displayName}
                  </div>
                  <div className={cn("text-xs mt-0.5 font-normal tabular-nums", isSelected ? "opacity-75" : "opacity-50")}>
                    {stats
                      ? `${stats.points}P · ${stats.rebounds}R · ${stats.assists}A · ${stats.fouls}F`
                      : "0P · 0R · 0A · 0F"}
                  </div>
                </button>
              );
            })}

            {subs.map((sub) => {
              const stats = subStats[sub.statsId];
              const isSelected = selectedEntry?.type === "sub" && selectedEntry.statsId === sub.statsId;
              return (
                <div key={sub.statsId} className="flex items-stretch gap-1">
                  <button
                    onClick={() => {
                      setSelectedTeamId(team.id);
                      setSelectedEntry(isSelected ? null : { type: "sub", statsId: sub.statsId });
                    }}
                    className={cn(
                      "flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors text-left",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 hover:bg-muted text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {sub.jerseyNumber !== null && (
                        <span className="opacity-60">#{sub.jerseyNumber}</span>
                      )}
                      <span>{sub.displayName}</span>
                      <span className={cn("text-xs", isSelected ? "opacity-60" : "text-muted-foreground")}>(sub)</span>
                    </div>
                    <div className={cn("text-xs mt-0.5 font-normal tabular-nums", isSelected ? "opacity-75" : "opacity-50")}>
                      {stats
                        ? `${stats.points}P · ${stats.rebounds}R · ${stats.assists}A · ${stats.fouls}F`
                        : "0P · 0R · 0A · 0F"}
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteSub(sub.statsId, team.id)}
                    className="px-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    title="Remove substitute"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="px-1.5 pb-1.5 border-t pt-1.5">
            {isAddingSubHere ? (
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  placeholder="Name *"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddSub()}
                  className="w-full px-2 py-1.5 text-xs rounded border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="#"
                    value={subJersey}
                    onChange={(e) => setSubJersey(e.target.value)}
                    className="w-12 px-2 py-1.5 text-xs rounded border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={handleAddSub}
                    disabled={!subName.trim() || addingSub}
                    className="flex-1 px-2 py-1.5 bg-primary text-primary-foreground text-xs rounded font-medium disabled:opacity-50"
                  >
                    {addingSub ? "…" : "Add"}
                  </button>
                  <button
                    onClick={handleCancelAddSub}
                    className="p-1.5 border rounded hover:bg-muted text-muted-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddSubTeamId(team.id)}
                className="w-full py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors flex items-center justify-center gap-1"
              >
                <UserPlus className="w-3 h-3" />
                Add Sub
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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

      {/* Scorekeeper */}
      <div className="rounded-xl border bg-card p-3">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
          Scorekeeper
        </label>
        <input
          type="text"
          value={scorekeeperName}
          onChange={(e) => setScorekeeperName(e.target.value)}
          onBlur={handleScorekeeperBlur}
          placeholder="Enter scorekeeper name…"
          className="w-full px-3 py-1.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
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

      {/* Timeouts */}
      <div className="rounded-xl border bg-card p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Timeouts (this half)</p>
        <div className="grid grid-cols-2 gap-3">
          {[game.homeTeam, game.awayTeam].map((team) => {
            const isHome = team.id === game.homeTeam.id;
            const count = isHome ? game.homeTeamTimeouts : game.awayTeamTimeouts;
            return (
              <div key={team.id} className="flex flex-col items-center gap-1.5">
                <p className="text-xs font-medium text-muted-foreground truncate w-full text-center">{team.name}</p>
                <span className="text-3xl font-black tabular-nums">{count}</span>
                <div className="flex gap-1.5 w-full">
                  <button
                    onClick={() => handleTimeout(team.id, -1)}
                    disabled={!game.isLive || count === 0}
                    className="flex-1 py-1.5 rounded-lg border text-sm font-bold text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    −1
                  </button>
                  <button
                    onClick={() => handleTimeout(team.id, 1)}
                    disabled={!game.isLive}
                    className="flex-1 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Timeout
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3-Column Main Area */}
      <div className="grid grid-cols-[1fr_172px_1fr] gap-2 items-start">
        {/* Home Team */}
        {renderTeamPanel(game.homeTeam, game.homeTeamFouls)}

        {/* Center: Stat Buttons */}
        <div className="flex flex-col gap-2">
          {/* Selected player indicator */}
          <div className="rounded-lg border bg-card px-2 py-2 text-center min-h-[48px] flex flex-col items-center justify-center">
            {selectedEntry ? (
              <>
                <p className="text-xs font-semibold leading-tight truncate w-full text-center">{selectedPlayerName}</p>
                <p className="text-xs text-muted-foreground truncate w-full text-center">
                  {selectedTeamId === game.homeTeam.id ? game.homeTeam.name : game.awayTeam.name}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">← Tap a player →</p>
            )}
          </div>

          {/* Points */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 text-center">Points</p>
            <div className="flex flex-col gap-1">
              {[1, 2, 3].map((pts) => (
                <button
                  key={pts}
                  onClick={() => handleStatEvent("POINT", pts)}
                  disabled={!canRecord}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  +{pts} PTS
                </button>
              ))}
            </div>
          </div>

          {/* Other Stats */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 text-center">Stats</p>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => handleStatEvent("REBOUND", 1)}
                disabled={!canRecord}
                className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                +1 REB
              </button>
              <button
                onClick={() => handleStatEvent("ASSIST", 1)}
                disabled={!canRecord}
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                +1 AST
              </button>
              <button
                onClick={() => handleStatEvent("FOUL", 1)}
                disabled={!canRecord}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                +1 FOUL
              </button>
            </div>
          </div>

          {/* Deduct */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 text-center">Deduct</p>
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  { type: "POINT" as EventType, label: "−PTS", cls: "border-blue-400 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40" },
                  { type: "REBOUND" as EventType, label: "−REB", cls: "border-green-400 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40" },
                  { type: "ASSIST" as EventType, label: "−AST", cls: "border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40" },
                  { type: "FOUL" as EventType, label: "−FUL", cls: "border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40" },
                ] as const
              ).map(({ type, label, cls }) => (
                <button
                  key={type}
                  onClick={() => handleStatEvent(type, -1)}
                  disabled={!canRecord}
                  className={cn(
                    "py-2.5 rounded-lg border font-bold text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed",
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
              className="w-full py-2.5 border rounded-xl text-xs font-medium hover:bg-muted flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="truncate">
                Undo {lastEvent.value > 0 ? "+" : "−"}{Math.abs(lastEvent.value)} {lastEvent.eventType}
              </span>
            </button>
          )}
        </div>

        {/* Away Team */}
        {renderTeamPanel(game.awayTeam, game.awayTeamFouls)}
      </div>
    </div>
  );
}
