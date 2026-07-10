# ICM Athletics Site

Public website + admin console for the ICM Summer League (recreational basketball):
standings, schedule, player stats, and courtside live scorekeeping that streams to
public viewers in <1s. Next.js 14 App Router + Prisma 5 + Supabase (Auth/Realtime/
Storage) + Vercel.

## Use the skill library

`.claude/skills/` is this project's institutional memory — it was written by the
departing lead and independently fact-checked against the code. **Start every
session by reading `.claude/skills/project-map/SKILL.md`**, then load the domain
skill BEFORE editing its area:

| Area | Skill |
|---|---|
| Orientation, "where does X live" | `project-map` |
| ScorekeeperBoard, game events, undo, subs, start/end/reset | `live-scoring` |
| Standings/career stats wrong, finalize/recalculate | `stats-and-standings` |
| Prisma schema changes, seed, cascades, enums | `database-changes` |
| Login, roles, withAuth, protecting routes/pages | `auth-and-roles` |
| Adding/changing API routes | `api-conventions` |
| ISR/revalidatePath, Supabase Realtime subscriptions | `caching-and-realtime` |
| Pages, components, styling, forms, mobile | `frontend-conventions` |
| CSV roster import, seeding, new-season setup | `data-import-and-seed` |
| Env setup, npm scripts, commit checklist | `dev-workflow` |
| Vercel/Supabase ops, cron, prod schema changes | `deploy-and-ops` |
| Anything broken — symptom → cause → fix | `debugging-playbook` |
| Proving a change works (there are no tests) | `verify` |

## Non-negotiables

- **The four-layer stat invariant**: GameEvent log → per-game aggregates →
  TeamSeason standings → PlayerCareerStats. Any change to
  `src/lib/db/mutations/stats.ts` or `standings.ts` must be traced through all four
  layers (`verify` skill, section 4) before it is done.
- **No tests / lint / CI exist.** The gate is `npx tsc --noEmit` + `npm run build` +
  manually exercising the changed flow.
- **One shared Supabase DB.** Never run `db:push` or `db:seed` without confirming
  what `DATABASE_URL` points at — the seed duplicates all players/games on re-run.
- **Realtime broadcasts only whitelisted tables** (`supabase_realtime` publication);
  DB columns are camelCase (`@@map` renames tables only) — never copy the existing
  snake_case payload/filter strings, they are documented bugs.
