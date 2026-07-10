# ICM Athletics — Deployment Guide

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) account (free tier works)
- A [Vercel](https://vercel.com) account (free tier works)

---

## Step 1: Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
3. Go to **Settings → Database → Connection string**:
   - Copy **Transaction pooler** (port 6543) → `DATABASE_URL`, and append `?pgbouncer=true` (Prisma requires it through PgBouncer, otherwise "prepared statement already exists" errors)
   - Copy **Direct connection** (port 5432) → `DIRECT_URL`

### Enable Supabase Realtime

Run this in **Supabase SQL Editor**:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE player_game_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE team_game_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE team_seasons;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
```

### Create Storage Bucket

In Supabase → **Storage**, create a bucket named `public` with "Public bucket" enabled.
This is used for team logos and player photos.

### Set Up Auth

In Supabase → **Authentication → Providers**, enable **Email** provider.

To create the first Super Admin:
1. In Supabase Auth → create a user manually (or sign up via `/login`)
2. In Supabase SQL Editor:

```sql
INSERT INTO users ("id", "supabaseId", email, name, role, "updatedAt")
VALUES (gen_random_uuid()::text, '<supabase-user-id>', 'admin@icmathletics.com',
        'Admin', 'SUPER_ADMIN', now());
```

Note: `"id"` and `"updatedAt"` must be supplied explicitly — their Prisma defaults
(`cuid()`, `@updatedAt`) are client-side only and do not exist at the database level.

---

## Step 2: Local Development

```bash
# Install dependencies
npm install

# Fill in .env.local with your Supabase credentials (see .env.local template)

# Push schema to database
npm run db:push

# Seed the database (imports Summer 2026 roster + schedule)
npm run db:seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the site!

---

## Step 3: Deploy to Vercel

1. Push code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → Import project from GitHub
3. Add all environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL` (transaction pooler, port 6543)
   - `DIRECT_URL` (direct connection, port 5432)
   - `CRON_SECRET` — a random secret string used to authenticate the cron job (generate one with `openssl rand -hex 32`)
4. Set build command to: `prisma generate && next build`
5. Deploy!

After deploy, run seed from local:
```bash
npm run db:seed
```

---

## Step 4: Add Supabase Auth Redirect URL

In Supabase → **Authentication → URL Configuration**:
- Add Site URL: `https://your-app.vercel.app`
- Add Redirect URL: `https://your-app.vercel.app/callback`

(The callback handler lives at `src/app/(auth)/callback/route.ts`; route groups add
no URL segment, so the real path is `/callback`, not `/auth/callback`.)

---

## Automatic Game Status Updates

Game statuses update automatically via a Vercel Cron Job (`vercel.json`):

- **SCHEDULED → IN_PROGRESS**: triggered when the scheduled game time arrives
- **IN_PROGRESS → COMPLETED**: triggered 3 hours after the scheduled start if no scorekeeper is actively live-scoring the game

The cron runs every 5 minutes and requires **Vercel Pro** (Hobby plan only supports daily crons). To manually trigger it:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://your-app.vercel.app/api/cron/update-game-statuses
```

---

## Database Management

```bash
npm run db:studio    # Open Prisma Studio (visual DB browser)
npm run db:push      # Push schema changes without migration
npm run db:migrate   # Run pending migrations (production)
```

---

## Key URLs

| URL | Description |
|-----|-------------|
| `/` | Public home page |
| `/standings` | League standings |
| `/schedule` | Game schedule |
| `/players` | Player rankings |
| `/login` | Admin login |
| `/admin` | Admin dashboard |
| `/admin/live` | Live scorekeeper selection |
| `/admin/live/[gameId]` | Live game scorekeeper |
| `/admin/players/import` | CSV player import |

---

## Realtime Architecture

The live scorekeeper writes stats via `POST /api/games/[id]/events`, which updates
the `games` table in PostgreSQL. Supabase Realtime broadcasts these changes to all
connected clients via WebSocket. Public viewers on `/games/[gameId]` see score updates
in under 1 second without refreshing.

---

## Scaling Notes

- **Multiple leagues**: Add a `League` model above `Season` — all queries already
  filter by `seasonId` so adding a `leagueId` filter is additive.
- **More stats** (steals, blocks, fouls): Add columns to `PlayerGameStats` + new 
  `EventType` enum values. No migration needed for existing data.
- **Connection pooling**: The `DATABASE_URL` uses Supabase's PgBouncer transaction
  pooler, which handles thousands of concurrent connections safely for serverless.
