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
- Always merge the feature branch back to `main` (`git checkout main && git merge --ff-only <branch> && git push origin main`) after CI is green
- CI: GitHub Actions — token in `.env` as `GITHUB_TOKEN`. **Do not foreground-poll CI in a tight loop** — each iteration pollutes chat context. Pattern: one immediate check, then one or two follow-up checks via `run_in_background` bash spaced ~3 min apart, OR push and rely on the cached result endpoint at the end. Never write 10+ polling lines into the conversation.

---

## Bash discipline (token-saving)

- **Never `cd`.** The sandbox blocks `cd` outside the worktree root and each blocked call wastes a turn. Use absolute paths in every command.
- Python interpreter for backend work: `/Users/craigrobinson/wc_2026_predictor/apps/api/.venv/bin/python` — the venv is NOT inside the worktree.
- Backend test/lint/typecheck invocation pattern:
  - `PYTHONPATH=<worktree>/apps/api /Users/craigrobinson/wc_2026_predictor/apps/api/.venv/bin/python -m pytest <abs-path-to-tests>`
  - Same shape for `-m ruff check`, `-m ruff format --check`, `-m mypy src`
- Frontend test invocation: `PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" pnpm --dir <worktree>/apps/web test`
- Prefer `grep` with line ranges over reading whole files. `wc2026-architecture.md` is 1600+ lines — always grep for the section heading first, then read a small `offset`/`limit` window.

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

All required variables are documented in `.env.example` with inline comments. Read that file when you need a specific name or purpose; do not duplicate them here.

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

## Scoring rules

The authoritative scoring rules live in `wc2026-architecture.md` (§7) and the Postgres trigger in `migrations/`. Read them on-demand when touching scoring logic.

---

## Phase model guide

| Tag | When to use |
|---|---|
| 🟢 Sonnet 4.6 | Default — CRUD, components, migrations, tests, API wiring |
| 🔴 Opus | Complex reasoning — scoring edge cases, bracket logic, scheduler, realtime sync, debugging |

---

## Current status

See `session-log.md` for the latest completed phase and next steps.
