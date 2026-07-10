---
name: project-map
description: Orientation map for the ICM Athletics repo — what the product is, directory layout, data model, the three archetypal request flows, where each kind of change lands, and which skill to load next. Use when starting any session in this repo, when unsure where code lives (routes, components, lib, prisma), or before touching standings, live scoring, admin CRUD, or public pages.
---

# Project Map

Load this first every session. It is the table of contents for the skill library.

## What this is

ICM Athletics: public website + admin console for the ICM Summer League (recreational
basketball). Public: standings, schedule, player rankings, team pages, live game viewer.
Admin: season/team/player/schedule CRUD, CSV roster import, courtside live scorekeeping
(touch UI on a phone), box score editing, user management. The money feature: live
scoring must update public viewers in <1s and must never corrupt stats.

Stack: Next.js 14.2 App Router + TypeScript + React 18 + Tailwind 3. Prisma 5 →
Supabase Postgres (`DATABASE_URL` = PgBouncer pooler :6543, `DIRECT_URL` = direct :5432).
Supabase Auth/Realtime/Storage. Vercel hosting + cron. No tests, no ESLint, no CI —
verify with `npx tsc --noEmit`, `npm run build`, and manual flows (see [verify]).
Ops reference: `DEPLOYMENT.md` at repo root.

## Directory map

- `src/app/(public)/` — no-auth pages: `page.tsx` (home — also renders the
  announcements feed inline), `standings/`, `schedule/`,
  `players/` (rankings, + `[slug]`), `teams/` (+ `[slug]`), `games/[gameId]` (live box
  score viewer), plus static `about/`, `rulebook/`, `codeofconduct/`.
- `src/app/(admin)/admin/` — auth-gated console: `page.tsx` (dashboard), `seasons/`,
  `teams/`, `players/` (+ `players/import/`), `schedule/`, `live/` (+ `[gameId]`
  ScorekeeperBoard), `boxscores/` (+ `[gameId]`), `announcements/`, `users/`.
- `src/app/(auth)/` — `login/` + `callback/` (Supabase email auth).
- `src/app/api/` — REST-ish route handlers: `seasons`, `teams` (+ `[id]/players`),
  `players` (+ `import`, `[id]/stats`), `games` (+ `[id]/live|events|boxscore|stats|substitute`),
  `standings` (+ `recalculate`), `stats/leaders|export|recalculate-career`,
  `announcements`, `users`, `upload`, `cron/update-game-statuses`.
- `src/components/` — by domain: `boxscore/` (BoxScoreView/Editor, viewer realtime),
  `layout/` (PublicNavbar, AdminSidebar, AdminMobileNav, LiveGameBanner, Theme*),
  `live/ScorekeeperBoard.tsx` (the 1100-line courtside UI), `players/`, `schedule/`,
  `standings/`. Note: `admin/`, `home/`, `shared/`, `teams/`, `ui/` under components
  and `src/hooks/` are all EMPTY scaffolding — there is no shadcn kit; don't hunt there.
- `src/lib/` — `auth/` (withAuth, session), `db/client.ts` + `db/queries/` +
  `db/mutations/` (stats.ts, standings.ts — the stat invariant lives here),
  `supabase/` (client/server/middleware factories), `utils/` (dates, slugify, csv,
  stats, standings) and `utils.ts` (`cn()`).
- `prisma/` — `schema.prisma`, `seed.ts`. `src/middleware.ts` guards `/admin/:path*` only.

## Data model (~15 lines)

- `Season` →many `TeamSeason` ←many `Team`. `TeamSeason` IS the standings row
  (wins/losses/pointsFor/pointsAgainst/streak, unique teamId+seasonId) — derived data.
- `Team` →many `Player` (teamId nullable) →one `PlayerCareerStats` (derived totals).
- `Game` (seasonId, homeTeamId, awayTeamId, status, gameType) holds DENORMALIZED live
  state: homeScore/awayScore, homeQuarterScores/awayQuarterScores arrays,
  currentQuarter, home/awayTeamFouls, home/awayTeamTimeouts, isLive, scorekeeperName.
- `PlayerGameStats` — per-game line (points/rebounds/assists/fouls/gamePlayed), unique
  gameId+playerId; playerId nullable for walk-on subs (substituteName/substituteJersey).
- `TeamGameStats` — unique gameId+teamId, isHome, score, won.
- `GameEvent` — append-only audit log (POINT/REBOUND/ASSIST/FOUL + dead lifecycle
  values, value, quarter, monotonic `sequence` per game, soft-delete via
  undone/undoneAt). NOT the source of derived data — standings/career stats rebuild
  from per-game aggregates, and box-score edits legitimately bypass this log.
- `User` (supabaseId, role SUPER_ADMIN|SCOREKEEPER|TEAM_MANAGER, managedTeamId),
  `Announcement`. Enums: SeasonStatus, GameStatus, GameType, EventType.

## THE central invariant

Stats live in 4 layers that must stay consistent: (1) GameEvent log → (2) per-game
aggregates (PlayerGameStats, TeamGameStats, Game score/foul fields), written in the
SAME `prisma.$transaction` by `applyGameEvent()` / `undoGameEvent()` in
`src/lib/db/mutations/stats.ts` → (3) TeamSeason standings, incremented by
`finalizeGame()` or rebuilt by `recalculateTeams()` in
`src/lib/db/mutations/standings.ts` → (4) PlayerCareerStats, rebuilt by
`recalculatePlayerCareerStats()` (raw SQL upsert). Never write one layer without the
others — a mismatch shows wrong scores/standings publicly. Details: [stats-and-standings].

## Three archetypal request flows

1. **Public page render** — server component (e.g. `src/app/(public)/standings/page.tsx`)
   calls `src/lib/db/queries/*` (or inline `prisma.*` — the home page does) directly;
   page is ISR-cached
   (`export const revalidate = 10–60`; `/schedule` is `force-dynamic`). No auth.
2. **Admin mutation** — `"use client"` admin page does `fetch("/api/...")` → route
   handler wrapped in `withAuth(handler, role)` (`src/lib/auth/withAuth.ts`: Supabase
   getUser → prisma users lookup by supabaseId → role hierarchy check) → Prisma write →
   response → sonner toast + `router.push`. Only the game boxscore and live-lifecycle
   routes call `revalidatePath()`; every other mutation relies on the public pages'
   short ISR `revalidate` windows (see [caching-and-realtime]).
3. **Live scoring event** — `ScorekeeperBoard` POSTs to `/api/games/[id]/events` →
   `applyGameEvent()` transaction updates games/player_game_stats/team_game_stats →
   Supabase Realtime `postgres_changes` fires (only tables in the `supabase_realtime`
   publication broadcast — DB-side config per DEPLOYMENT.md, not visible in the repo) →
   public `BoxScoreView` / `LiveGameBanner` refetch. Game
   lifecycle start/end/reset: POST `/api/games/[id]/live` (see [live-scoring]).

## Where does my change land?

- New public page → `src/app/(public)/<name>/page.tsx`, query in `src/lib/db/queries/`,
  nav link in `src/components/layout/PublicNavbar.tsx`. Set `revalidate`.
- New admin CRUD → page under `src/app/(admin)/admin/`, API route under `src/app/api/`
  wrapped in `withAuth`, links in `AdminSidebar.tsx` + `AdminMobileNav.tsx`.
- New stat type → EventType enum in `prisma/schema.prisma`, columns on BOTH
  PlayerGameStats and PlayerCareerStats, `applyGameEvent`/`undoGameEvent`, the
  `recalculatePlayerCareerStats` raw SQL column list, the `select` in
  `GET /api/games/[id]/stats`, ScorekeeperBoard buttons, plus the read side:
  BoxScoreView/BoxScoreTeam/Editor, `players/[slug]` career tiles, and
  `stats/leaders`/`stats/export`/PlayerRankingsTable if it should rank.
  All layers or none — full checklist in [live-scoring].
- Schema change → `prisma/schema.prisma` + `npm run db:push`; new realtime table needs
  `ALTER PUBLICATION supabase_realtime ADD TABLE <t>;` in Supabase SQL editor.
  See [database-changes].
- Date/slug/format helpers → `src/lib/utils/` (dates.ts is timezone-aware, ET).

## Skill library index

- [live-scoring] — ScorekeeperBoard, game lifecycle start/end/reset, events/undo, subs.
- [stats-and-standings] — the 4-layer invariant, recalculation endpoints, leaders.
- [database-changes] — Prisma workflow, db:push vs migrate, pooler vs direct URL.
- [auth-and-roles] — withAuth, middleware, role hierarchy, creating admins.
- [api-conventions] — route handler patterns, force-dynamic, error shapes.
- [caching-and-realtime] — revalidate/revalidatePath map, Supabase Realtime publication.
- [frontend-conventions] — layouts, client/server split, styling, forms, mobile.
- [data-import-and-seed] — CSV roster import, prisma/seed.ts, new-season bootstrap.
- [dev-workflow] — env setup, npm scripts, tsc/build verification loop.
- [deploy-and-ops] — Vercel, env vars, cron (`CRON_SECRET`), DEPLOYMENT.md pointers.
- [debugging-playbook] — symptom → cause map (stale pages, missing realtime, bad stats).
- [verify] — how to prove a change works with no test suite.

Load the specific skill BEFORE editing its domain; the Gotchas sections carry the
sharp edges this map omits.
