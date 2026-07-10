---
name: caching-and-realtime
description: The freshness model for ICM Athletics — which public pages are static/ISR vs force-dynamic, revalidatePath choreography after game mutations, the Supabase Realtime postgres_changes subscribe/cleanup pattern, and the supabase_realtime publication whitelist. Use when public pages show stale scores/standings, live updates don't reach viewers, realtime events don't fire for a table, adding revalidate/dynamic exports, writing a supabase.channel subscription, or making a page/feature update live.
---

# Caching and Realtime

Live viewers get freshness from THREE overlapping layers: short ISR (`revalidate`),
`revalidatePath()` on lifecycle mutations, and client-side Realtime + polling. Each
layer masks failures in the others — which is why bugs here are silent.

## Public page freshness map (verified exports)

| Page | Strategy |
|---|---|
| `src/app/(public)/page.tsx` | `revalidate = 15` |
| `(public)/standings/page.tsx` | `revalidate = 30` |
| `(public)/players/page.tsx`, `players/[slug]/page.tsx` | `revalidate = 60` |
| `(public)/teams/page.tsx` | `revalidate = 60` |
| `(public)/teams/[slug]/page.tsx` | `revalidate = 10` |
| `(public)/games/[gameId]/page.tsx` | `revalidate = 10` |
| `(public)/schedule/page.tsx` | `dynamic = "force-dynamic"` — reads `searchParams` (week/team filters), so ISR cannot apply (comment in file says exactly this) |
| `about`, `codeofconduct`, `rulebook` | fully static (no `revalidate`/`dynamic` exports) |

Rule for new public pages: use a short `revalidate`, never `force-dynamic`, unless the
page reads `searchParams`/cookies. Commit d595143 ("Cache Serving + middleware + box
score saving performance fixes") exists because the homepage was `force-dynamic` and
every visit hit the DB; it was switched to `revalidate = 15` and the middleware
matcher was cut to `/admin/:path*` only. Do not regress either.

## revalidatePath choreography

Only `src/app/api/games/[id]/live/route.ts` (start/end: `/schedule`, `/`, `/teams`
layout; reset also `/players` layout) and `src/app/api/games/[id]/boxscore/route.ts`
PUT (`/schedule`, `/`, `/standings`, `/teams` layout, `/games/[id]`) revalidate.
Per-event scoring (`POST /api/games/[id]/events`) revalidates NOTHING — mid-game
freshness is Realtime + polling + 10-30s ISR by design. Full map in [api-conventions].

## Realtime subscribers (complete, verified list)

Only three components call `supabase.channel(...)`:

1. **`src/components/layout/LiveGameBanner.tsx`** (in `(public)/layout.tsx`, so every
   public page): fetches `/api/games?isLive=true&limit=3`; channel
   `"live-games-banner"`, `postgres_changes` `{ event: "*", schema: "public", table: "games" }`
   (no filter) → refetch; plus a 10s `setInterval` poll only while live games exist.
2. **`src/components/boxscore/BoxScoreView.tsx`** (child of `(public)/games/[gameId]/page.tsx`):
   subscribes only when `game.isLive`; channel `` `game-boxscore-${game.id}` `` with two
   `.on()` listeners (`games` filtered `id=eq.<id>`, `player_game_stats`) → refetch
   `/api/games/[id]/boxscore`; a 10s poll runs alongside the subscription as fallback.
3. **`src/components/live/ScorekeeperBoard.tsx`** (admin live scoring): channel
   `` `scorekeeper-${game.id}` ``, `{ event: "UPDATE", table: "games", filter: `id=eq.${game.id}` }`,
   applies `payload.new` fields straight into state.

NOT realtime (despite appearances): `src/components/schedule/ScheduleRefresher.tsx`
just runs `router.refresh()` every 10s when `hasLiveGames`;
`src/components/boxscore/LiveScoreBadge.tsx` is purely presentational.

## The canonical subscribe/cleanup pattern — copy this

```tsx
"use client";
import { createClient } from "@/lib/supabase/client";

useEffect(() => {
  const supabase = createClient();
  const channel = supabase
    .channel(`some-unique-name-${id}`)            // unique per subject
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "games", filter: `id=eq.${id}` },
      () => { /* refetch from an API route; don't trust payload alone */ }
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [id]);
```

Always: browser client from `src/lib/supabase/client.ts`, unique channel name,
`removeChannel` in the effect cleanup, and pair the subscription with a polling or
refetch fallback (every existing subscriber does — see below for why).

## Publication whitelist — new tables broadcast NOTHING

Supabase Realtime only emits for tables in the `supabase_realtime` publication.
Whitelisted (DEPLOYMENT.md "Enable Supabase Realtime"): `games`, `player_game_stats`,
`team_game_stats`, `team_seasons`, `announcements`. A subscription to any other table
silently receives zero events — no error, no warning. After adding a table that needs
live updates, run in the Supabase SQL editor:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE <table_name>;
```

## Column names in filters and payloads are the REAL Postgres names

This schema maps table names (`@@map("games")`) but NOT field names, so columns are
camelCase: `"homeScore"`, `"isLive"`, `"gameId"` (verified in `prisma/schema.prisma`).
Realtime `filter:` strings and `payload.new` keys must use those exact names.

Known landmines in existing code — do NOT copy them:
- `BoxScoreView.tsx` filters `player_game_stats` on `game_id=eq.<id>`, but the column
  is `"gameId"` — that listener can't match; the component works anyway because the
  `games` listener + 10s poll trigger the same refetch.
- `ScorekeeperBoard.tsx` reads `payload.new.home_score`, `payload.new.is_live`, etc.
  (snake_case) — those keys don't exist on this schema's payloads.

This is precisely why the canonical pattern refetches from an API route instead of
consuming `payload.new` directly.

## Perf-fix history (why the current shape exists)

- `d595143` — public pages moved from `force-dynamic` to `revalidate` ISR; middleware
  matcher shrunk to `/admin/:path*`; `boxscore` PUT rewritten to batched raw-SQL
  `unnest` upsert; `src/lib/db/mutations/standings.ts` reworked. Caching/latency is a
  known footgun area; re-measure before "simplifying" any of it.
- `e5bf8f6` — ScorekeeperBoard UI restructure (one-page live scoring), not caching.

## Gotchas

- **force-dynamic vs cached GET route confusion**: pages use `revalidate`; API GET
  routes use `export const dynamic = 'force-dynamic'`. A fresh-data GET route that
  ignores the request and lacks the export can serve stale route-cache JSON on Vercel
  while working in dev ([api-conventions]).
- **Realtime silent for non-whitelisted tables**: symptom is "subscription connects
  but callback never fires". Check the publication before debugging client code.
- **revalidatePath forgetting a page**: a mutation that skips a page rendering the
  same data leaves it stale up to its `revalidate` window (e.g. `live` end doesn't
  revalidate `/standings`; the 30s ISR covers it). When adding such a page, extend the
  revalidate calls in `live` and `boxscore` routes.
- **`revalidatePath(path, "layout")`** is used for `/teams` and `/players` to catch
  every `[slug]` sub-page; plain calls only revalidate the exact path.
- Removing a component's polling fallback ("realtime makes it redundant") re-exposes
  the wrong-column-name bugs above and breaks updates when the WebSocket drops.

Related skills: [api-conventions], [auth-and-roles]
