"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { RotateCcw, ChevronRight, CheckCircle, UserPlus, X, Trash2, Pencil } from "lucide-react";
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

interface ActivityLogEntry {
  id: string;
  eventType: EventType;
  playerName: string;
  jerseyNumber: string | null;
  teamName: string;
  quarter: number;
  value: number;
}

interface RawEvent {
  id: string;
  eventType: string;
  playerId: string | null;
  substituteStatsId: string | null;
  teamId: string | null;
  quarter: number;
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
  const [editingSubStatsId, setEditingSubStatsId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editJersey, setEditJersey] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

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
    const [statsRes, eventsRes] = await Promise.all([
      fetch(`/api/games/${game.id}/stats`),
      fetch(`/api/games/${game.id}/events`),
    ]);
    if (!statsRes.ok) return;
    const data = await statsRes.json();
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

    if (eventsRes.ok) {
      const eventsData = await eventsRes.json();
      const allPlayers = [...initialGame.homeTeam.players, ...initialGame.awayTeam.players];
      const allSubs = Object.values(subMap).flat();
      const log: ActivityLogEntry[] = eventsData.events.map((e: RawEvent) => {
        let playerName = "Unknown";
        let jerseyNumber: string | null = null;
        if (e.playerId) {
          const player = allPlayers.find((p) => p.id === e.playerId);
          playerName = player?.displayName ?? "Player";
          jerseyNumber = player?.jerseyNumber ?? null;
        } else if (e.substituteStatsId) {
          const sub = allSubs.find((s) => s.statsId === e.substituteStatsId);
          playerName = sub?.displayName ?? "Sub";
          jerseyNumber = sub?.jerseyNumber ?? null;
        }
        const isHome = e.teamId === initialGame.homeTeam.id;
        const teamName = isHome ? initialGame.homeTeam.name : initialGame.awayTeam.name;
        return { id: e.id, eventType: e.eventType as EventType, playerName, jerseyNumber, teamName, quarter: e.quarter, value: e.value };
      });
      setActivityLog(log);
    }
  }, [game.id, initialGame]);

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
    if (!scorekeeperName.trim()) {
      toast.error("Please enter a scorekeeper name before ending the game.");
      return;
    }
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

  async function handleTeamFoul(teamId: string, delta: number) {
    if (!game.isLive) {
      toast.warning("Start the game first");
      return;
    }
    const isHome = teamId === game.homeTeam.id;
    const field = isHome ? "homeTeamFouls" : "awayTeamFouls";
    const current = isHome ? game.homeTeamFouls : game.awayTeamFouls;
    const next = Math.max(0, current + delta);

    setGame((prev) => ({ ...prev, [field]: next }));

    const res = await fetch(`/api/games/${game.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: next }),
    });
    if (!res.ok) {
      setGame((prev) => ({ ...prev, [field]: current }));
      toast.error("Failed to update team foul");
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
      const selectedPlayer =
        selectedEntry.type === "player"
          ? selectedTeam.players.find((p) => p.id === selectedEntry.id)
          : (substitutes[selectedTeamId] ?? []).find((s) => s.statsId === selectedEntry.statsId);
      const playerName = selectedPlayer?.displayName ?? (selectedEntry.type === "player" ? "Player" : "Sub");
      const jerseyNumber = selectedPlayer?.jerseyNumber ?? null;
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
      setActivityLog((prev) => [
        { id: data.event.id, eventType: type, playerName, jerseyNumber, teamName: selectedTeam.name, quarter: game.currentQuarter, value },
        ...prev,
      ]);
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

  function handleStartEditSub(sub: SubstituteEntry) {
    setEditingSubStatsId(sub.statsId);
    setEditName(sub.displayName);
    setEditJersey(sub.jerseyNumber ?? "");
  }

  function handleCancelEditSub() {
    setEditingSubStatsId(null);
    setEditName("");
    setEditJersey("");
  }

  async function handleSaveEditSub(teamId: string) {
    if (!editingSubStatsId || !editName.trim()) return;
    setSavingEdit(true);

    const res = await fetch(`/api/games/${game.id}/substitute`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statsId: editingSubStatsId, name: editName.trim(), jersey: editJersey.trim() || undefined }),
    });

    if (!res.ok) {
      toast.error("Failed to update substitute");
    } else {
      const data = await res.json();
      setSubstitutes((prev) => ({
        ...prev,
        [teamId]: (prev[teamId] ?? []).map((s) =>
          s.statsId === editingSubStatsId
            ? { ...s, displayName: data.substitute.substituteName, jerseyNumber: data.substitute.substituteJersey ?? null }
            : s
        ),
      }));
      toast.success("Substitute updated");
      handleCancelEditSub();
    }
    setSavingEdit(false);
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

  function renderTeamPanel(team: Team, fouls: number, timeouts: number) {
    const subs = substitutes[team.id] ?? [];
    const isAddingSubHere = showAddSubTeamId === team.id;
    const inBonus = fouls >= 7;
    const inDoubleBonus = fouls >= 10;

    return (
      <div className="rounded-xl border bg-card p-2 flex flex-col gap-2 min-h-0 min-w-0">
        <div className="flex items-center justify-between px-1 shrink-0">
          <span className="text-sm font-bold truncate">{team.name}</span>
        </div>

        {/* Team fouls + timeouts */}
        <div className="grid grid-cols-2 gap-1.5 shrink-0">
          <div className="rounded-lg border bg-muted/40 px-2 py-1.5">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                Team Fouls
              </span>
              {inDoubleBonus ? (
                <span className="text-[8px] font-bold text-white bg-red-800 rounded px-1 py-px whitespace-nowrap">
                  BONUS · 2 SHOTS
                </span>
              ) : inBonus ? (
                <span className="text-[8px] font-bold text-white bg-red-500 rounded px-1 py-px whitespace-nowrap">
                  BONUS · 1&amp;1
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className={cn("text-lg font-black tabular-nums min-w-[1.25rem] leading-none", inBonus && "text-red-500")}>
                {fouls}
              </span>
              <button
                onClick={() => handleTeamFoul(team.id, -1)}
                disabled={!game.isLive || fouls === 0}
                className="w-6 h-6 rounded border text-xs font-bold text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                −
              </button>
              <button
                onClick={() => handleTeamFoul(team.id, 1)}
                disabled={!game.isLive}
                className="flex-1 h-6 rounded bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                + Foul
              </button>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 px-2 py-1.5">
            <div className="flex items-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                Timeouts Used
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-lg font-black tabular-nums min-w-[1.25rem] leading-none">{timeouts}</span>
              <button
                onClick={() => handleTimeout(team.id, -1)}
                disabled={!game.isLive || timeouts === 0}
                className="w-6 h-6 rounded border text-xs font-bold text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                −
              </button>
              <button
                onClick={() => handleTimeout(team.id, 1)}
                disabled={!game.isLive}
                className="flex-1 h-6 rounded bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                +TO
              </button>
            </div>
          </div>
        </div>

        {/* Roster — 2-column grid, scrolls internally if it overflows */}
        <div className="grid grid-cols-2 gap-1 content-start overflow-y-auto min-h-0 flex-1">
          {team.players.map((player) => {
            const stats = playerStats[player.id];
            const isSelected = selectedEntry?.type === "player" && selectedEntry.id === player.id;
            const playerFouls = stats?.fouls ?? 0;
            return (
              <button
                key={player.id}
                onClick={() => {
                  setSelectedTeamId(team.id);
                  setSelectedEntry(isSelected ? null : { type: "player", id: player.id });
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left transition-colors min-w-0",
                  isSelected
                    ? "bg-primary text-primary-foreground ring-2 ring-primary"
                    : playerFouls >= 5
                    ? "bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-foreground"
                    : playerFouls === 4
                    ? "bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 text-foreground"
                    : "bg-muted/50 hover:bg-muted text-foreground"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">
                    {player.jerseyNumber !== null && <span className="font-bold">#{player.jerseyNumber} </span>}
                    {player.displayName}
                  </div>
                  <div className={cn("text-[10px] font-normal tabular-nums", isSelected ? "opacity-75" : "opacity-50")}>
                    {stats ? `${stats.points}P · ${stats.rebounds}R · ${stats.assists}A` : "0P · 0R · 0A"}
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-[9px] font-bold rounded px-1 py-0.5 tabular-nums whitespace-nowrap",
                    isSelected
                      ? "bg-primary-foreground/20"
                      : playerFouls >= 5
                      ? "bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-300"
                      : playerFouls === 4
                      ? "bg-yellow-200 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {playerFouls} PF
                </span>
              </button>
            );
          })}

          {subs.map((sub) => {
            const stats = subStats[sub.statsId];
            const isSelected = selectedEntry?.type === "sub" && selectedEntry.statsId === sub.statsId;
            const isEditing = editingSubStatsId === sub.statsId;
            const subFouls = stats?.fouls ?? 0;
            return (
              <div key={sub.statsId} className={cn("flex flex-col gap-0.5 min-w-0", isEditing && "col-span-2")}>
                <div className="flex items-stretch gap-0.5 min-w-0">
                  <button
                    onClick={() => {
                      setSelectedTeamId(team.id);
                      setSelectedEntry(isSelected ? null : { type: "sub", statsId: sub.statsId });
                    }}
                    className={cn(
                      "flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left transition-colors min-w-0",
                      isSelected
                        ? "bg-primary text-primary-foreground ring-2 ring-primary"
                        : subFouls >= 5
                        ? "bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-foreground"
                        : subFouls === 4
                        ? "bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 text-foreground"
                        : "bg-muted/50 hover:bg-muted text-foreground"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {sub.jerseyNumber !== null && <span className="font-bold">#{sub.jerseyNumber} </span>}
                        {sub.displayName}
                        <span className={cn("ml-1", isSelected ? "opacity-60" : "text-muted-foreground")}>(sub)</span>
                      </div>
                      <div className={cn("text-[10px] font-normal tabular-nums", isSelected ? "opacity-75" : "opacity-50")}>
                        {stats ? `${stats.points}P · ${stats.rebounds}R · ${stats.assists}A` : "0P · 0R · 0A"}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-[9px] font-bold rounded px-1 py-0.5 tabular-nums whitespace-nowrap",
                        isSelected
                          ? "bg-primary-foreground/20"
                          : subFouls >= 5
                          ? "bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-300"
                          : subFouls === 4
                          ? "bg-yellow-200 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {subFouls} PF
                    </span>
                  </button>
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => (isEditing ? handleCancelEditSub() : handleStartEditSub(sub))}
                      className={cn(
                        "flex-1 px-1 rounded transition-colors flex items-center justify-center",
                        isEditing
                          ? "text-foreground bg-muted"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                      title="Edit substitute"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteSub(sub.statsId, team.id)}
                      className="flex-1 px-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center justify-center"
                      title="Remove substitute"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {isEditing && (
                  <div className="flex gap-1 px-0.5">
                    <input
                      type="text"
                      placeholder="Name *"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEditSub(team.id)}
                      className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      autoFocus
                    />
                    <input
                      type="text"
                      placeholder="#"
                      value={editJersey}
                      onChange={(e) => setEditJersey(e.target.value)}
                      className="w-12 px-2 py-1.5 text-xs rounded border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      onClick={() => handleSaveEditSub(team.id)}
                      disabled={!editName.trim() || savingEdit}
                      className="px-2 py-1.5 bg-primary text-primary-foreground text-xs rounded font-medium disabled:opacity-50"
                    >
                      {savingEdit ? "…" : "Save"}
                    </button>
                    <button
                      onClick={handleCancelEditSub}
                      className="p-1.5 border rounded hover:bg-muted text-muted-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {isAddingSubHere ? (
            <div className="col-span-2 flex gap-1 rounded-lg border bg-muted/40 p-1.5">
              <input
                type="text"
                placeholder="Name *"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSub()}
                className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
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
                className="px-2.5 py-1.5 bg-primary text-primary-foreground text-xs rounded font-medium disabled:opacity-50"
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
          ) : (
            <button
              onClick={() => setShowAddSubTeamId(team.id)}
              className="col-span-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border border-dashed transition-colors flex items-center justify-center gap-1"
            >
              <UserPlus className="w-3 h-3" />
              Add Sub
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 lg:flex-1 lg:min-h-0">
      {/* Top bar: scorekeeper, period, game controls */}
      <div className="rounded-xl border bg-card px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <label className="text-xs font-bold whitespace-nowrap">
            Scorekeeper <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={scorekeeperName}
            onChange={(e) => setScorekeeperName(e.target.value)}
            onBlur={handleScorekeeperBlur}
            placeholder="Enter name…"
            className={cn(
              "flex-1 min-w-[120px] px-2.5 py-1.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring",
              !scorekeeperName.trim() && "border-red-400"
            )}
          />
          {!scorekeeperName.trim() && (
            <span className="text-[10px] font-bold text-red-500 whitespace-nowrap">Required</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Period</span>
          <span className="text-sm font-black whitespace-nowrap">
            {game.currentQuarter === 1 ? "1st Half" : "2nd Half"}
          </span>
          {game.isLive && game.currentQuarter === 1 && (
            <button
              onClick={handleStartSecondHalf}
              className="px-2.5 py-1.5 border rounded-lg text-xs font-medium hover:bg-muted flex items-center gap-1 whitespace-nowrap"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              Start 2nd Half
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {game.isLive ? (
            <span className="flex items-center gap-1 text-xs font-bold text-red-600">
              <span className="live-dot w-1.5 h-1.5 rounded-full bg-red-600" />
              LIVE
            </span>
          ) : (
            <span className="text-xs text-muted-foreground capitalize">
              {game.status.toLowerCase().replace(/_/g, " ")}
            </span>
          )}
          {!game.isLive ? (
            <button
              onClick={handleStartGame}
              disabled={isStarting || game.status === "COMPLETED"}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 whitespace-nowrap"
            >
              {game.status === "COMPLETED" ? "Game Completed" : isStarting ? "Starting…" : "▶ Start Game"}
            </button>
          ) : (
            <button
              onClick={handleEndGame}
              disabled={isEnding}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
            >
              <CheckCircle className="w-4 h-4" />
              {isEnding ? "Ending…" : "End Game"}
            </button>
          )}
        </div>
      </div>

      {/* Hero scoreboard */}
      <div className="rounded-xl border bg-card px-4 py-1.5 grid grid-cols-[1fr_auto_1fr] items-center shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-4xl font-black tabular-nums leading-none">{game.homeScore}</span>
          <span className="text-sm font-bold text-muted-foreground truncate">{game.homeTeam.name}</span>
        </div>
        <span className="text-xl text-muted-foreground px-3">–</span>
        <div className="flex items-center gap-3 justify-end min-w-0">
          <span className="text-sm font-bold text-muted-foreground truncate">{game.awayTeam.name}</span>
          <span className="text-4xl font-black tabular-nums leading-none">{game.awayScore}</span>
        </div>
      </div>

      {/* Main 3-column area: home | actions | away */}
      <div className="grid gap-2 lg:grid-cols-[1fr_200px_1fr] lg:grid-rows-[minmax(0,1fr)] lg:flex-1 lg:min-h-0">
        {renderTeamPanel(game.homeTeam, game.homeTeamFouls, game.homeTeamTimeouts)}

        {/* Center action panel — applies to the selected player */}
        <div className="rounded-xl border bg-card p-2 flex flex-col gap-1.5 min-h-0 lg:overflow-y-auto">
          <div
            className={cn(
              "rounded-lg border px-2 py-1.5 text-center min-h-[52px] flex flex-col items-center justify-center shrink-0",
              selectedEntry && "border-primary bg-primary/10"
            )}
          >
            {selectedEntry ? (
              <>
                <p className="text-xs font-bold leading-tight truncate w-full">{selectedPlayerName}</p>
                <p className="text-[10px] text-muted-foreground truncate w-full">
                  {selectedTeamId === game.homeTeam.id ? game.homeTeam.name : game.awayTeam.name}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">← Tap a player →</p>
            )}
          </div>

          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">Points</p>
          <div className="grid grid-cols-3 gap-1">
            {[1, 2, 3].map((pts) => (
              <button
                key={pts}
                onClick={() => handleStatEvent("POINT", pts)}
                disabled={!canRecord}
                className="py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                +{pts}
              </button>
            ))}
          </div>

          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">Stats</p>
          <button
            onClick={() => handleStatEvent("REBOUND", 1)}
            disabled={!canRecord}
            className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            +1 REB
          </button>
          <button
            onClick={() => handleStatEvent("ASSIST", 1)}
            disabled={!canRecord}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            +1 AST
          </button>
          <button
            onClick={() => handleStatEvent("FOUL", 1)}
            disabled={!canRecord}
            className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            +1 FOUL
          </button>

          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">Deduct</p>
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
                  "py-2 rounded-lg border font-bold text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed",
                  cls
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {renderTeamPanel(game.awayTeam, game.awayTeamFouls, game.awayTeamTimeouts)}
      </div>

      {/* Activity log */}
      <div className="rounded-xl border bg-card px-3 py-2 shrink-0 flex flex-col lg:h-32">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity Log</p>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3 text-[10px] font-semibold text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-yellow-400" /> 4 fouls
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-red-500" /> 5+ fouls
              </span>
            </div>
            <button
              onClick={handleUndo}
              disabled={!lastEvent || loading}
              className="px-2.5 py-1 border rounded-lg text-xs font-semibold hover:bg-muted flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Undo last
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1 mt-1.5 overflow-y-auto flex-1 max-h-40 lg:max-h-none">
          {activityLog.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">No events recorded yet</p>
          ) : (
            activityLog.map((entry) => {
              const isPositive = entry.value >= 0;
              const abs = Math.abs(entry.value);
              const sign = isPositive ? "+" : "−";
              const label =
                entry.eventType === "POINT"
                  ? `${sign}${abs} ${abs === 1 ? "PT" : "PTS"}`
                  : entry.eventType === "REBOUND"
                  ? `${sign}${abs} REB`
                  : entry.eventType === "ASSIST"
                  ? `${sign}${abs} AST`
                  : `${sign}${abs} FOUL`;
              const badgeCls =
                entry.eventType === "POINT"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400"
                  : entry.eventType === "REBOUND"
                  ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                  : entry.eventType === "ASSIST"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                  : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400";
              return (
                <div key={entry.id} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-muted/40 text-xs shrink-0">
                  <span className={cn("shrink-0 px-1.5 py-0.5 rounded font-bold tabular-nums", badgeCls)}>
                    {label}
                  </span>
                  <span className="font-medium truncate">
                    {entry.jerseyNumber !== null && <span className="font-bold">#{entry.jerseyNumber} </span>}
                    {entry.playerName}
                  </span>
                  <span className="text-muted-foreground shrink-0">·</span>
                  <span className="text-muted-foreground truncate">{entry.teamName}</span>
                  <span className="text-muted-foreground shrink-0 ml-auto">{entry.quarter === 1 ? "1H" : "2H"}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
