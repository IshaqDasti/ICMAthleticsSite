"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { RotateCcw, ChevronRight, CheckCircle, UserPlus, X, Trash2, Pencil, Check } from "lucide-react";
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

interface ActivityLogEntry {
  id: string;
  eventType: EventType;
  playerName: string;
  jerseyNumber: string | null;
  teamId: string | null;
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
  gamePlayed?: boolean;
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
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [undoing, setUndoing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStat>>({});
  const [subStats, setSubStats] = useState<Record<string, PlayerStat>>({});
  const [substitutes, setSubstitutes] = useState<Record<string, SubstituteEntry[]>>({});
  const [manageTeamId, setManageTeamId] = useState<string | null>(null);
  const [benchedIds, setBenchedIds] = useState<Set<string>>(new Set());
  const [showAddSubForm, setShowAddSubForm] = useState(false);
  const [subName, setSubName] = useState("");
  const [subJersey, setSubJersey] = useState("");
  const [addingSub, setAddingSub] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState<string | null>(null);
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

  // Court/bench is a client-side view concern (which entries show on the main board),
  // persisted per game in localStorage. Default: everyone on court. We store the BENCHED
  // set, so newly added players/subs default to on court automatically.
  const courtStorageKey = `icm-bench-${game.id}`;
  const subKey = (statsId: string) => `sub:${statsId}`;
  const isBenched = (key: string) => benchedIds.has(key);

  // "Played" = server-owned attendance (gamePlayed) OR any recorded stat (covers the
  // optimistic window before a refetch). Independent of court/bench.
  const hasStats = (s: PlayerStat | undefined) =>
    !!s && (s.points > 0 || s.rebounds > 0 || s.assists > 0 || s.fouls > 0);
  const playerPlayed = (playerId: string) => {
    const s = playerStats[playerId];
    return !!s && (s.gamePlayed || hasStats(s));
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(courtStorageKey);
      if (raw) setBenchedIds(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore malformed / unavailable storage */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  const persistBench = useCallback(
    (next: Set<string>) => {
      try {
        localStorage.setItem(courtStorageKey, JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
    },
    [courtStorageKey]
  );

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
        pMap[s.playerId] = { points: s.points, rebounds: s.rebounds, assists: s.assists, fouls: s.fouls ?? 0, gamePlayed: s.gamePlayed ?? false };
      } else if (s.substituteName) {
        sMap[s.id] = { points: s.points, rebounds: s.rebounds, assists: s.assists, fouls: s.fouls ?? 0, gamePlayed: s.gamePlayed ?? true };
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
        return { id: e.id, eventType: e.eventType as EventType, playerName, jerseyNumber, teamId: e.teamId, teamName, quarter: e.quarter, value: e.value };
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

  // Accidental-exit protection — active only while the game is live.
  // Layer 1: browser-level (refresh / tab close / back-forward). Browsers show their
  // own native dialog and don't allow a custom message here, by design.
  useEffect(() => {
    if (!game.isLive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [game.isLive]);

  // Layer 2: in-app navigation (admin sidebar / any internal link). beforeunload does
  // not fire for client-side route changes, so intercept anchor clicks that leave this
  // page and confirm. Live scoring is persisted server-side, so this is a guard against
  // an accidental tap, not against data loss.
  useEffect(() => {
    if (!game.isLive) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const dest = new URL(href, window.location.href);
      if (dest.origin !== window.location.origin || dest.pathname === window.location.pathname) return;
      if (!window.confirm("A game is in progress. Leave this page? Your scoring is saved, but you'll stop keeping the book here.")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [game.isLive]);

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
      setActivityLog((prev) => [
        { id: data.event.id, eventType: type, playerName, jerseyNumber, teamId: selectedTeamId, teamName: selectedTeam.name, quarter: game.currentQuarter, value },
        ...prev,
      ]);
    }
  }

  function toggleLogSelect(id: string) {
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Reverse any combination of activity-log entries. Order-independent: each is a
  // soft-delete on the server (compensating decrements), and we re-hydrate player /
  // sub / team-foul state from the DB via fetchStats afterward. Only the game score
  // isn't returned by fetchStats, so we adjust it optimistically here (POINT only).
  const undoEntries = useCallback(
    async (entries: ActivityLogEntry[]) => {
      if (entries.length === 0 || undoing) return;
      setUndoing(true);
      let homeDelta = 0;
      let awayDelta = 0;
      let failures = 0;
      for (const entry of entries) {
        const res = await fetch(`/api/games/${game.id}/events/${entry.id}`, { method: "DELETE" });
        if (!res.ok) {
          failures += 1;
          continue;
        }
        if (entry.eventType === "POINT") {
          if (entry.teamId === game.homeTeam.id) homeDelta -= entry.value;
          else awayDelta -= entry.value;
        }
      }
      if (homeDelta !== 0 || awayDelta !== 0) {
        setGame((prev) => ({ ...prev, homeScore: prev.homeScore + homeDelta, awayScore: prev.awayScore + awayDelta }));
      }
      setSelectedEntry(null);
      setSelectedLogIds(new Set());
      await fetchStats();
      setUndoing(false);
      if (failures > 0) {
        toast.error(`Could not undo ${failures} ${failures === 1 ? "action" : "actions"}`);
      } else {
        toast.success(entries.length > 1 ? `${entries.length} actions undone` : "Action undone");
      }
    },
    [undoing, game.id, game.homeTeam.id, fetchStats]
  );

  function handleUndoSelected() {
    const ids = selectedLogIds;
    // process in the log's current (newest-first) order for consistent derived state
    const entries = activityLog.filter((e) => ids.has(e.id));
    undoEntries(entries);
  }

  async function handleAddSub() {
    if (!subName.trim() || !manageTeamId) return;
    setAddingSub(true);

    const res = await fetch(`/api/games/${game.id}/substitute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: subName.trim(),
        jersey: subJersey.trim() || undefined,
        teamId: manageTeamId,
      }),
    });

    if (!res.ok) {
      toast.error("Failed to add substitute");
    } else {
      const data = await res.json();
      const teamId = manageTeamId;
      const newSub: SubstituteEntry = {
        statsId: data.substitute.id,
        displayName: data.substitute.substituteName,
        jerseyNumber: data.substitute.substituteJersey ?? null,
      };
      setSubstitutes((prev) => ({
        ...prev,
        [teamId]: [...(prev[teamId] ?? []), newSub],
      }));
      setSubStats((prev) => ({
        ...prev,
        [newSub.statsId]: { points: 0, rebounds: 0, assists: 0, fouls: 0, gamePlayed: true },
      }));
      setShowAddSubForm(false);
      setSubName("");
      setSubJersey("");
      toast.success(`${newSub.displayName} added as substitute`);
    }
    setAddingSub(false);
  }

  function handleCancelAddSub() {
    setShowAddSubForm(false);
    setSubName("");
    setSubJersey("");
  }

  function openManageTeam(teamId: string) {
    setManageTeamId(teamId);
    setShowAddSubForm(false);
    setSubName("");
    setSubJersey("");
    handleCancelEditSub();
  }

  function closeManageTeam() {
    setManageTeamId(null);
    setShowAddSubForm(false);
    setSubName("");
    setSubJersey("");
    handleCancelEditSub();
  }

  // Move an entry (rostered player id, or `sub:<statsId>`) between court and bench.
  // Purely client-side view state; benching the selected entry clears the selection.
  function setEntryBenched(key: string, benched: boolean) {
    setBenchedIds((prev) => {
      const next = new Set(prev);
      if (benched) next.add(key);
      else next.delete(key);
      persistBench(next);
      return next;
    });
    if (benched) {
      if (selectedEntry?.type === "player" && selectedEntry.id === key) setSelectedEntry(null);
      if (selectedEntry?.type === "sub" && subKey(selectedEntry.statsId) === key) setSelectedEntry(null);
    }
  }

  // Manual attendance: mark a rostered player present/absent. Writes gamePlayed server-side
  // (which feeds career gamesPlayed). Absent is only allowed when they have no recorded stats.
  async function toggleAttendance(teamId: string, playerId: string) {
    if (attendanceLoading) return;
    const stat = playerStats[playerId];
    const present = playerPlayed(playerId);
    if (present && hasStats(stat)) return; // recorded stats — attendance is implied and locked
    const next = !present;
    setAttendanceLoading(playerId);
    const res = await fetch(`/api/games/${game.id}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, teamId, present: next }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to update attendance");
    } else {
      setPlayerStats((prev) => {
        const nextMap = { ...prev };
        if (next) {
          const cur = nextMap[playerId] ?? { points: 0, rebounds: 0, assists: 0, fouls: 0 };
          nextMap[playerId] = { ...cur, gamePlayed: true };
        } else {
          delete nextMap[playerId];
        }
        return nextMap;
      });
    }
    setAttendanceLoading(null);
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
    setBenchedIds((prev) => {
      if (!prev.has(subKey(statsId))) return prev;
      const next = new Set(prev);
      next.delete(subKey(statsId));
      persistBench(next);
      return next;
    });

    toast.success("Substitute removed");
  }

  const canRecord = !!selectedEntry && game.isLive;

  function renderTeamPanel(team: Team, fouls: number, timeouts: number) {
    const subs = substitutes[team.id] ?? [];
    const inBonus = fouls >= 7;
    const inDoubleBonus = fouls >= 10;
    const activePlayers = team.players.filter((p) => !isBenched(p.id));
    const activeSubs = subs.filter((s) => !isBenched(subKey(s.statsId)));
    const benchCount = team.players.length + subs.length - activePlayers.length - activeSubs.length;
    // Subs are created as gamePlayed; rostered players count when marked present or after a stat.
    const playedCount = team.players.filter((p) => playerPlayed(p.id)).length + subs.length;

    const courtCard = (opts: {
      key: string;
      selected: boolean;
      onSelect: () => void;
      jerseyNumber: string | null;
      name: string;
      isSub: boolean;
      stats?: PlayerStat;
    }) => {
      const f = opts.stats?.fouls ?? 0;
      return (
        <button
          key={opts.key}
          onClick={opts.onSelect}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left transition-colors min-w-0",
            opts.selected
              ? "bg-primary text-primary-foreground ring-2 ring-primary"
              : f >= 5
              ? "bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-foreground"
              : f === 4
              ? "bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 text-foreground"
              : "bg-muted/50 hover:bg-muted text-foreground"
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">
              {opts.jerseyNumber !== null && <span className="font-bold">#{opts.jerseyNumber} </span>}
              {opts.name}
              {opts.isSub && (
                <span className={cn("ml-1", opts.selected ? "opacity-60" : "text-muted-foreground")}>(sub)</span>
              )}
            </div>
            <div className={cn("text-[10px] font-normal tabular-nums", opts.selected ? "opacity-75" : "opacity-50")}>
              {opts.stats ? `${opts.stats.points}P · ${opts.stats.rebounds}R · ${opts.stats.assists}A` : "0P · 0R · 0A"}
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 text-[9px] font-bold rounded px-1 py-0.5 tabular-nums whitespace-nowrap",
              opts.selected
                ? "bg-primary-foreground/20"
                : f >= 5
                ? "bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-300"
                : f === 4
                ? "bg-yellow-200 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300"
                : "bg-muted text-muted-foreground"
            )}
          >
            {f} PF
          </span>
        </button>
      );
    };

    return (
      <div className="rounded-xl border bg-card p-2 flex flex-col gap-2 min-h-0 min-w-0">
        <div className="flex items-center justify-between gap-2 px-1 shrink-0">
          <span className="text-sm font-bold truncate">{team.name}</span>
          <span
            title="Players marked as having played this game"
            className="shrink-0 text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/50 rounded px-1.5 py-0.5 whitespace-nowrap"
          >
            {playedCount} played
          </span>
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

        {/* Roster — on-court entries only; bench + subs managed via Manage Team */}
        <div className="grid grid-cols-2 gap-1 content-start overflow-y-auto min-h-0 flex-1">
          {activePlayers.length === 0 && activeSubs.length === 0 && (
            <p className="col-span-2 text-[11px] text-muted-foreground text-center py-3">
              No one on court — tap Manage Team below.
            </p>
          )}

          {activePlayers.map((player) => {
            const isSelected = selectedEntry?.type === "player" && selectedEntry.id === player.id;
            return courtCard({
              key: player.id,
              selected: isSelected,
              onSelect: () => {
                setSelectedTeamId(team.id);
                setSelectedEntry(isSelected ? null : { type: "player", id: player.id });
              },
              jerseyNumber: player.jerseyNumber,
              name: player.displayName,
              isSub: false,
              stats: playerStats[player.id],
            });
          })}

          {activeSubs.map((sub) => {
            const isSelected = selectedEntry?.type === "sub" && selectedEntry.statsId === sub.statsId;
            return courtCard({
              key: sub.statsId,
              selected: isSelected,
              onSelect: () => {
                setSelectedTeamId(team.id);
                setSelectedEntry(isSelected ? null : { type: "sub", statsId: sub.statsId });
              },
              jerseyNumber: sub.jerseyNumber,
              name: sub.displayName,
              isSub: true,
              stats: subStats[sub.statsId],
            });
          })}

          <button
            onClick={() => openManageTeam(team.id)}
            className="col-span-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border border-dashed transition-colors flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-3 h-3" />
            Manage Team
            {benchCount > 0 && (
              <span className="text-[10px] font-bold bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                {benchCount} on bench
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  function renderManageModal() {
    if (!manageTeamId) return null;
    const team = game.homeTeam.id === manageTeamId ? game.homeTeam : game.awayTeam;
    const subs = substitutes[team.id] ?? [];

    type Row =
      | { kind: "player"; id: string; jerseyNumber: string | null; name: string; stats?: PlayerStat }
      | { kind: "sub"; statsId: string; jerseyNumber: string | null; name: string; stats?: PlayerStat };

    const rows: Row[] = [
      ...team.players.map(
        (p): Row => ({ kind: "player", id: p.id, jerseyNumber: p.jerseyNumber, name: p.displayName, stats: playerStats[p.id] })
      ),
      ...subs.map(
        (s): Row => ({ kind: "sub", statsId: s.statsId, jerseyNumber: s.jerseyNumber, name: s.displayName, stats: subStats[s.statsId] })
      ),
    ];
    const keyOf = (r: Row) => (r.kind === "player" ? r.id : subKey(r.statsId));
    const courtRows = rows.filter((r) => !isBenched(keyOf(r)));
    const benchRows = rows.filter((r) => isBenched(keyOf(r)));

    const renderRow = (r: Row) => {
      const key = keyOf(r);
      const benched = isBenched(key);
      const stats = r.stats;
      const isEditingSub = r.kind === "sub" && editingSubStatsId === r.statsId;
      const played = r.kind === "sub" ? true : playerPlayed(r.id);
      const locked = r.kind === "sub" ? true : hasStats(stats);
      return (
        <div key={key} className="rounded-lg border bg-muted/40 px-2 py-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">
                {r.jerseyNumber !== null && <span className="font-bold">#{r.jerseyNumber} </span>}
                {r.name}
                {r.kind === "sub" && <span className="ml-1 text-muted-foreground">(sub)</span>}
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {stats
                  ? `${stats.points}P · ${stats.rebounds}R · ${stats.assists}A · ${stats.fouls}PF`
                  : "0P · 0R · 0A · 0PF"}
              </div>
            </div>

            {/* Attendance — rostered players toggle gamePlayed; subs are always played */}
            {r.kind === "sub" ? (
              <span className="shrink-0 text-[9px] font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/50 rounded px-1.5 py-0.5 uppercase tracking-wide">
                played
              </span>
            ) : played ? (
              <button
                onClick={() => toggleAttendance(team.id, r.id)}
                disabled={locked || attendanceLoading === r.id}
                title={locked ? "Recorded stats — counted as played" : "Tap to mark absent"}
                className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/50 rounded px-1.5 py-1 uppercase tracking-wide disabled:cursor-default enabled:hover:bg-green-200 enabled:cursor-pointer"
              >
                <Check className="w-2.5 h-2.5" /> played
              </button>
            ) : (
              <button
                onClick={() => toggleAttendance(team.id, r.id)}
                disabled={attendanceLoading === r.id}
                className="shrink-0 text-[10px] font-bold text-muted-foreground border rounded px-2 py-1 hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
              >
                Mark present
              </button>
            )}

            {/* Court / bench move */}
            <button
              onClick={() => setEntryBenched(key, !benched)}
              className={cn(
                "shrink-0 text-[11px] font-bold rounded px-2 py-1 border transition-colors",
                benched
                  ? "border-primary text-primary hover:bg-primary/10"
                  : "border-muted-foreground/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {benched ? "→ Court" : "Bench →"}
            </button>

            {/* Sub edit / delete */}
            {r.kind === "sub" && (
              <div className="shrink-0 flex items-center gap-0.5">
                <button
                  onClick={() =>
                    isEditingSub
                      ? handleCancelEditSub()
                      : handleStartEditSub({ statsId: r.statsId, displayName: r.name, jerseyNumber: r.jerseyNumber })
                  }
                  title="Edit substitute"
                  className={cn(
                    "p-1 rounded transition-colors",
                    isEditingSub ? "text-foreground bg-muted" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDeleteSub(r.statsId, team.id)}
                  title="Remove substitute"
                  className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {isEditingSub && (
            <div className="flex gap-1 mt-1.5">
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
              <button onClick={handleCancelEditSub} className="p-1.5 border rounded hover:bg-muted text-muted-foreground">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeManageTeam}>
        <div
          className="w-full max-w-2xl rounded-xl border bg-card shadow-xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3 shrink-0">
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">{team.name} — Manage Team</h3>
              <p className="text-[11px] text-muted-foreground">Move players on/off court and mark who played.</p>
            </div>
            <button onClick={closeManageTeam} className="p-1.5 rounded border hover:bg-muted text-muted-foreground shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 overflow-y-auto grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">On Court · {courtRows.length}</p>
              {courtRows.length ? courtRows.map(renderRow) : <p className="text-xs text-muted-foreground py-2">No one on court.</p>}
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bench · {benchRows.length}</p>
              {benchRows.length ? benchRows.map(renderRow) : <p className="text-xs text-muted-foreground py-2">No one on the bench.</p>}

              {showAddSubForm ? (
                <div className="flex gap-1 rounded-lg border bg-muted/40 p-1.5 mt-1">
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
                  <button onClick={handleCancelAddSub} className="p-1.5 border rounded hover:bg-muted text-muted-foreground">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddSubForm(true)}
                  className="mt-1 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border border-dashed transition-colors flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-3 h-3" />
                  Add New Sub
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 lg:flex-1 lg:min-h-0">
      {renderManageModal()}
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
              onClick={handleUndoSelected}
              disabled={selectedLogIds.size === 0 || undoing}
              className="px-2.5 py-1 border rounded-lg text-xs font-semibold hover:bg-muted flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              {selectedLogIds.size > 0 ? `Undo Selected (${selectedLogIds.size})` : "Undo Selected"}
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
              const isChecked = selectedLogIds.has(entry.id);
              return (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 rounded-lg text-xs shrink-0",
                    isChecked ? "bg-primary/10 ring-1 ring-primary/40" : "bg-muted/40"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleLogSelect(entry.id)}
                    disabled={undoing}
                    className="shrink-0 w-3.5 h-3.5 accent-primary cursor-pointer disabled:cursor-not-allowed"
                    aria-label="Select to undo"
                  />
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
                  <button
                    onClick={() => undoEntries([entry])}
                    disabled={undoing}
                    className="shrink-0 px-1.5 py-0.5 border rounded text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Undo
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
