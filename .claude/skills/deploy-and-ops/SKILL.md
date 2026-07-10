---
name: deploy-and-ops
description: Production operations — Vercel deploy and env vars, Supabase one-time setup (realtime publication SQL, storage bucket, auth redirect, first SUPER_ADMIN), the game-status cron and its daily-vs-5-minute discrepancy, making schema changes against prod (db:push, no migrations exist), and repair/rollback tools (recalculate endpoints, unfinalize game). Use when deploying, changing prod schema, fixing prod data, or when the cron/realtime/storage setup is in question.
---

# Deploy & ops

`DEPLOYMENT.md` at repo root is the canonical ops doc. This skill is an index over it plus what it omits. When they conflict, this skill records the verified state of the code.

## Vercel deploy (DEPLOYMENT.md Step 3)

- Import the GitHub repo into Vercel. Build command: `prisma generate && next build` (identical to `npm run build`).
- Env vars to set in the Vercel dashboard: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (listed in docs; currently unused by code — set it anyway), `DATABASE_URL` (pooler, port 6543), `DIRECT_URL` (direct, port 5432), `CRON_SECRET` (`openssl rand -hex 32`).
- After first deploy: seed from local with `npm run db:seed` (it runs against whatever `DATABASE_URL` is in your local `.env.local` — point it at prod deliberately, and ONCE only: players and games are plain creates, so a second run duplicates the roster and schedule — see [data-import-and-seed]).

## Supabase one-time setup (DEPLOYMENT.md Step 1 & 4)

Do all four or specific features silently fail:

1. **Realtime publication** — run in Supabase SQL Editor. Only tables in the publication broadcast changes; live viewers depend on it:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE games;
   ALTER PUBLICATION supabase_realtime ADD TABLE player_game_stats;
   ALTER PUBLICATION supabase_realtime ADD TABLE team_game_stats;
   ALTER PUBLICATION supabase_realtime ADD TABLE team_seasons;
   ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
   ```
   Any NEW table that needs live updates requires its own `ALTER PUBLICATION supabase_realtime ADD TABLE <t>;` — this is a recurring omission.
2. **Storage** — bucket named `public`, with "Public bucket" enabled (team logos / player photos; uploads flow through `src/app/api/upload/route.ts` via signed upload URLs).
3. **Auth** — enable Email provider; add Site URL `https://<app>.vercel.app` and Redirect URL `https://<app>.vercel.app/callback` (the handler is `src/app/(auth)/callback/route.ts`; route groups add no URL segment, so the path is `/callback`, NOT `/auth/callback` — see [auth-and-roles]).
4. **First SUPER_ADMIN** — create the auth user, then insert the app-side row (two-identity model; without the `users` row every protected API call returns 401):
   ```sql
   INSERT INTO users ("id", "supabaseId", email, name, role, "updatedAt")
   VALUES (gen_random_uuid()::text, '<supabase-user-id>', 'admin@icmathletics.com',
           'Admin', 'SUPER_ADMIN', now());
   ```
   `"id"` and `"updatedAt"` are mandatory here: `@default(cuid())`/`@updatedAt` are Prisma-client features with no DB-level default, so DEPLOYMENT.md's shorter INSERT fails with a NOT NULL violation.

## Cron: game status updates

- Route: `src/app/api/cron/update-game-statuses/route.ts` (GET, requires header `Authorization: Bearer $CRON_SECRET`).
- What it does, idempotently, for whatever cadence runs it: `SCHEDULED → IN_PROGRESS` once `scheduledAt <= now`; `IN_PROGRESS → COMPLETED` when `scheduledAt` is 3+ hours past **and** `isLive` is false (i.e. no scorekeeper active).
- **Discrepancy**: `vercel.json` schedules it `0 0 * * *` (daily at midnight — Hobby-plan limit). `DEPLOYMENT.md` describes a 5-minute cadence, which requires Vercel Pro. On the daily schedule, status flips can lag up to ~24h; the code is cadence-agnostic so upgrading the plan and changing `vercel.json` to `*/5 * * * *` is the whole fix.
- Manual trigger (also the interim workaround for the daily lag):
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://<app>.vercel.app/api/cron/update-game-statuses
  ```

## Production schema changes

**There is no `prisma/migrations/` directory** (verified: `prisma/` contains only `schema.prisma` and `seed.ts`). Consequences:

- `npm run db:migrate` (`prisma migrate deploy`) has nothing to deploy — it is a no-op despite `DEPLOYMENT.md` calling it the production path.
- The de-facto prod path is `npm run db:push` with `.env.local` pointing at the prod database. It diffs live schema vs `prisma/schema.prisma` and applies changes directly through `DIRECT_URL`.
- **Risk**: `db push` has no history, no rollback, and will prompt (or with `--accept-data-loss`, silently proceed) on destructive changes like dropped/retyped columns. Before pushing to prod: read the printed diff, never pass `--accept-data-loss` casually, and take a Supabase backup/snapshot for anything destructive. Prefer additive changes (new nullable columns, new tables) — `DEPLOYMENT.md` Scaling Notes assumes this style.
- New table that must broadcast live? Add it to the realtime publication (SQL above) — `db push` will not do that for you.

## Repair & rollback toolbox

All are `withAuth`-protected API routes (see `src/lib/auth/withAuth.ts`); see [debugging-playbook] for when to use which. Only career recalc has an admin button — fire the others from a logged-in `/admin` tab's devtools console with `await fetch(route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({...}) })` (exact snippet in [stats-and-standings]).

| Tool | Route | Role | Effect |
|------|-------|------|--------|
| Rebuild standings | `POST /api/standings/recalculate` body `{"seasonId": "..."}` | SUPER_ADMIN | Recomputes every TeamSeason (wins/losses/points/streak) from COMPLETED games. |
| Rebuild career stats | `POST /api/stats/recalculate-career` | SUPER_ADMIN | Rebuilds PlayerCareerStats for every player with `player_game_stats` rows (a stale career row for a player whose game rows were all deleted is NOT reset). Also exposed as a button on `/admin` (`src/app/(admin)/admin/RecalculateCareerStatsButton.tsx`). |
| Unfinalize / reset game | `POST /api/games/<id>/live` body `{"action":"reset"}` | SCOREKEEPER | `unfinalizeGame()` in `src/lib/db/mutations/standings.ts`: deletes the game's events + game stats, zeroes the game back to SCHEDULED, then full `recalculateTeams` + career recalc. **Destructive to that game's scoring data** — the game must be re-scored or its box score re-entered. |
| Fix one game's box score | `PUT /api/games/<id>/boxscore` (admin box-score editor UI) | SCOREKEEPER | Overwrites per-game stats; on a COMPLETED game it re-runs team + career recalcs itself. |

## Gotchas

- `revalidatePath()` calls in mutation routes only invalidate the deployment that serves them — after manual SQL edits in Supabase, public pages can stay stale until their ISR window (10–60s) expires. Nothing to do but wait or redeploy.
- The cron route returns `{ started, completed }` counts — a `{ ok: true, started: 0, completed: 0 }` response means auth worked and there was simply nothing to do.
- Changing `CRON_SECRET` in Vercel requires redeploy for the route to see the new value.

Related skills: [debugging-playbook], [dev-workflow], [verify]
