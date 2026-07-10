---
name: stats-and-standings
description: The 4-layer derived-data model (GameEvent log, per-game stats, TeamSeason standings, PlayerCareerStats) and how to keep or repair consistency - finalizeGame vs recalculateTeams, unfinalizeGame, recalculatePlayerCareerStats, streak/win% math, standings sort order, box score editing. Use when standings or career totals look wrong, after editing box scores, when changing src/lib/db/mutations/standings.ts, src/lib/utils/stats.ts, or the recalculate endpoints.
---

# Stats & Standings — Derived Data Layers

## The four layers (THE central invariant)

1. **GameEvent log** — append-only, soft-deleted via `undone` (prisma/schema.prisma `GameEvent`).
2. **Per-game aggregates** — `PlayerGameStats`, `TeamGameStats`, `Game.homeScore/awayScore/homeTeamFouls/awayTeamFouls`. Kept in sync with layer 1 by `applyGameEvent`/`undoGameEvent` in `src/lib/db/mutations/stats.ts` (same transaction). See [live-scoring].
3. **TeamSeason standings** — `wins/losses/pointsFor/pointsAgainst/streak` per team per season.
4. **PlayerCareerStats** — `totalPoints/totalRebounds/totalAssists/gamesPlayed` per player.

Layers 3–4 are derived from layer 2 (never from layer 1). All writers live in `src/lib/db/mutations/standings.ts` — except `POST /api/standings/recalculate`, which duplicates the rebuild inline (see below).

## finalizeGame vs recalculateTeams — why both exist

**`finalizeGame(gameId)`** — *incremental*. Runs when a game ends (`POST /api/games/[id]/live` action `end`, and `PUT /api/games/[id]/boxscore` when the request body includes a home/away score AND the game wasn't previously COMPLETED — a score-less PUT never finalizes). It:
- increments the two `TeamSeason` rows (wins/losses/pointsFor/pointsAgainst) from `Game.homeScore/awayScore`,
- updates `streak` via `computeStreak(current, won)`: win → `current >= 0 ? current + 1 : 1`; loss → `current <= 0 ? current - 1 : -1`,
- upserts both `TeamGameStats` rows with final `score` and `won` flags,
- sets `status: COMPLETED`, `isLive: false`,
- then runs `recalculatePlayerCareerStats` for this game's `gamePlayed: true` players.
Fast, one game. **Not idempotent** — run it twice and standings double-count.

**`recalculateTeams(teamIds, seasonId)`** — *full rebuild* for the given teams. Replays every `COMPLETED` game in the season ordered by `scheduledAt asc`, recomputing totals and streak (`computeStreakFromResults`) from `Game.homeScore/awayScore`. Idempotent; use whenever history changed (game reset, deleted, score edited). Called by `unfinalizeGame` and by the boxscore route when re-editing an already-COMPLETED game.

**`unfinalizeGame(gameId)`** (live route action `reset`): captures the game's non-null `playerId`s, then in one transaction hard-deletes all `GameEvent`/`PlayerGameStats`/`TeamGameStats` for the game and zeroes the `Game` back to `SCHEDULED` (scores, quarter score arrays, fouls, timeouts, `currentQuarter: 1`), then runs `recalculateTeams` for both teams + `recalculatePlayerCareerStats` for the captured players.

## Career stats

`recalculatePlayerCareerStats(playerIds)` — raw SQL `INSERT … ON CONFLICT ("playerId") DO UPDATE` over `player_game_stats` joined with **`"gamePlayed" = true`** only. `gamesPlayed = COUNT` of those rows. Always a full rebuild for the given players; idempotent. Walk-on substitutes are excluded by construction: their stats rows have `playerId = null` so no career row can exist.

- `POST /api/stats/recalculate-career` (`src/app/api/stats/recalculate-career/route.ts`, SUPER_ADMIN): rebuilds for every distinct `playerId` found in `player_game_stats`. Admin dashboard trigger: `RecalculateCareerStatsButton` in `src/app/(admin)/admin/RecalculateCareerStatsButton.tsx`, mounted on `src/app/(admin)/admin/page.tsx`.
- Limitation: it only touches players who *currently have* game-stat rows. A player whose rows were all deleted keeps a stale career row until you pass their id explicitly.

## Streak and win% semantics

- `streak` int: positive = current win streak, negative = current loss streak, 0 = no games. Rendered by `formatStreak` in `src/lib/utils/standings.ts` (`W3` / `L2` / `-`).
- `winPct(wins, losses)` in `src/lib/utils/stats.ts`: `wins / (wins+losses)` to 3 decimals, `0` when no games. `formatWinPct` strips the leading zero (`.750`). `calculateAvg` is the per-game average helper for player stats.

## Standings sort order

`getStandings(seasonId)` in `src/lib/db/queries/standings.ts`: win% desc, then point differential (`pointsFor - pointsAgainst`) desc. Rank is computed at read time (`index + 1`). The same comparator is duplicated in `sortStandings` (`src/lib/utils/standings.ts`) — change both together. `TeamSeason.standingsRank` exists in the schema but is written nowhere; ignore it or wire it up deliberately.

## Box score editing (bypasses the event log)

`PUT /api/games/[id]/boxscore` (`src/app/api/games/[id]/boxscore/route.ts`), driven by `BoxScoreEditor` (`src/components/boxscore/BoxScoreEditor.tsx`):
- Bulk-upserts rostered player rows via raw SQL (`ON CONFLICT ("gameId", "playerId")`), bulk-updates substitute rows by stats-row id, optionally overwrites `Game.homeScore/awayScore` + `scorekeeperName` and forces `status: COMPLETED`.
- Then: if the game was **not** previously COMPLETED → `finalizeGame`; if it **was** → `recalculateTeams` (both teams) + `recalculatePlayerCareerStats` in parallel. This is why editing a finished game doesn't double-count.
- It writes **no GameEvents** — after a manual edit, layer 1 no longer matches layer 2. Accepted: nothing derives from layer 1.
- The editor edits points/rebounds/assists/`gamePlayed` only (no fouls) and can add/delete substitutes.

`POST /api/standings/recalculate` (`src/app/api/standings/recalculate/route.ts`, SUPER_ADMIN, body `{ seasonId }`): full rebuild of **every** `TeamSeason` in the season. Note it duplicates the rebuild/streak logic inline rather than calling `recalculateTeams` — a third copy of the streak algorithm (with `finalizeGame.computeStreak` and `computeStreakFromResults`). Change streak semantics in all three places.

## Repairing drift — runbook

| Symptom | Fix |
|---|---|
| Standings wrong (double "end", deleted/edited COMPLETED game, manual DB edit) | `POST /api/standings/recalculate` with `{ "seasonId": … }` (SUPER_ADMIN) |
| Career totals/gamesPlayed wrong | Admin dashboard "Recalculate Career Stats" button, or `POST /api/stats/recalculate-career` (SUPER_ADMIN) |
| One game's stats corrupted mid/post-game | Admin → Edit Game → Reset (`action: "reset"`), then re-enter via box score editor. Destroys that game's event log permanently |
| `Game.homeScore` disagrees with player totals | Box score editor: set correct final score + player lines, Save (it re-derives layers 3–4) |
| A COMPLETED game was deleted (`DELETE /api/games/[id]`) | Cascades wipe its stats but touch neither TeamSeason nor career rows → run BOTH recalcs |
| Sub's stats counted after removal | Substitute DELETE already compensates layer 2; if the game was COMPLETED, follow with standings recalc |

**Firing the recalc endpoints** — standings recalc has NO admin button (career stats
has one). From a logged-in `/admin` tab's devtools console:

```js
await fetch("/api/standings/recalculate", { method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ seasonId: "…" }) }).then(r => r.json())
```

Get `seasonId` from Prisma Studio or `GET /api/seasons`. Same pattern works for
`/api/stats/recalculate-career` (no body needed).

After any recalc, public pages may still serve cached HTML — neither recalculate route calls `revalidatePath` (the boxscore and live routes do). Trigger a mutation that revalidates, or redeploy, if stale.

## Gotchas

- **Ties count as a loss for both teams**: `finalizeGame` computes `homeWon = homeScore > awayScore` and `awayWon = awayScore > homeScore`; on a tie both are false → both teams get `losses + 1` (and `recalculateTeams` agrees). League games shouldn't tie; the box score editor can create ties.
- **Layer 3–4 rebuilds read layer 2, not events.** Corrupt `Game.homeScore` propagates through every recalc; the event log will not save you.
- **Streak rebuild depends on `scheduledAt asc` ordering** — games with null `scheduledAt` have unreliable ordering, so streaks may be wrong for unscheduled completed games.
- **`gamePlayed` gates career counting.** Unchecking "Played" in the box score editor removes that game from a player's career totals/gamesPlayed on the next recalc, even if the stat line is non-zero.
- Recalc endpoints require SUPER_ADMIN (role hierarchy in `src/lib/auth/withAuth.ts`); scorekeepers cannot self-repair.

## Related skills

[live-scoring] (how layers 1–2 are written live) · [database-changes] (cascade behavior, what game/player/team deletion destroys)
