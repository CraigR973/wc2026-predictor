# World Cup 2026 Prediction League — CLAUDE.md

This file provides Claude with project-specific context and configuration for every session.

---

## Project

**World Cup 2026 Prediction League** — a private, invite-only prediction league PWA for the 2026 FIFA World Cup. Up to 15 players, full tournament coverage (104 matches), automatic result fetching, live leaderboard, push notifications.

**Stack:** FastAPI + PostgreSQL (Supabase) + React 18 + Tailwind + shadcn/ui  
**Auth:** Name + PIN (bcrypt) with JWT access (24h) + refresh (30d) token pair  
**Hosting:** Vercel (frontend) + Railway (backend)

---

## Phase close-out protocol

Follow the global phase close-out protocol from `~/.claude/CLAUDE.md` exactly.

- Session log: `session-log.md` (repo root)
- Architecture/plan doc: `wc2026-architecture.md` (repo root)
- Remote: `origin main`
- CI: GitHub Actions — poll via GitHub API with token from env `GITHUB_TOKEN`

---

## Key files

| File | Purpose |
|---|---|
| `wc2026-architecture.md` | Authoritative design spec — all phases, data model, API design |
| `session-log.md` | Running log of completed phases and session notes |
| `apps/api/` | FastAPI backend |
| `apps/web/` | React frontend (Vite) |
| `packages/shared/` | Shared Zod schemas, TS types, scoring logic |
| `migrations/` | Alembic migrations |
| `docs/runbooks/` | Operational runbooks (restore, kickoff change, cancelled match, PIN reset, etc.) |
| `.env.example` | All required environment variables documented |

---

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (for Alembic + asyncpg) — `postgresql+asyncpg://...` |
| `SUPABASE_URL` | Supabase project URL (REST API) |
| `SUPABASE_ANON_KEY` | Supabase anon/public key (frontend) |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (backend only — never exposed to frontend) |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens (HS256, 24h TTL) |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `FOOTBALL_DATA_API_KEY` | football-data.org API key (free tier) |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key (also exposed to frontend) |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key (backend only) |
| `VAPID_CONTACT_EMAIL` | Contact email for VAPID registration |
| `FRONTEND_ORIGIN` | Allowed CORS origin (e.g. `https://app.example.com`) |
| `SENTRY_DSN_BACKEND` | Sentry DSN for backend error tracking |
| `SENTRY_DSN_FRONTEND` | Sentry DSN for frontend error tracking |
| `GITHUB_TOKEN` | GitHub API token for CI polling during phase close-out |

---

## Conventions

- All endpoints prefixed `/api/v1/`
- Standard response envelope: `{ data, meta, errors }`
- Database: snake_case, UUID PKs, soft deletes on critical tables
- API JSON: camelCase
- Git branches: `feat/`, `fix/`, `chore/` prefixed, squash merge to `main`
- Commits: Conventional Commits format
- Tests ship with every phase — no phase is done without them
- Never skip acceptance criteria — a phase isn't complete until every bullet passes

---

## Time and timezone handling

- All timestamps stored in **UTC** in the database (`TIMESTAMP` columns named `*_utc`)
- Each player has a `profiles.timezone` field storing their **IANA timezone** (e.g. `Europe/London`, `America/New_York`)
- The frontend converts UTC to player-local time using `date-fns-tz`
- The 2026 World Cup matches span US/Canada/Mexico time zones — players in the UK will see kickoff times in their own timezone correctly
- APScheduler jobs use UTC throughout; never assume server timezone
- When displaying a kickoff: always pass through `formatInTimeZone(kickoffUtc, player.timezone, 'EEE d MMM, HH:mm')`

---

## Scoring rules (reference)

**Per-match score predictions:**

| Criteria | Points |
|---|---|
| Correct combined total goals | 2 |
| Correct result (W/D/L) | 3 |
| Exact scoreline | 5 |
| **Max per match** | **10** |

**Knockout winner predictions (per-round, max 295pts total):**  
R32=5 (×16), R16=10 (×8), QF=15 (×4), SF=20 (×2), 3rd Place=10 (×1), Final=25 (×1)

**Specials (max 45pts):**  
Tournament winner=20, Golden Boot=15, Top scoring team=10

**No prediction submitted = 0 points** (flagged in `points_breakdown.no_prediction = true`)

---

## Phase model guide

| Tag | When to use |
|---|---|
| 🟢 Sonnet 4.6 | Default — CRUD, components, migrations, tests, API wiring |
| 🔴 Opus | Complex reasoning — scoring edge cases, bracket logic, scheduler, realtime sync, debugging |

---

## Current status

See `session-log.md` for the latest completed phase and next steps.
