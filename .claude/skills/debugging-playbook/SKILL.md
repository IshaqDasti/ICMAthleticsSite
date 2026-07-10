---
name: debugging-playbook
description: Symptom → cause → fix table for this project's real failure modes — wrong stats on public pages, live viewer not updating, stale/cached pages, 401/403 from API routes, Prisma "prepared statement already exists" / connection errors, games stuck IN_PROGRESS, build failures. Use when something is broken, numbers look wrong, realtime is dead, auth rejects a valid admin, or a deploy fails.
---

# Debugging playbook

Format: Symptom / Likely cause / How to confirm / Fix. Derived from the code and from actual fix commits (`15d535e` wrong stat calc, `d595143` cache+middleware+boxscore perf).

## Stats look wrong on public pages

Stats live in **four derived layers** that must agree: (1) `GameEvent` log → (2) per-game aggregates (`PlayerGameStats`, `TeamGameStats`, `Game.homeScore/awayScore/fouls`, written in one transaction by `applyGameEvent`/`undoGameEvent` in `src/lib/db/mutations/stats.ts`) → (3) `TeamSeason` standings (`finalizeGame`/`recalculateTeams` in `src/lib/db/mutations/standings.ts`) → (4) `PlayerCareerStats` (`recalculatePlayerCareerStats`, raw SQL rebuild).

- **Confirm which layer drifted**: open `npm run db:studio`; sum non-undone `game_events` values for a game and compare to `player_game_stats`/`games` scores (layer 2); compare completed games' scores to `team_seasons` (layer 3); compare `player_game_stats` where `gamePlayed=true` to `player_career_stats` (layer 4).
- **Fix per layer**:
  - Layer 3 wrong → `POST /api/standings/recalculate` with `{"seasonId"}` (SUPER_ADMIN) — full rebuild from COMPLETED games (how to fire it: [stats-and-standings]). Common cause is a double "end" — note it leaves NO event-log trace, since lifecycle actions create no GameEvents; don't waste time hunting for proof there.
  - Layer 4 wrong → `POST /api/stats/recalculate-career` (SUPER_ADMIN), or the "Recalculate Career Stats" button on `/admin`.
  - Layer 2 wrong → edit the box score in admin (`PUT /api/games/[id]/boxscore` re-runs team+career recalcs for COMPLETED games), or nuke and re-enter via `POST /api/games/<id>/live` `{"action":"reset"}` (`unfinalizeGame` — destroys that game's events/stats).
- **History**: career stats used to be *incremented* on every finalize (double-counting when a game was finalized twice). Commit `15d535e` replaced increments with full rebuilds. If you ever reintroduce incremental updates to `finalizeGame`, you reintroduce that bug.
- **Note**: public team pages compute *season* averages via `playerGameStats.groupBy` on the fly (`src/app/(public)/teams/[slug]/page.tsx`), not from `PlayerCareerStats` — career recalc won't change those numbers.

## Live viewer not updating

- **Likely causes** (in order): table missing from the `supabase_realtime` publication; `Game.isLive` is false (viewer `BoxScoreView` subscribes **only when `game.isLive`**); channel/filter mismatch after renaming columns.
- **Confirm**: in Supabase SQL editor `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';` — must include `games`, `player_game_stats`, `team_game_stats`, `team_seasons`, `announcements`. Check `games.isLive` for the game. Watch the browser WS frames / console on `/games/[gameId]`.
- **Fix**: `ALTER PUBLICATION supabase_realtime ADD TABLE <t>;` for missing tables; start the game properly (`POST /api/games/<id>/live` `{"action":"start"}` sets `isLive`).
- **Trap**: `src/components/boxscore/BoxScoreView.tsx` also polls `/api/games/[id]/boxscore` every 10s while live — so a dead realtime channel looks like "updates but slowly (10s)", not "no updates". 10-second-lag updates = realtime broken, polling carrying it.

## Page shows stale data

- **Cause**: public pages are ISR-cached with 10–60s windows (authoritative per-page table: [caching-and-realtime]); `/schedule` is `force-dynamic` (reads searchParams). Mutations must call `revalidatePath()` for every affected route (pattern: see `src/app/api/games/[id]/live/route.ts`).
- **Confirm**: data correct in Prisma Studio but wrong on the page; hard-refresh after the revalidate window shows fresh data.
- **Fix**: if a new mutation forgot invalidation, add `revalidatePath("/")`, `revalidatePath("/standings")`, `revalidatePath("/teams", "layout")` etc. to it. If data was changed by raw SQL outside the app, just wait out the window or redeploy. New always-fresh API routes need `export const dynamic = 'force-dynamic'`.

## 401 / 403 from API routes

Two-identity auth model (`src/lib/auth/withAuth.ts`): Supabase Auth user (cookie) **plus** a `users` row matched by `supabaseId`, with role hierarchy `TEAM_MANAGER(1) < SCOREKEEPER(2) < SUPER_ADMIN(3)`; `withAuth` defaults to SCOREKEEPER.

- **401 "Unauthorized"** → no Supabase session (not logged in / cookie not sent — curl without cookies always gets this).
- **401 "User not found"** → Supabase user exists but no `users` row. Fix with the INSERT in `DEPLOYMENT.md` "Set Up Auth" / [deploy-and-ops].
- **403 "Forbidden"** → `users.role` below the handler's `requiredRole`. Confirm in Prisma Studio; fix by updating the role (SUPER_ADMIN-only routes: user management, recalcs).
- **Note**: `src/middleware.ts` matcher covers only `/admin/:path*` — API routes are intentionally excluded (perf, commit `d595143`); do not "fix" a 401 by adding API paths back to the matcher.

## Prisma connection errors

- **`prepared statement "s0" already exists` (42P05) or random query failures** → Prisma talking to PgBouncer transaction pooler without pgbouncer mode. `DATABASE_URL` must be the port-6543 pooler URL **with `?pgbouncer=true`**; `DIRECT_URL` (5432) handles schema ops (`prisma/schema.prisma` declares both).
- **`Too many connections`** in dev → dev-server hot reload spawning clients; `src/lib/db/client.ts` already caches a global singleton — make sure any new code imports `prisma` from there instead of instantiating `new PrismaClient()`.
- **`db:push`/Studio can't connect but the app can** → `DIRECT_URL` wrong/blocked; schema ops don't go through the pooler.

## Game stuck IN_PROGRESS

- **Cause**: nobody pressed "End Game" and the cron only runs daily (`vercel.json` `0 0 * * *`; docs assume 5-min Pro cadence — see [deploy-and-ops]). Auto-complete also requires `isLive=false` and 3h past `scheduledAt` (`src/app/api/cron/update-game-statuses/route.ts`).
- **Fix**: trigger manually: `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>.vercel.app/api/cron/update-game-statuses`. If `isLive` is stuck true (scorekeeper abandoned mid-game), end it properly via the scorekeeper UI or `POST /api/games/<id>/live` `{"action":"end"}` so `finalizeGame` runs — **do not** just flip status in SQL, that skips standings/career updates (layer drift above).

## Build failures

- **Type errors referencing missing Prisma model fields** → stale generated client. `npm run build` runs `prisma generate` first; a bare `next build` or `tsc` after a schema edit does not. Fix: `npx prisma generate`.
- **Prerender/DB errors during build** → the ISR public pages (`/`, `/standings`, `/players`, `/teams`) run their DB queries at build time, so `next build` needs a working `DATABASE_URL` (from `.env.local` locally, dashboard env vars on Vercel). `NEXT_PUBLIC_*` values are inlined at build — missing ones produce a deploy that can't reach Supabase.

Related skills: [deploy-and-ops], [verify], [dev-workflow], [stats-and-standings], [caching-and-realtime], [auth-and-roles]
