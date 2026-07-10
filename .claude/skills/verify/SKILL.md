---
name: verify
description: How to prove a change actually works in THIS repo (used by the /verify convention) — static gate (tsc, build), runtime gate (dev server + .env.local), per-surface flow scripts (public pages via curl, admin/live-scoring via authenticated API), DB checks via Prisma Studio or a tsx scratch script, and the mandatory four-derived-layer trace for any stats/finalize change. Use before committing, when asked to verify/test a change, or to decide what "done" means here.
---

# Verify a change

There are no automated tests, lint, or CI in this repo. "Verified" means: static gate passed + the affected flow was actually exercised and observed. Pick the sections that match what changed.

## 1. Static gate (always)

```bash
npx tsc --noEmit     # type check
npm run build        # prisma generate + full Next.js production build
```

Both must pass. If the schema changed, `npm run db:push` first, and note the build itself prerenders the ISR public pages, so it needs a working `DATABASE_URL`.

## 2. Runtime gate

`npm run dev` requires a populated `.env.local`. Check for it without printing secrets:

```bash
ls -la .env.local
```

**If `.env.local` is missing or empty, runtime verification is impossible — say so explicitly, deliver static-gate results only, and list which flows remain unverified.** Do not fake it with placeholder env values; the app needs a real Supabase project.

## 3. Flow scripts per surface

### Public pages (no auth)

```bash
npm run dev   # then, in another shell:
for p in / /standings /schedule /players /teams; do
  curl -s -o /dev/null -w "%{http_code} $p\n" "http://localhost:3000$p"
done
```

Expect 200s. For content-level checks, curl the page and grep for the data you changed, or open it in a browser. Game detail pages are `/games/<gameId>` (get an id from Prisma Studio or the schedule page HTML).

### Admin flows (require login)

Admin pages (`/admin/...`) and protected API routes need a Supabase session cookie; `withAuth` in `src/lib/auth/withAuth.ts` returns 401 to any curl without one. Browser-based verification requires credentials — **ask the user for a test login** (or for them to click through the flow) rather than guessing. A 401 from an unauthenticated curl only proves auth is on, not that your change works.

### Live-scoring changes

Options, in order of preference:
1. Authenticated API session: with a logged-in browser, use the scorekeeper UI at `/admin/live/<gameId>` and watch `/games/<gameId>` in a second (incognito) window update within ~1s.
2. If no credentials: reason through `applyGameEvent()` / `undoGameEvent()` in `src/lib/db/mutations/stats.ts` — every stat write happens inside one `prisma.$transaction([...])`; confirm your change keeps event log, player stats, team stats, and the `games` row updates in that same transaction, and state in your report that runtime verification was skipped.

### DB-layer changes

- Inspect data: `npm run db:studio`.
- Scripted checks: write a scratch script in a temp dir (not the repo) and run it with the repo's own devDependencies (`tsx` and `dotenv-cli` are both in `package.json`):
  ```bash
  npx dotenv -e .env.local -- tsx /path/to/scratch-check.ts
  ```
  Import the repo's shared client by absolute path (`import { prisma } from "/…/ICMAthleticsSite/src/lib/db/client"`) — module resolution walks up from the *imported file*, so this finds `@prisma/client`; instantiating `PrismaClient` directly only resolves if the script itself lives inside the repo tree. Print before/after values for the rows your change touches.

## 4. Stats invariant — the mandatory trace

Any change touching `applyGameEvent`, `undoGameEvent` (`src/lib/db/mutations/stats.ts`), or `finalizeGame`, `unfinalizeGame`, `recalculateTeams`, `recalculatePlayerCareerStats` (`src/lib/db/mutations/standings.ts`) **must be traced through all four derived-data layers before it is "done"**:

1. **GameEvent log** — append-only rows with monotonic `sequence`, soft-deleted via `undone`/`undoneAt`.
2. **Per-game aggregates** — `PlayerGameStats`, `TeamGameStats`, and `Game.homeScore/awayScore/homeTeamFouls/awayTeamFouls`, written in the SAME transaction as the event.
3. **TeamSeason standings** — incremented by `finalizeGame`, rebuilt by `recalculateTeams`.
4. **PlayerCareerStats** — rebuilt by `recalculatePlayerCareerStats` (raw SQL upsert over `player_game_stats` where `gamePlayed = true`).

Trace = for each layer, answer "does my change keep this layer consistent with layer 1 in ALL of: normal event, undo, finalize, box-score edit after finalize, unfinalize/reset?" A concrete end-to-end check: score a test game (start → a few events → undo one → end), then compare layers in Prisma Studio; then reset it (`POST /api/games/<id>/live` `{"action":"reset"}`) and confirm standings/career stats return to their prior values.

## 5. Report format

State explicitly: which gates ran, what was observed (status codes, values before/after), and which flows were NOT verified and why (no credentials, no `.env.local`, etc.). An unverified flow is a caveat, never a silent omission.

## Gotchas

- A green `tsc` + build proves nothing about stat correctness — the historical bugs here (commit `15d535e`, double-counted career stats) type-checked fine. Only the layer trace catches that class.
- Public pages are ISR-cached (10–60s windows) — when checking that a mutation shows up, either wait out the window or confirm the mutation calls `revalidatePath` for that route ([debugging-playbook] "Page shows stale data").
- The live viewer polls every 10s as a realtime fallback — seeing an update is not proof realtime works; verify update latency is ~1s, not ~10s.

Related skills: [dev-workflow], [debugging-playbook], [deploy-and-ops], [stats-and-standings], [live-scoring]
