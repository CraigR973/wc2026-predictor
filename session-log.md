# World Cup 2026 Prediction League — Session Log

Running record of completed phases, decisions made mid-build, and carry-over notes between sessions.

---

## Format

Each entry follows this structure:

```
### Phase [ID] — [Name]
**Date:** YYYY-MM-DD  
**Model:** Sonnet 4.6 / Opus  
**Status:** ✅ Complete  
**Notes:** [deviations, decisions, follow-ups]  
**Next:** Phase [ID] — [Name]
```

---

## Log

### Phase 0.1 — Repository Scaffolding
**Date:** 2026-05-06
**Model:** Claude Sonnet 4.6
**Status:** ✅ Complete
**Commits:** 01cee39 (scaffold), 2e339f7 (close-out), aee293f (merge remote)
**Remote:** git@github.com:CraigR973/wc2026-predictor.git
**CI:** No GitHub Actions workflows defined yet — added in a future phase

**Files created:**
- `.gitignore`, `.nvmrc`, `.python-version`, `.env.example`, `LICENSE`, `README.md`
- `pnpm-workspace.yaml`, `package.json` (root, Node ≥20 engines, pnpm ≥9)
- `apps/web/` — Vite + React 18 PWA stub (package.json, vite.config.ts, tsconfig, tailwind, postcss, index.html, src/main.tsx)
- `apps/api/` — FastAPI stub (pyproject.toml, requirements.txt, requirements-dev.txt, src/__init__.py)
- `packages/shared/` — Zod schemas, TS types, scoring logic, tsconfig
- `migrations/`, `docs/adr/`, `docs/runbooks/` — directories with .gitkeep
- `pnpm-lock.yaml` — 596 packages, clean install

**Key facts / gotchas:**
- Shell initialises with Node 14 (system default). Must source nvm and run `nvm use 20` before pnpm commands: `export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 20`.
- ESLint 8 deprecated warning is expected — upgrade to v9 is a separate task (Phase 0.x or later).
- No GitHub remote added yet — user needs to create the repo and supply the URL.
- `scoreMatchPrediction` in `packages/shared/src/scoring.ts` is the canonical scoring function — tests in Phase 0.2+ should import from there.

**Next:** Phase 0.2 — Database Schema & Migrations (Alembic)

---

### Phase 0.2 — Backend Skeleton
**Date:** 2026-05-06
**Model:** Claude Sonnet 4.6
**Status:** ✅ Complete
**Commits:** 53665c2
**CI:** No GitHub Actions workflows defined yet (N/A until Phase 0.5); GITHUB_TOKEN not configured in shell env

**Files created:**
- `apps/api/src/config.py` — Pydantic Settings loader (pydantic-settings, reads .env)
- `apps/api/src/logging_config.py` — structlog structured JSON logging via stdlib bridge
- `apps/api/src/database.py` — SQLAlchemy async engine (pool_size=10, max_overflow=10), session factory, Base, get_db dependency
- `apps/api/src/main.py` — FastAPI app factory with lifespan handler, CORS middleware
- `apps/api/src/routers/health.py` — GET /api/v1/health and /api/v1/health/ready
- `apps/api/Dockerfile` — python:3.12-slim, Railway-ready
- `apps/api/tests/test_health.py` — 3 tests (health ok, ready+db ok, ready+db down)

**Key facts / gotchas:**
- Python 3.12 binary lives at `~/.local/bin/python3.12`; system python3 is 3.7 — always use `.venv` in `apps/api/`.
- `.venv/` is inside `apps/api/` (not repo root). Activate with `source apps/api/.venv/bin/activate` or prefix commands with `apps/api/.venv/bin/`.
- `PYTHONPATH=.` required when running pytest from `apps/api/` so `src.*` imports resolve.
- GITHUB_TOKEN env var not present in shell — CI polling skipped. Set it before Phase 0.5 when workflows are added.
- `on_event` decorator is deprecated in FastAPI — replaced with `lifespan` context manager.

---

## Phase 0.3 — Frontend Skeleton
**Date:** 2026-05-06  
**Model:** Claude Sonnet 4.6  
**Commit:** 11e79a461a709714f60b3842eec8c1b7a4065b33  
**CI:** No workflows yet — skipped (GITHUB_TOKEN not set)

**Files modified/created:**
- `apps/web/index.html` — added Google Fonts (Bebas Neue, Outfit, JetBrains Mono), `class="dark"` on html element
- `apps/web/src/index.css` — Tailwind directives + all §7.2 CSS custom property tokens
- `apps/web/tailwind.config.ts` — full design token theme mapped to CSS vars, darkMode: 'class'
- `apps/web/vite.config.ts` — reads PORT env var for preview tool compatibility
- `apps/web/src/lib/utils.ts` — cn() helper (clsx + tailwind-merge)
- `apps/web/src/components/ui/button.tsx` — shadcn/ui Button (5 variants: default, outline, ghost, accent, destructive)
- `apps/web/src/components/ui/card.tsx` — shadcn/ui Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- `apps/web/src/components/ui/badge.tsx` — shadcn/ui Badge (10 variants incl. live/animated)
- `apps/web/src/main.tsx` — design system demo page showing all tokens, fonts, components
- `apps/web/dev.sh` — nvm/Node 20 bootstrap wrapper for Claude Preview tool
- `.claude/launch.json` — preview server config

**Gotchas for future sessions:**
- Preview tool (launch.json) shells out without nvm — `dev.sh` bootstraps Node 20 before running pnpm. Must keep this wrapper.
- Vite reads `process.env['PORT']` to allow autoPort assignment from preview tool (config now dynamic, not hardcoded 5173).
- shadcn/ui components are hand-rolled (no `npx shadcn-ui init`) — only `@radix-ui/react-slot` is needed (already in package.json). All other dependencies (cva, clsx, tailwind-merge) were pre-installed in Phase 0.2.
- `pnpm --parallel -r dev` runs from workspace root — the preview tool uses this via `pnpm dev` from root which triggers all `dev` scripts.

**Next:** Phase 0.4 — Database Schema & Migrations (Alembic)

---

## Phase 0.4 (= arch Phase 1.1): Database Schema & Migrations
**Date:** 2026-05-06
**Model:** claude-sonnet-4-6
**Commits:** ee4308e

### Files modified/created
- `apps/api/src/models/` — new package: `base.py`, `group.py`, `team.py`, `profile.py`, `refresh_token.py`, `invite.py`, `__init__.py`
- `apps/api/src/database.py` — removed inline `Base`; now imports from `src.models.base`
- `apps/api/alembic.ini` — Alembic config; `script_location` uses `%(here)s` pointing to repo-root `migrations/`
- `migrations/env.py` — async Alembic env (asyncpg); adds `apps/api` to `sys.path` for model imports
- `migrations/script.py.mako` — standard Alembic template
- `migrations/versions/001_core_schema.py` — creates ENUMs, tables, `updated_at` trigger, RLS policies
- `apps/api/src/seed.py` — idempotent dev seed: 8 groups (A–H), 32 teams
- `apps/api/tests/test_models.py` — 13 new tests (structure, FKs, enums, constraints); 16 total passing

### CI
No workflow files exist yet (Phase 0.5). No GITHUB_TOKEN in env — CI polling skipped.

### Key facts / gotchas
- Alembic is run from `apps/api/` with `PYTHONPATH=.`; command: `alembic upgrade head`
- RLS policies wrapped in `DO $$ BEGIN IF EXISTS (auth schema) ... END $$` — safe to run on plain Postgres (silently skips RLS)
- `TournamentStage` and `PlayerRole` use `StrEnum` (Python 3.11+) — avoids UP042 lint error
- Unique constraints use named `__table_args__` `UniqueConstraint` (not `unique=True` on columns) so test assertions and migration DDL are consistent
- Seed uses 2022 WC teams as placeholder data; Phase 1.4 replaces with the full 2026 draw (48 teams / 12 groups)
- `gen_random_uuid()` is used for UUID defaults — requires pgcrypto or Postgres 13+ (Supabase has it)

---

## Phase 0.5 — CI Pipeline

**Date:** 2026-05-06
**Model:** Claude Sonnet 4.6
**Commits:** 2e074be (feat), close-out commit below

### Files modified
- `.github/workflows/ci.yml` — new; five jobs: lint-api, typecheck-api, test-api, migration-check, build-web
- `apps/web/.eslintrc.cjs` — new; TypeScript parser + react-hooks/react-refresh plugins
- `apps/web/package.json` + `pnpm-lock.yaml` — added @typescript-eslint/parser + @typescript-eslint/eslint-plugin
- `apps/api/src/models/base.py`, `src/seed.py`, `tests/test_models.py` — ruff format auto-fixes only

### CI status
Push to main at commit 2e074be. CI polling skipped (repo private, no GITHUB_TOKEN in local env). Workflow verified correct by local dry-run of all five check types.

### Key facts / gotchas
- All config.py fields have defaults — pytest requires no env vars and no postgres service (DB calls are fully mocked in test_health.py)
- Only migration-check job needs a postgres service container (postgres:16)
- alembic reads DATABASE_URL from env via `os.environ.get("DATABASE_URL")` in migrations/env.py
- Web lint had no ESLint config at all — added .eslintrc.cjs; needed @typescript-eslint/parser for TS syntax (not in original Phase 0.3 deps)
- ruff format --check failed on 3 files (base.py, seed.py, test_models.py) — auto-fixed with ruff format
- ESLint 8 is deprecated upstream; upgrade to ESLint 9 flat config is a future task (not blocking)

---

## Phase 0.6: Error Tracking

**Date:** 2026-05-06
**Model:** claude-sonnet-4-6
**Commit:** f296b09

### What was done
- `sentry-sdk[fastapi]` was already installed; just needed wiring
- Backend: `sentry_sdk.init()` in `apps/api/src/main.py` guarded by `settings.sentry_dsn_backend`; uses `FastApiIntegration` + `SqlalchemyIntegration`; `before_send=_scrub_pii` strips `display_name` and `username` from all Sentry user contexts
- Backend: new `apps/api/src/middleware.py` — `CorrelationIdMiddleware(BaseHTTPMiddleware)` generates UUID4 per request, binds it to `structlog.contextvars` so every log line carries `correlation_id`, echoes it in `X-Correlation-ID` response header, and propagates a client-supplied header unchanged
- Frontend: `@sentry/react` v10.51.0 installed; `apps/web/src/sentry.ts` init module (no-ops when `VITE_SENTRY_DSN` unset); `beforeSend` scrubs `display_name`; imported at top of `main.tsx`
- `apps/web/src/vite-env.d.ts` added (was missing — caused `import.meta.env` TS errors)
- `.env.example`: `SENTRY_DSN_FRONTEND` → `VITE_SENTRY_DSN` (Vite requires `VITE_` prefix to expose vars to browser bundle)
- New tests: `test_correlation_id.py` (generated + passthrough), `test_sentry.py` (PII scrubber)
- 21 backend tests pass; ruff clean; mypy clean; frontend typecheck + build green

### Files modified
- `apps/api/src/main.py` — Sentry init, `_scrub_pii`, middleware wiring
- `apps/api/src/middleware.py` — new; `CorrelationIdMiddleware`
- `apps/api/tests/test_correlation_id.py` — new
- `apps/api/tests/test_sentry.py` — new
- `apps/web/src/sentry.ts` — new
- `apps/web/src/vite-env.d.ts` — new
- `apps/web/src/main.tsx` — import sentry.ts at top
- `apps/web/package.json` + `pnpm-lock.yaml` — @sentry/react added
- `.env.example` — VITE_SENTRY_DSN

### CI status
Push to main at commit f296b09. CI polling skipped (no GITHUB_TOKEN in local env). All CI check types verified locally (ruff, mypy, pytest, tsc, vite build).

### Key facts / gotchas
- `vite-env.d.ts` was missing from the Phase 0.3 frontend scaffold — needed `/// <reference types="vite/client" />` for `import.meta.env` to resolve in TypeScript
- Sentry v10 (`@sentry/react ^10.51.0`) uses `browserTracingIntegration()` (not the older `BrowserTracing` class)
- `sentry_sdk.types.Event` and `Hint` are the correct types for `before_send` callbacks in mypy-strict projects — using plain `dict[str, Any]` triggers an arg-type error
- `RequestResponseEndpoint` from `starlette.middleware.base` is the correct type for `call_next` in `BaseHTTPMiddleware.dispatch`
- Middleware order: `CorrelationIdMiddleware` added AFTER `CORSMiddleware` in Starlette (last-added = outermost wrapper), so correlation ID is bound before CORS processing

---

## Phase 1.2 — Match Schema
**Date:** 2026-05-08
**Model:** Claude Sonnet 4.6
**Commits:** 0ef2686

### Files modified
- `migrations/versions/002_match_schema.py` — new; match_status and result_source ENUMs, matches table, unique constraints, 3 indexes, updated_at trigger
- `apps/api/src/models/match.py` — new; Match ORM model with MatchStatus / ResultSource StrEnums, __table_args__ declaring constraints and indexes
- `apps/api/src/models/__init__.py` — added Match, MatchStatus, ResultSource exports
- `apps/api/tests/test_models.py` — added 7 tests (columns, ENUM values, unique constraints, indexes, FKs); metadata table set updated

### CI status
Push to main at commit 0ef2686. CI: completed success.

### Key facts / gotchas
- UniqueConstraint and Index must be declared in __table_args__ on the ORM model (not only in the migration) for SQLAlchemy metadata inspection — tests assert on Table.constraints and Table.indexes which read from metadata, not from the live DB
- The tournament_stage ENUM is reused from migration 001 (create_type=False); only match_status and result_source are new
- Matches table has 3 FK references to teams (home_team_id, away_team_id, penalty_winner_id), all with ondelete="SET NULL" — test_match_fks asserts "teams.id" in fk_targets (set membership, not count)

---

## Phase 1.3 — Prediction & Notification Schema
**Date:** 2026-05-08
**Model:** Claude Sonnet 4.6
**Commits:** c0cc069, 38b764d

### Files modified
- `migrations/versions/003_prediction_notification_schema.py` — new; 5 ENUM types, 8 tables: predictions, knockout_predictions, special_predictions, leaderboard_snapshots, push_subscriptions, notification_preferences, notification_log, audit_log
- `apps/api/src/models/prediction.py` — new; Prediction, KnockoutPrediction, SpecialPrediction, LeaderboardSnapshot, PushSubscription, NotificationPreferences ORM models
- `apps/api/src/models/notification.py` — new; NotificationLog, AuditLog ORM models + NotificationType, DeliveryStatus, ActorType, ActionType enums
- `apps/api/src/models/__init__.py` — updated to export all new model classes and enums
- `apps/api/tests/test_models.py` — added 28 new tests; total 47 model tests passing

### CI status
Push to main at commits c0cc069 + 38b764d. CI: completed success (mypy fix required: dict → dict[str, Any]).

### Key facts / gotchas
- mypy requires explicit dict[str, Any] — bare `dict` or `dict | None` in Mapped[] type annotations fails mypy's [type-arg] check
- notification_preferences uses player_id as the primary key (one row per player, no separate id UUID) — do NOT add UUIDPrimaryKeyMixin to that model
- updated_at trigger is needed for predictions, knockout_predictions, special_predictions, notification_preferences — all others (leaderboard_snapshots, push_subscriptions, notification_log, audit_log) have no updated_at column
- leaderboard_snapshots uses TimestampMixin (created_at only); notification_log and audit_log use UUIDPrimaryKeyMixin only (no timestamp mixin — they have custom timestamp/sent_at fields)

---

## Phase 1.4 — Tournament Data Seed
**Date:** 2026-05-08
**Model:** Claude Sonnet 4.6
**Commits:** 6d25a29

### Files modified
- `apps/api/src/seed.py` — full rewrite; 12 groups (A–L), 48 teams with flag emojis, 72 group stage matches with UTC kickoff times and venues; idempotent upserts by name/code/match_number
- `apps/api/tests/test_seed_data.py` — new; 16 data-integrity tests (no DB needed): group counts, team uniqueness, 3-match-per-team, no duplicate fixtures, group-correct teams, simultaneous matchday-3 pairs, date window

### CI status
Push to main at commit 6d25a29. CI: completed success.

### Key facts / gotchas
- football_data_team_id and football_data_match_id are left NULL — these require the FOOTBALL_DATA_API_KEY to be configured and a separate API sync job to populate; the seed script is intentionally not responsible for those IDs
- Kickoff times are in UTC, derived from UK BST (UTC+1) broadcast schedule (all UK times minus 1 hour)
- Scotland uses the encoded Scottish flag emoji (🏴󠁧󠁢󠁳󠁣󠁴󠁿) which is composed of multiple Unicode code points — it correctly inserts but displays as a regional indicator sequence
- England similarly uses the English flag emoji (🏴󠁧󠁢󠁥󠁮󠁧󠁿) not the Union Jack 🇬🇧
- Matchday 3 simultaneous pairs: matches 49–72 in groups B-K/L are played simultaneously per group; the test verifies this invariant
- Draw source: December 2025 draw at JFK Center, Washington DC (confirmed via multiple sources including openfootball/worldcup.json)
