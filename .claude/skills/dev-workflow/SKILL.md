---
name: dev-workflow
description: Day-to-day development in this repo — env setup (.env.local vars), every npm script, seeding local data (db:push + db:seed), Prisma Studio, the verification gate (tsc --noEmit + npm run build, there are NO tests/lint/CI), and the before-commit checklist. Use when setting up the project, running the dev server, adding env vars, wondering "how do I run/test this", or preparing a commit.
---

# Dev workflow

## Prerequisites

- Node.js 20+ (per `DEPLOYMENT.md`).
- `.env.local` at repo root. Never commit it; never print its values. Vars:

| Var | Used by |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same three files |
| `DATABASE_URL` | `prisma/schema.prisma` (PgBouncer transaction pooler, port **6543**) |
| `DIRECT_URL` | `prisma/schema.prisma` `directUrl` (direct connection, port **5432** — Prisma uses it for schema ops like `db push`) |
| `CRON_SECRET` | `src/app/api/cron/update-game-statuses/route.ts` (Bearer auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | Listed in `DEPLOYMENT.md` but **not referenced anywhere in the code** (verified by grep). Set it to match the docs; nothing breaks without it today. |

Check presence without leaking secrets: `ls -la .env.local` and `grep -c "=" .env.local`.

Where values come from: Supabase dashboard → Settings → API (URL + anon key) and
Settings → Database → Connection string (the two DB URLs). `DATABASE_URL` must be the
transaction-pooler URL **with `?pgbouncer=true` appended** — without it Prisma hits
`prepared statement "s0" already exists` (42P05) through PgBouncer ([debugging-playbook]).

## Joining the existing deployment (the common case)

There is ONE shared Supabase database. If it already contains league data — it almost
certainly does — setup is only: create `.env.local`, `npm install`, `npm run dev`.
**Do NOT run `db:push` or `db:seed` against a populated DB**: push can apply
destructive schema diffs, and the seed duplicates every player and game (see below).

## npm scripts (complete list — `package.json`)

| Script | Command | Notes |
|--------|---------|-------|
| `npm run dev` | `next dev` | Next.js loads `.env.local` itself. |
| `npm run build` | `prisma generate && next build` | The generate step is required — see Gotchas. |
| `npm run start` | `next start` | Serve the production build. |
| `npm run db:push` | `dotenv -e .env.local -- prisma db push` | Sync schema to DB, no migration files. |
| `npm run db:seed` | `dotenv -e .env.local -- tsx prisma/seed.ts` | Seeds Summer 2026 season/teams/schedule; reads `2026 mens summer league final roster.csv` at repo root. Season/teams/team-seasons are upserts, but **players and games are plain creates — re-running duplicates them all**. Fresh/wiped DB only ([data-import-and-seed]). |
| `npm run db:studio` | `dotenv -e .env.local -- prisma studio` | Visual DB browser — the main data-inspection tool. |
| `npm run db:migrate` | `dotenv -e .env.local -- prisma migrate deploy` | **No `prisma/migrations/` dir exists**, so this is currently a no-op. Schema changes go through `db:push` (see [deploy-and-ops]). |

Decision rule: `db:*` scripts wrap `dotenv -e .env.local` because the Prisma CLI does **not** read `.env.local` on its own (only Next.js does). Any ad-hoc CLI/script touching the DB needs the same wrapper, e.g. `npx dotenv -e .env.local -- tsx myscript.ts`.

## Local data from zero (fresh/empty database only)

```bash
npm install
npm run db:push    # create tables in the Supabase DB from prisma/schema.prisma
npm run db:seed    # season, teams, players, schedule — fresh DB only (see above)
npm run dev        # http://localhost:3000
```

Admin login additionally needs a Supabase Auth user **plus** a matching `users` row (`supabaseId`, `role`) — use the corrected bootstrap SQL in [deploy-and-ops] (DEPLOYMENT.md's shorter INSERT fails on NOT NULL `id`/`updatedAt`).

## Verification gate — there are no tests

No test framework, no ESLint config, no CI. Nothing runs automatically. The gate is:

1. `npx tsc --noEmit` — type check (fast, catches most regressions).
2. `npm run build` — runs `prisma generate` first, then the full Next.js production build (catches server/client component violations, bad imports, route typing).
3. Manual flow-testing against `npm run dev` — drive the surface you changed. See [verify] for per-surface flow scripts.

## Before you commit

- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build` passes.
- [ ] Changed flows exercised manually on the dev server ([verify]).
- [ ] If you touched `src/lib/db/mutations/stats.ts` or `standings.ts`: traced all four derived stat layers (listed in [verify]).
- [ ] Schema change? `npm run db:push` was run and `prisma generate` re-run (a plain `npm run build` does the latter).
- [ ] No `.env.local`, secrets, or scratch files staged (`git status`).

Commit style (observed in `git log`): a single short summary line, plain English, no conventional-commit prefixes, no body — e.g. `Added undo game feature`, `fixed incorrect stat calc`, `Live scoring to fit on one page`. Match that.

## Gotchas

- **Stale Prisma client**: after editing `prisma/schema.prisma`, run `npx prisma generate` (or `npm run build`) or TypeScript will type-check against the old client — `tsc` failures that look insane usually mean this.
- **`prisma migrate dev` is a trap here**: there is no migration history; starting one against the shared Supabase DB will try to create a shadow DB and diverge from the `db:push` workflow. Stick to `db:push` unless you are deliberately introducing migrations (see [deploy-and-ops]).
- **The dev DB may be the prod DB.** There is one `.env.local`; if its `DATABASE_URL` points at the production Supabase project, `db:push` and `db:seed` hit production. Confirm which project you're pointed at before schema/seed operations — `sed -n 's/^NEXT_PUBLIC_SUPABASE_URL=//p' .env.local` prints just the (non-secret) project URL. Never grep `.env.local` for `supabase.co` broadly: `DATABASE_URL` matches too and the whole line prints, password included.
- `next dev` and Prisma CLI resolve env differently (see decision rule above) — "works in dev, `db:push` says missing DATABASE_URL" means you bypassed the dotenv wrapper.

Related skills: [verify], [deploy-and-ops], [debugging-playbook], [database-changes], [project-map]
