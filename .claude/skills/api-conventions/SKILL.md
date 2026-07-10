---
name: api-conventions
description: Conventions for adding/modifying API routes in src/app/api — withAuth wrapper + role choice, export const dynamic = 'force-dynamic' rule, manual body validation (no zod), { error } response shapes, revalidatePath map after game mutations, and the CRON_SECRET-guarded cron route with its status-transition timing. Use when creating an API route, changing games/players/teams/seasons/standings/announcements/users endpoints, debugging stale GET responses, or touching /api/cron/update-game-statuses.
---

# API Conventions

## Route inventory pattern

Under `src/app/api/`: resource CRUD as `<resource>/route.ts` (GET list, POST create)
+ `<resource>/[id]/route.ts` (GET, PUT, DELETE), plus **action routes** as nested
paths: `games/[id]/live` (start|end|reset), `games/[id]/events` (+ `[eventId]` DELETE
= undo), `games/[id]/boxscore`, `games/[id]/substitute`, `games/[id]/stats`,
`standings/recalculate`, `stats/recalculate-career`, `stats/export`, `stats/leaders`,
`players/import`, `upload`, `cron/update-game-statuses`. New endpoints follow this
split: CRUD on the resource path, verbs as sub-paths.

## Auth wrapper

Every protected handler is wrapped (there is NO middleware on `/api` — see
[auth-and-roles]):

```ts
export const POST = withAuth(async (req, user, { params }) => { ... }, "SUPER_ADMIN");
```

`withAuth(handler, requiredRole = "SCOREKEEPER")` in `src/lib/auth/withAuth.ts`.
Handler receives the prisma `User` as the 2nd arg (`user.id` for `createdBy`) and
`{ params }` as the 3rd. Role choice, as practiced across the codebase:

- **SUPER_ADMIN** — league structure & destructive/global ops: seasons, teams POST/DELETE,
  games POST/DELETE, announcements, users, `players/import`, `standings/recalculate`,
  `stats/recalculate-career`, players DELETE.
- **SCOREKEEPER** (default) — live game data: `games/[id]` PUT, `live`, `events`,
  `boxscore` PUT, `substitute`, `stats/export`.
- **TEAM_MANAGER** — roster upkeep: players POST/PUT, teams PUT, `upload`.

**Public (no wrapper)** — every plain `export async function GET` outside `cron/` is
unauthenticated (the cron GET checks `Bearer $CRON_SECRET` itself):
`games`, `games/[id]`, `games/[id]/boxscore`, `games/[id]/events`, `games/[id]/stats`,
`standings`, `stats/leaders`, `players`, `players/[id]`, `players/[id]/stats`, `teams`,
`teams/[id]`, `teams/[id]/players`, `seasons`, `seasons/[id]`, `announcements`. Public viewers poll
several of these during live games — keep them fast and unauthenticated.

## `export const dynamic = 'force-dynamic'`

Convention: the first line of nearly every route file is
`export const dynamic = 'force-dynamic';`. Why: in Next 14 a GET route handler that
never reads the incoming request can be captured by the route cache and serve stale
data. Rule: **any route file with a GET that must be fresh declares it**, even if a
mutating verb in the same file would technically opt out.

Files that (verified) do NOT declare it and why it still works:
- `cron/update-game-statuses` — reads the `authorization` header → dynamic anyway.
- `standings`, `stats/leaders`, `players/[id]/stats` — read `req.url` searchParams → dynamic anyway.
- `teams/[id]/players` — reads nothing from the request; an outlier, not a pattern to copy.

When adding a route: just declare it. It costs nothing on mutation-only routes.

## Request parsing & validation

**There is no zod anywhere in `src/`** (routes or forms). The practiced style:
`const body = await req.json()` + destructure, optional TS interfaces or `as` casts
for shape (see `games/[id]/boxscore/route.ts`), and explicit guard clauses returning
400 for the few fields that matter, e.g. `games/[id]/substitute/route.ts`:
`if (!name?.trim() || !teamId) return NextResponse.json({ error: "Name and teamId are required" }, { status: 400 });`
and `users/[id]/route.ts` validating `role` against a literal array. Optional fields
use conditional spreads (`...(body.location !== undefined && { location: body.location })`)
so PUTs are partial updates. Match this style; do not introduce a validation library
for one route.

## Response shapes

- Errors: always `NextResponse.json({ error: "<message>" }, { status })` —
  400 invalid input, 401/403 from withAuth, 404 `{ error: "Not found" }`, 500 internal.
- Success: resource-keyed objects — `{ game }`, `{ games }`, `{ users }`, `{ players }`,
  `{ announcement }`; status **201 on create**; bare `{ success: true }` or `{ ok: true }`
  for action routes with nothing to return.

## revalidatePath after mutations (full verified map)

Only two routes revalidate; per-event scoring writes rely on Realtime + short ISR
instead (see [caching-and-realtime]):

| Mutation | Paths revalidated |
|---|---|
| `POST /api/games/[id]/live` action `start` | `/schedule`, `/`, `/teams` (layout) |
| `POST /api/games/[id]/live` action `end` | `/schedule`, `/`, `/teams` (layout) |
| `POST /api/games/[id]/live` action `reset` | `/schedule`, `/`, `/teams` (layout), `/players` (layout) |
| `PUT /api/games/[id]/boxscore` | `/schedule`, `/`, `/standings`, `/teams` (layout), `/games/[id]` |
| `POST/DELETE /api/games/[id]/events` | none |
| all other CRUD (teams, players, seasons, games PUT, announcements) | none |

Note `live` end/reset do NOT revalidate `/standings` — that page's `revalidate = 30`
picks up the change. If you add a page that renders game/standings data, add it to
this map in BOTH `src/app/api/games/[id]/live/route.ts` and
`src/app/api/games/[id]/boxscore/route.ts`.

## Cron route

`src/app/api/cron/update-game-statuses/route.ts` — GET, auth is an exact string
compare: `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` → 401. Transitions:

1. **SCHEDULED → IN_PROGRESS**: `updateMany` where `status: "SCHEDULED"` and
   `scheduledAt <= now`.
2. **IN_PROGRESS → COMPLETED**: where `status: "IN_PROGRESS"`, `isLive: false`, and
   `scheduledAt <= now - 3h` (`new Date(now.getTime() - 3 * 60 * 60 * 1000)`) —
   i.e. 3 hours past *scheduled start* with no active scorekeeper. It does NOT call
   `finalizeGame`, so standings are untouched; it only flips status.

Returns `{ ok, started, completed, checkedAt }` counts.

**Schedule discrepancy**: `vercel.json` runs it `0 0 * * *` (daily at midnight —
Vercel Hobby limit). DEPLOYMENT.md's "runs every 5 minutes" describes the intended
Pro-plan cadence, not reality. On the daily schedule, games can sit in SCHEDULED all
day unless a scorekeeper starts them or you trigger manually:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" https://<app>.vercel.app/api/cron/update-game-statuses
```

## Gotchas

- Forgetting `withAuth` = the route is fully public (no middleware backstop on `/api`).
- Forgetting `force-dynamic` on a fresh-data GET that ignores the request = stale
  cached JSON in production only (dev always renders dynamically), classically
  "works locally, stale on Vercel".
- `withAuth`'s `context.params` typing is `Record<string, string>` — dynamic segment
  names must match what the handler destructures (`params.id`, `params.eventId`).
- Don't add heavier auth (middleware matcher entries) to public polled endpoints;
  commit d595143 removed exactly that for latency.

Related skills: [auth-and-roles], [caching-and-realtime]
