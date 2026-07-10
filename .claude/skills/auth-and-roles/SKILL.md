---
name: auth-and-roles
description: Supabase auth + app-level roles for ICM Athletics — the two-identity model (Supabase user ↔ prisma users row via supabaseId), withAuth role hierarchy, middleware scope, login/callback flow, protecting new pages and API routes, user management, bootstrapping the first SUPER_ADMIN. Use when touching login, /admin access, 401 "Unauthorized"/"User not found", 403 Forbidden, withAuth, getServerSession, requireRole, Supabase client factories, or /api/users.
---

# Auth and Roles

## Two-identity model (the #1 thing to understand)

Every operator has TWO records that must both exist:

1. A **Supabase Auth user** (email/password, lives in Supabase's `auth` schema) — proves *who you are*.
2. A **prisma `users` row** (`prisma/schema.prisma`, model `User`, table `users`) — carries the app **role**. Linked by `users.supabaseId` = Supabase auth user id.

A Supabase auth user with NO `users` row can log in but is rejected by every protected
API with `401 { "error": "User not found" }` (`src/lib/auth/withAuth.ts`), and
`getServerSession()` returns null so `src/app/(admin)/layout.tsx` redirects them back
to `/login`. If someone "can sign in but nothing works", the missing `users` row is
almost always the cause. Fix: insert a row (see Bootstrapping below).

## Role hierarchy

Defined identically in `src/lib/auth/withAuth.ts` and `src/lib/auth/session.ts`:

```
TEAM_MANAGER = 1  <  SCOREKEEPER = 2  <  SUPER_ADMIN = 3
```

Checks are `>=` (a SUPER_ADMIN passes any check). `withAuth(handler, requiredRole)`
defaults `requiredRole` to `"SCOREKEEPER"` — passing no role does NOT mean public.

## Middleware scope — /admin pages ONLY

`src/middleware.ts` matcher is `["/admin/:path*"]`. It runs `updateSession()`
(`src/lib/supabase/middleware.ts`, refreshes the Supabase session cookies) and
redirects unauthenticated users to `/login`. The in-code rationale for excluding APIs:

> API routes are intentionally excluded: withAuth() authenticates every protected
> handler itself, so running the Supabase session round-trip here would only add
> latency to public endpoints polled during live games.

Do not add `/api/...` back to the matcher (commit d595143 deliberately removed them).

**Middleware checks authentication only, never role.** Any logged-in TEAM_MANAGER
reaches every `/admin` page unless a layout gates it (see below). Real enforcement
is in the API handlers via `withAuth`.

## Supabase client factories — pick the right one

| File | Factory | Use in |
|---|---|---|
| `src/lib/supabase/client.ts` | `createClient()` → `createBrowserClient` | `"use client"` components: login form, Realtime subscriptions |
| `src/lib/supabase/server.ts` | `createClient()` → `createServerClient` + `next/headers` cookies | Server components, route handlers, `withAuth`, `session.ts`, `/api/upload` storage calls |
| `src/lib/supabase/middleware.ts` | `updateSession(request)` → returns `{ supabaseResponse, user }` | ONLY `src/middleware.ts` (cookie refresh) |

All three use `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
**No code in `src/` uses `SUPABASE_SERVICE_ROLE_KEY`** (verified by grep) even though
DEPLOYMENT.md lists it as an env var — everything, including signed upload URLs in
`src/app/api/upload/route.ts`, runs through the anon key + the caller's session.

## Login flow

- `src/app/(auth)/login/page.tsx` (client component): `supabase.auth.signInWithPassword`
  via the browser client, then `router.push("/admin")` + `router.refresh()`. No OAuth.
- `src/app/(auth)/callback/route.ts`: `exchangeCodeForSession(code)` then redirect to
  `?next` (default `/admin`), or `/login?error=callback_failed`. Because `(auth)` is a
  route group, this handler serves the URL path **`/callback`** — NOT `/auth/callback`
  (a wrong redirect URL registered in Supabase makes email links 404; DEPLOYMENT.md
  and [deploy-and-ops] now carry the correct `/callback` path).

## Session helpers (server components / server actions)

`src/lib/auth/session.ts`:
- `getServerSession()` — Supabase `getUser()` → prisma `users` lookup by `supabaseId`
  (includes `managedTeam`). Returns the prisma user, or null when unauthenticated
  (instead of throwing).
- `requireAuth()` / `requireRole(role)` — same lookup but throw `Error("Unauthorized")`
  / `Error("Forbidden")`. Use in pages where an exception is acceptable.

## How to protect things

**New API route** — middleware never runs on `/api`, so this is the ONLY guard:

```ts
export const POST = withAuth(async (req, user, { params }) => { ... }, "SUPER_ADMIN");
```

`user` is the prisma `User` row (use `user.id` for `createdBy` fields). See
[api-conventions] for choosing the role.

**New /admin page** — middleware already guarantees *authenticated*. For role
restriction, add a nested layout that checks the role, copying
`src/app/(admin)/admin/users/layout.tsx`:

```ts
const session = await getServerSession();
if (!session || session.role !== "SUPER_ADMIN") redirect("/admin");
```

(`src/app/(admin)/admin/announcements/layout.tsx` uses the same pattern with a
different check — it redirects when `session.role === "SCOREKEEPER"`, so a
TEAM_MANAGER reaches the page but every `/api/announcements` verb requires
SUPER_ADMIN and rejects all mutations — a view/act asymmetry to keep in mind before
"fixing" either side.) The root
`src/app/(admin)/layout.tsx` only checks session-exists, not role.

## User management

- UI: `/admin/users` (`src/app/(admin)/admin/users/page.tsx`), gated SUPER_ADMIN by its layout.
- `GET /api/users` (`src/app/api/users/route.ts`) — list users, SUPER_ADMIN.
- `PUT /api/users/[id]` (`src/app/api/users/[id]/route.ts`) — change role; validates
  against `["SUPER_ADMIN", "SCOREKEEPER", "TEAM_MANAGER"]`, SUPER_ADMIN.
- There is no signup/invite API: creating a new operator = create the Supabase auth
  user (Supabase dashboard) AND insert the `users` row.

## Bootstrapping the first SUPER_ADMIN

Create the auth user in Supabase, then insert the `users` row with the corrected
INSERT in [deploy-and-ops] (single source for that SQL). Key detail: `"id"` and
`"updatedAt"` must be supplied explicitly — `@default(cuid())` and `@updatedAt` are
Prisma-client features with no database-level default, so an INSERT omitting them
fails with a NOT NULL violation.

## Gotchas

- **Relying on middleware for role checks**: a new `/admin` page with no layout gate is
  reachable by every role. Blast radius is limited to what the page's API calls allow
  (those still 403), but read-only server-component pages that query prisma directly
  will leak data to lower roles.
- **withAuth error contract** (clients depend on it): 401 `{"error":"Unauthorized"}` =
  no Supabase session; 401 `{"error":"User not found"}` = session but no `users` row;
  403 `{"error":"Forbidden"}` = role too low; 500 on unexpected errors.
- **Deleting a Supabase auth user does not delete the `users` row** (and vice versa);
  orphans are harmless but confusing in `/admin/users`.
- `requireAuth`/`requireRole` throw plain Errors — fine in pages (Next error boundary),
  wrong in API routes (would 500 instead of 401/403). Use `withAuth` in routes.

Related skills: [api-conventions], [caching-and-realtime]
