---
name: data-import-and-seed
description: Getting roster and schedule data into the database — CSV player import (admin UI + /api/players/import, exact expected columns, dedup behavior), prisma/seed.ts and npm run db:seed (NOT idempotent for players/games), and new-season bootstrapping via /admin/seasons/new + /api/seasons. Use when importing players, re-seeding, wiring a new season, debugging duplicate players/games after import, or changing CSV column handling.
---

# Data Import and Seed

## CSV player import (admin flow)

- UI: `src/app/(admin)/admin/players/import/page.tsx` (client page). Fetches
  `/api/seasons`, preselects the ACTIVE season, uploads `FormData` with `file` (CSV)
  and optional `seasonId` to `POST /api/players/import`. Shows
  `{ created, skipped, errors }` from the response.
- API: `src/app/api/players/import/route.ts`, `force-dynamic`, wrapped in
  `withAuth(..., "SUPER_ADMIN")`. Parses the file with papaparse directly
  (`header: true`, `skipEmptyLines: true`, headers trimmed). Note it does NOT go
  through `parseCSV` in `src/lib/utils/csv.ts` — that helper duplicates the same
  options; `csv.ts` is only consumed by `src/app/api/stats/export/route.ts`
  (`generateCSVString`).

### Expected CSV columns (exact header strings, per the route)

| Field | Primary header | Fallback header |
|---|---|---|
| firstName (required) | `Attendee First Name` | `First Name` |
| lastName (required) | `Attendee Last Name` | `Last Name` |
| team name | `Team Name Spring 26` | `Team` |
| displayName | `Name on Jersey` | falls back to firstName |
| jerseyNumber | `Jersey Number` | — |
| email | `Attendee Email` | — |
| instagramHandle | `Instagram Handle` (first `@` stripped) | — |

The route does NOT read a DOB column (only `prisma/seed.ts` reads `DOB`). Empty
strings become `null` for optional fields.

### Matching / dedup / team assignment behavior

- Rows missing firstName or lastName are counted as `skipped`; per-row exceptions land
  in `errors` as strings and do not abort the import.
- Team assignment: `prisma.team.findFirst` on `name` with `mode: "insensitive"`. The
  team must ALREADY exist — a non-matching team name silently yields an unassigned
  player (`teamId: null`), not an error. Check the team name spelling first.
- If the team matched AND a `seasonId` was sent, the route upserts `TeamSeason` for
  that pair — this is what puts the team into that season's standings.
- THERE IS NO DEDUP against existing players. Every valid row calls
  `prisma.player.create`. Slug collisions are resolved by suffixing (`john-smith`,
  `john-smith-1`, …) via a findUnique loop on `slugify(firstName-lastName)` from
  `src/lib/utils/slugify.ts`. Re-uploading the same CSV therefore creates a full
  duplicate roster. Clean up duplicates by deleting players in `/admin/players` or
  `npm run db:studio`.

## Seed script (`prisma/seed.ts`)

Run: `npm run db:seed` — defined as `dotenv -e .env.local -- tsx prisma/seed.ts`
(env comes from `.env.local`, not `.env`; the same command is registered under
`package.json` → `"prisma": { "seed": ... }`). It creates, in order:

1. Season `Summer 2026` (slug `summer-2026`, status ACTIVE) — `upsert`.
2. 10 hardcoded teams (Al-Rijaal, Five Pillars, Gathering of Old Men, Green Bean,
   ICM United, Lowkey Hoopers, Redeem Team, The Halal Buoys, The Wire, Wednesday
   Hoops) — `upsert` by slug — plus a `TeamSeason` upsert for each.
3. Players from the roster CSV at REPO ROOT:
   `2026 mens summer league final roster.csv` (resolved as
   `path.join(__dirname, "../...")`). Verified: the file exists at repo root. Reads only
   the PRIMARY headers (`Attendee First Name`, `Attendee Last Name`,
   `Team Name Spring 26` — none of the import route's fallbacks) plus `DOB` →
   `dateOfBirth`; a fallback-schema CSV imports fine via admin but seeds 0 players,
   every row silently skipped. If the CSV is missing
   it warns and skips players (rest of seed still runs). Players use
   `prisma.player.create` with the same slug-suffix loop.
4. Games from a hardcoded `SCHEDULE` array (weeks 1–12 regular season, 2026-05-18 →
   2026-08-10, plus TBD All-Star/playoff slots which are SKIPPED — playoff games get
   created later through the admin schedule UI once seeds are known). `scheduledAt` is
   built as `` `${date}T${time}:00.000-04:00` `` (time is `padStart(5, "0")`-ed, so
   single-digit hours in the SCHEDULE array are fine) — a hardcoded US Eastern (EDT) offset,
   consistent with the ET formatters in `src/lib/utils/dates.ts`. All games use
   `prisma.game.create` with `location: "ICM Athletics Court"`.

### Idempotency — read before re-running

`db:seed` is only PARTIALLY idempotent: season, teams, and team-season links are
upserts (safe), but players and games are plain `create` calls. Re-running against an
already-seeded database duplicates every player (with `-1` slug suffixes) and every
game. Only run `npm run db:seed` on a fresh/empty database, after wiping via
`npm run db:studio`, or after editing the script to remove sections that already ran.

## New-season bootstrapping

1. Create the season: `/admin/seasons/new`
   (`src/app/(admin)/admin/seasons/new/page.tsx`) posts `{ name, startDate, endDate,
   status: "UPCOMING" }` to `POST /api/seasons` (`src/app/api/seasons/route.ts`,
   SUPER_ADMIN). The slug is `slugify(name)` server-side; `name` and `slug` are unique
   in `prisma/schema.prisma`, so a duplicate name makes the route throw (500).
2. Activate it: `PUT /api/seasons/[id]` with `{ status: "ACTIVE" }` — this route first
   demotes ALL currently-ACTIVE seasons to COMPLETED, keeping the single-active-season
   invariant that `getActiveSeason()` (`src/lib/db/queries/seasons.ts`, used by the
   home/standings/schedule/rankings/teams pages) depends on.
3. Attach teams via `TeamSeason` rows — a team with no TeamSeason for the active season
   is invisible in standings. Three creation paths: `POST /api/teams` with a `seasonId`
   in the body (note: the `/admin/teams/new` form does NOT send one), the CSV import
   with a season selected (upserts TeamSeason for each matched team), or the seed.
4. Import the roster CSV with the new season selected, then build the schedule at
   `/admin/schedule/new`.

## Gotchas

- Import and seed share header names but are separate code paths — changing CSV
  columns means editing BOTH `src/app/api/players/import/route.ts` and
  `prisma/seed.ts` (which also has its own private `slugify` copy).
- The slug-suffix loop means duplicate imports are silent: `created` count looks
  healthy while the roster doubles. Verify player count after import.
- Team names in the CSV must match `teams.name` exactly (case-insensitive but
  otherwise literal) — e.g. `Halal Buoys` will NOT match `The Halal Buoys`.
- `db:seed` reads `.env.local`. With no `.env.local`, dotenv finds nothing and Prisma
  fails on a missing `DATABASE_URL` — see [dev-workflow] for env setup.
- The import route requires SUPER_ADMIN; a SCOREKEEPER session gets 403 from the API
  even though the admin page itself renders.

Related skills: [project-map], [database-changes], [dev-workflow], [auth-and-roles],
[stats-and-standings].
