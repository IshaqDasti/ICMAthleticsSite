---
name: frontend-conventions
description: How UI code is written in this repo — route-group layouts, server vs "use client" components, hand-rolled Tailwind styling with cn() and CSS-variable tokens (no shadcn/Radix in use), plain-useState forms with sonner toasts, recharts, next/image, ET date formatting, slugify, and mobile/courtside layout rules. Use when adding or editing pages, components, forms, styles, dark mode, charts, images, or date display.
---

# Frontend Conventions

Derive from existing code; the patterns below are what the repo actually does.

## Layouts and route groups

- `src/app/layout.tsx` (root): Open Sans font, `metadata.title.template` = `"%s | ICM Athletics"`,
  wraps everything in `ThemeProvider` (`attribute="class"`, `defaultTheme="light"`,
  `enableSystem={false}`) and mounts the sonner `<Toaster richColors position="top-right" />`.
- `src/app/(public)/layout.tsx`: `PublicNavbar` + `LiveGameBanner` + `<main>` + `Footer`.
- `src/app/(admin)/layout.tsx`: async server component; calls `getServerSession()`
  (`src/lib/auth/session.ts`) and `redirect("/login")` if null — this is the page-level
  auth gate on top of `src/middleware.ts`. Shell: `AdminSidebar` (desktop, `lg:`),
  `AdminMobileNav` (mobile), `ThemeToggle` header rows, `<main className="flex-1 p-6
  bg-background overflow-auto">`. Outer div is `h-screen overflow-hidden`.
- `src/app/(auth)/layout.tsx`: centered card with the `/icomd-logo.png` logo.

New page: put it in the route group whose layout/auth you want. Set `metadata.title`
without the suffix (the template adds it; a `description` is optional — the static
pages have one) and a `revalidate` export on public pages that show changing data
(10–60s; the authoritative per-page table lives in [caching-and-realtime];
`/schedule` is `export const dynamic = "force-dynamic"`; the static
about/rulebook/codeofconduct pages have neither).

## Server vs client components

Server by default. Public pages are async server components that call
`src/lib/db/queries/*` directly. Mark `"use client"` only for the existing reasons:

- Forms/fetch mutations: all admin new/edit pages (`admin/teams/new`, `admin/players/new`,
  `admin/seasons/new`, `admin/schedule/new`, import, users, announcements), login.
- Supabase Realtime subscriptions: `ScorekeeperBoard`, `BoxScoreView`, `LiveGameBanner`.
- Polling/refresh: `ScheduleRefresher` (`router.refresh()` every 10s when a game is live).
- Theme: `ThemeProvider`, `ThemeToggle` (has a `mounted` guard to avoid hydration flash).
- Client-side sort/filter UI: `StandingsTable`, `PlayerRankingsTable`. Charts: `PlayerStatChart`.
- Nav open/close state: `PublicNavbar`, `AdminSidebar`, `AdminMobileNav`.

Pattern for pages needing both: server page fetches via Prisma, passes a plain
serializable prop to a client component (see `src/app/(admin)/admin/live/[gameId]/page.tsx`
building `initialGame` for `ScorekeeperBoard`).

## Styling / "UI kit"

There is NO component kit. `src/components/ui/` is empty; `@radix-ui/*`,
`class-variance-authority`, and `cmdk` are in package.json but unused in `src/`.
Do not invent a shadcn setup — write plain JSX with Tailwind classes, matching:

- Tokens: shadcn-style CSS variables in `src/app/globals.css` (`--background`,
  `--card`, `--primary`, `--muted`, `--destructive`, `--border`, `--ring`, `--radius`;
  maroon palette), mapped in `tailwind.config.ts` (`bg-card`, `text-muted-foreground`,
  `bg-primary text-primary-foreground`, etc.). Never hardcode brand hex values
  (chart series strokes in `PlayerStatChart` are intentionally non-brand hex — leave them).
- `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge) for conditional classes.
- Icons: `lucide-react`. Cards: `rounded-xl border bg-card p-6`. Inputs:
  `w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none
  focus:ring-2 focus:ring-ring`. Primary button: `px-4 py-2 bg-primary
  text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50`.
- Dark mode: `darkMode: "class"`; `.dark` block in globals.css overrides the variables.
  Default theme is LIGHT with system detection off — check both themes when styling.
  Live indicator: `.live-dot` pulse animation defined in globals.css.

## Forms

No react-hook-form, no zod (installed but unused — do not add resolver plumbing to
match package.json). The repo pattern (see `src/app/(admin)/admin/teams/new/page.tsx`,
`players/new/page.tsx`, `seasons/new/page.tsx`):

1. `"use client"` page, `useState` object for the whole form, controlled inputs
   (often mapped from a `fields` config array).
2. Dropdown data fetched in `useEffect` from the API (e.g. `/api/teams`, `/api/seasons`).
3. Submit: `fetch("/api/<resource>", { method: "POST", body: JSON.stringify(form) })`,
   `loading` state disables the button, then `toast.success(...)` + `router.push(...)`
   on ok, `toast.error(...)` otherwise. Toasts come from `sonner` (`import { toast }`).
4. Validation is `required` attributes + server-side checks; keep new forms consistent.

## Charts, images, dates, slugs

- Charts: recharts. `src/components/players/PlayerStatChart.tsx` is the template —
  client component, `ResponsiveContainer`, PTS/REB/AST lines, tooltip styled with
  `hsl(var(--card))`/`hsl(var(--border))` so it follows the theme, and an explicit
  empty state when `data.length < 2`.
- Images: `next/image` for local static assets (`/icomd-logo.png` in navbars, footer,
  auth layout). `next.config.mjs` whitelists `https://*.supabase.co
  /storage/v1/object/public/**` for remote images, but current code renders Supabase
  URLs (team `logoUrl`, player `photoUrl`) with plain `<img>` (e.g.
  `src/app/(public)/teams/[slug]/page.tsx`). Either is acceptable; if you switch a
  remote image to `next/image` the remotePattern already allows it.
- Dates: ALWAYS format game times with `formatGameDate` / `formatGameTime` /
  `formatGameDateTime` from `src/lib/utils/dates.ts` — they pin
  `timeZone: "America/New_York"` via `Intl.DateTimeFormat`, so output is correct even
  though Vercel servers run in UTC. Do not use `toLocaleString()` without a timezone.
  `getScheduledGamePillStatus` drives the Upcoming/Active pill in
  `src/components/schedule/GameCard.tsx`.
- Slugs: `slugify()` in `src/lib/utils/slugify.ts`. Slugs are generated SERVER-side in
  API routes at create time (e.g. `src/app/api/seasons/route.ts`,
  `src/app/api/players/import/route.ts` which also de-dupes with a `-1`, `-2` suffix
  loop). Never build slugs in the browser. `prisma/seed.ts` carries its own copy.

## Mobile / courtside

- Admin is used on phones courtside. `AdminMobileNav` renders below `lg`;
  `AdminSidebar` is desktop-only. Test admin UI at phone width.
- `ScorekeeperBoard` (`src/components/live/ScorekeeperBoard.tsx`, ~1100 lines) must fit
  on ONE screen without page scrolling on desktop (commit e5bf8f6 "Live scoring to fit
  on one page"). The live page (`src/app/(admin)/admin/live/[gameId]/page.tsx`) escapes
  the admin layout's `p-6` with `-m-6` and `lg:h-[calc(100%+3rem)] lg:overflow-hidden`;
  inside the board, sections scroll internally via `min-h-0` + `overflow-y-auto` flex/grid
  children. Preserve this: never add outer padding/margins or unbounded-height content
  to the board — anything that grows must scroll inside its own `min-h-0` container.

## Gotchas

- Adding a nav destination requires edits in up to three places: `PublicNavbar` (public),
  `AdminSidebar` AND `AdminMobileNav` (admin) — they hardcode separate link arrays.
- `ThemeToggle`-style client components reading `useTheme` need the mounted guard or
  they hydration-mismatch.
- Forgetting `revalidate` on a new public page makes it fully static — it will show
  stale scores forever until a mutation happens to `revalidatePath` it. See
  [caching-and-realtime].

Related skills: [project-map], [caching-and-realtime], [live-scoring], [api-conventions].
