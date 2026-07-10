---
name: live-scoring
description: The live scorekeeping engine - ScorekeeperBoard touch UI, POST /api/games/[id]/events, applyGameEvent/undoGameEvent, substitutes, halves, game start/end/reset, Supabase Realtime updates to viewers. Use when changing src/components/live, src/app/api/games/[id]/{events,live,substitute}, src/lib/db/mutations/stats.ts, adding an EventType or a NEW TRACKED STAT (steals, blocks, turnovers), debugging wrong scores/fouls in a live game, undo bugs, or realtime not updating.
---

# Live Scoring Engine

The money feature: a scorekeeper on a phone courtside records events; public viewers see updates in <1s. Stats written here feed standings and career stats downstream — a bug here corrupts everything. Read the whole Gotchas section before touching any of it.

## Data flow

1. Admin page `src/app/(admin)/admin/live/[gameId]/page.tsx` loads the game + both rosters (sorted by jersey) and mounts `ScorekeeperBoard` (`src/components/live/ScorekeeperBoard.tsx`, client component).
2. Tapping a stat button → optimistic local state update → `POST /api/games/[id]/events` (`src/app/api/games/[id]/events/route.ts`, `withAuth(..., "SCOREKEEPER")`).
3. The route calls `applyGameEvent()` in `src/lib/db/mutations/stats.ts`, which writes **four things in ONE `prisma.$transaction`**: a `GameEvent` row, a `PlayerGameStats` upsert/update, a `TeamGameStats` upsert, and a `Game` update (`homeScore`/`awayScore` or `homeTeamFouls`/`awayTeamFouls`).
4. Supabase Realtime (postgres_changes) broadcasts the `games` / `player_game_stats` row changes to subscribed clients: public `BoxScoreView` (`src/components/boxscore/BoxScoreView.tsx`, plus a 10s poll fallback), `LiveGameBanner` (`src/components/layout/LiveGameBanner.tsx`), and the board itself. Only tables in the `supabase_realtime` publication broadcast — see [database-changes].

## Event types and effects

`EventType` enum (prisma/schema.prisma): `POINT REBOUND ASSIST FOUL QUARTER_END GAME_START GAME_END`. Only the first four are ever created. In `applyGameEvent`:

- `POINT` (value 1/2/3): player `points`, `TeamGameStats.score`, `Game.homeScore|awayScore` (side chosen by the client-sent `isHome` flag).
- `REBOUND` / `ASSIST` (value 1): player stat only.
- `FOUL` (value 1): player `fouls` + `Game.homeTeamFouls|awayTeamFouls`. Not tracked on `TeamGameStats`.
- The board's "Deduct" buttons send the same types with `value: -1` — negative-value events are normal events, not undos.
- `QUARTER_END`/`GAME_START`/`GAME_END` are dead enum values: no code emits them, and `applyGameEvent` throws unless `playerId` or `substituteStatsId` is set. Do not assume the event log contains lifecycle markers.

First event for a rostered player upserts their `PlayerGameStats` row with `gamePlayed: true` — that flag gates career-stat counting ([stats-and-standings]).

## Sequence numbering — NOT atomic

`applyGameEvent` does `findFirst` for the max `sequence` per game, then writes `max + 1` — the read happens **before** the transaction, and `@@index([gameId, sequence])` is a plain index, not unique. Two concurrent writers silently produce duplicate sequences. **Operating assumption: exactly one scorekeeper per game.** If you ever allow two, make sequence assignment atomic (DB sequence or unique constraint + retry) first.

## Undo

- Board keeps only the single `lastEvent` → "Undo last" → `DELETE /api/games/[id]/events/[eventId]` → `undoGameEvent()` in `src/lib/db/mutations/stats.ts`.
- Soft delete: sets `undone: true, undoneAt`, then compensating **decrements** on player stats, `TeamGameStats.score` (POINT only), and `Game` score/fouls, all in one transaction. Events are never hard-deleted during play (substitute removal also soft-deletes; only game reset hard-deletes).
- `GET /api/games/[id]/events` returns the latest 20 non-undone events (public, no auth) — feeds the board's activity log.
- Undo derives `isHome` from `event.teamId === game.homeTeamId`; the original apply trusted the client's `isHome`. If a client ever sends mismatched `teamId`/`isHome`, apply and undo hit different score columns (see Gotchas).

## Substitutes (walk-ons)

- `POST /api/games/[id]/substitute` (`src/app/api/games/[id]/substitute/route.ts`) creates a `PlayerGameStats` row with `playerId: null`, `substituteName`, `substituteJersey`, `gamePlayed: true`. Postgres allows many NULL `playerId` rows despite `@@unique([gameId, playerId])`.
- Events for subs send `substituteStatsId` (the stats row id) instead of `playerId`; `applyGameEvent` updates that row directly, and `GameEvent.substituteStatsId` records it.
- `PATCH` renames a sub. `DELETE` reverses everything in one transaction: marks all their events `undone`, deletes the stats row, decrements `Game` score/fouls and `TeamGameStats.score` by the sub's totals. Not undoable.
- Subs never feed `PlayerCareerStats` (no `playerId`) — intentional.

## Halves ("quarters")

- `Game.currentQuarter` means **half**: 1 = 1st half, 2 = 2nd half. Every event records the current value in `GameEvent.quarter`.
- "Start 2nd Half" → `PUT /api/games/[id]` with `{ currentQuarter: 2 }`. That route (`src/app/api/games/[id]/route.ts`) then **zeroes both teams' fouls and timeouts** and ignores any foul/timeout fields in the same payload.
- Team foul +/− and timeout +/− buttons also go through `PUT /api/games/[id]` with absolute values — they create **no GameEvent**, so team foul counters legitimately diverge from the sum of player FOUL events.
- `Game.homeQuarterScores`/`awayQuarterScores` are **never written by live scoring**. They are only displayed by `BoxScoreView`/`QuarterScoreBar` when non-empty and cleared by `unfinalizeGame`. Don't build on them without adding a writer.

## Lifecycle: start / end / reset

`POST /api/games/[id]/live` (`src/app/api/games/[id]/live/route.ts`) with `{ action }`:

- `start`: `status: IN_PROGRESS`, `isLive: true`, upserts the two `TeamGameStats` rows, `revalidatePath` for `/schedule`, `/`, `/teams`.
- `end`: calls `finalizeGame()` — increments TeamSeason standings, sets `won` flags, recalcs career stats, `status: COMPLETED`, `isLive: false`. See [stats-and-standings].
- `reset`: calls `unfinalizeGame()` — **hard-deletes** all events + game stats, zeroes the game back to `SCHEDULED`, full-rebuilds both teams' standings + career stats. Triggered from admin Edit Game page (`src/app/(admin)/admin/schedule/[id]/page.tsx`).

The board requires a non-empty scorekeeper name before End Game — **client-side only**; the API does not enforce it. The name persists on input blur via `PUT /api/games/[id]` (`handleScorekeeperBlur`); the boxscore route can also write `scorekeeperName`.

## Keeping derived layers consistent

Any new stat effect must be mirrored in ALL of:
1. `applyGameEvent` (all four transactional writes that apply),
2. `undoGameEvent` (exact compensating decrements),
3. substitute `DELETE` compensation in `src/app/api/games/[id]/substitute/route.ts`,
4. `ScorekeeperBoard` optimistic update + its failure rollback + its undo handler (three separate code paths in that file),
5. the board's hydration source `GET /api/games/[id]/stats` (`src/app/api/games/[id]/stats/route.ts`) — its explicit `select` list must include the new field or the board silently drops it on reload/undo,
6. downstream: `finalizeGame`/`recalculateTeams`/`recalculatePlayerCareerStats` if it feeds standings or career stats — a career-counted stat also needs a NEW COLUMN on `PlayerCareerStats` (model + the raw-SQL upsert's column list) ([stats-and-standings]),
7. the read side: box score display/editor (`src/components/boxscore/` — the stat table itself is `BoxScoreTeam.tsx`), career tiles on `src/app/(public)/players/[slug]/page.tsx`, and `stats/leaders`/`stats/export`/`PlayerRankingsTable` if the stat should rank.
Missing any one silently desyncs a layer or hides the stat.

## Gotchas

- **Double "end" double-counts standings.** The live route doesn't check status before `finalizeGame`, and `finalizeGame` increments (not idempotent). Two `end` calls = wins/losses/points counted twice. Repair: `POST /api/standings/recalculate`.
- **Undo after finalize desyncs standings.** `undoGameEvent` fixes layers 1–2 only; nothing re-runs standings/career recalc. The events DELETE route accepts any non-undone event regardless of game status. Repair: both recalcs.
- **Sequence race** (above): never add a second concurrent scorekeeper without atomic sequencing.
- **Negative team fouls via 2nd-half reset:** record a FOUL in H1 → start 2nd half (fouls zeroed) → undo that H1 foul → `homeTeamFouls` goes to −1 (DB decrement is unconditional).
- **`isHome` is client-trusted.** A mismatched `teamId`/`isHome` body increments one team's `TeamGameStats.score` and the *other* team's `Game` score column; undo (derived from `teamId`) then decrements the wrong side. Validate server-side if you touch this.
- **Realtime payload/filter column names are camelCase**, because `@@map` renames tables only (columns stay `homeScore`, `gameId`). Verified mismatches in current code: `ScorekeeperBoard` reads `payload.new.home_score` etc. (snake_case → undefined) and `BoxScoreView` filters `player_game_stats` on `game_id=eq.…` — both masked by optimistic updates / the 10s poll. Use real column names when adding subscriptions.
- **Per-event writes don't call `revalidatePath`** — only lifecycle actions do. Live freshness on public pages comes from client-side realtime + polling, not server re-render.
- **Undo is one-deep in the UI.** Older mistakes need `DELETE /api/games/[id]/events/<eventId>` directly (get ids from the events GET), or fix totals in the box score editor afterward.
- **Reset destroys the event log permanently** (`gameEvent.deleteMany`). There is no archive. Warn before using it on a game with real data.
- The events GET endpoint is unauthenticated by design (public activity feed); POST/DELETE require SCOREKEEPER role via `withAuth` (`src/lib/auth/withAuth.ts`).

## Related skills

[stats-and-standings] (derived layers, finalize/recalc, repair runbook) · [database-changes] (schema, realtime publication whitelist, EventType enum changes)
