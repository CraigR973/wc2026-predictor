# World Cup 2026 Prediction League — Session Log

Running record of completed phases, decisions made mid-build, and carry-over notes between sessions.

---

## Multi-league staging soak — v1.1-multi-league tag
**Commits:** 8e4894c, 448d9fc · Tagged: `v1.1-multi-league`

### Key facts for future sessions
- **Bug found & fixed:** No endpoint existed for an already-authenticated player to claim an invite token and join a private league. `POST /api/v1/leagues/claim-invite` was added to `league_memberships.py` (registered before `/{slug}` routes to avoid slug-capture). `JoinPage.tsx` now branches on auth state — authenticated users see a one-click "Join league" button; unauthenticated users see the original create-account form.
- **Migration incident:** `railway up` accidentally targeted the prod Railway project (`wc2026-api-prod`). Migrations 011–014 ran in a single Alembic transaction; migration 012 (`invites.league_id NOT NULL`) failed because prod had invites with null `league_id` and no `steele-spreadsheet` league existed. Fixed by: (a) embedding the backfill (create league, backfill profiles, create memberships) into migration 011 itself; (b) adding a DELETE guard in migration 012 for unmappable invites. Prod recovered and is now at migration 014.
- Staging Railway project is named `endearing-integrity` (ID `d56eb1a4`). To deploy: `railway link --project endearing-integrity && railway up --detach`. Switch back to prod: `railway link --project wc2026-api-prod`.
- Staging Supabase MCP is connected to the staging DB (project ref differs from prod `kznxjyaanotrejcevngy`). Use Railway env vars + asyncpg directly to query prod DB if needed.
- Leaderboard only shows players with a `leaderboard_snapshot` row — new members appear after the next scheduled snapshot run, not immediately on join.
- `/auth/join` (old unauthenticated invite flow) still works unchanged — only adds the new authenticated path alongside it.

**Next:** World Cup begins 11 Jun 2026 — live match result sync, predictions deadline monitoring

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

---

## Phase 1.5 — Scoring Function
**Date:** 2026-05-08
**Model:** Claude Opus 4.7
**Commits:** ebed14a (function + tests + CI), faaba5d (loop scope fix), 05f68e8 (test expectation fix)

### Files modified
- `migrations/versions/004_scoring_function.py` — new; Postgres function `calculate_match_points(predicted_home, predicted_away, actual_home, actual_away, stage tournament_stage)` returning JSONB `{goals, result, exact, total, no_prediction}`. IMMUTABLE / `CREATE OR REPLACE` so re-running the migration is idempotent.
- `apps/api/tests/conftest.py` — new; `db_engine` (session-scoped) + `db_conn` (function-scoped, auto-rollback) fixtures. Skip cleanly when `DATABASE_URL` is not set.
- `apps/api/tests/test_scoring_function.py` — new; 47 parametrised test cases covering NULL prediction, NULL actual, exact / goals-only / result-only / nothing-matches in group stage, the same in every knockout stage, and the no-draw rule for knockout result points. Each test runs inside the connection's auto-begun transaction (acceptance criterion).
- `apps/api/pyproject.toml` — set `asyncio_default_fixture_loop_scope = "session"` and `asyncio_default_test_loop_scope = "session"` so the asyncpg pool stays bound to the same loop tests run in.
- `.github/workflows/ci.yml` — `test-api` job now provisions a postgres:16 service, runs `alembic upgrade head`, and exposes `DATABASE_URL` so the new tests run for real (rather than skipping).

### CI status
Push to main at commit 05f68e8. CI: all jobs completed success (lint, mypy, unit tests, migration check, build web).

### Key facts / gotchas
- pytest-asyncio's default function-scoped event loop breaks session-scoped DB fixtures: the asyncpg connection pool gets bound to one loop while subsequent tests run in fresh loops, raising `cannot perform operation: another operation is in progress`. Pinning both fixture and test loop scope to `session` fixes it. (Required `pytest-asyncio>=0.24` for `asyncio_default_test_loop_scope` — we have 1.3.0.)
- asyncpg returns JSONB values to SQLAlchemy as Python dict OR JSON string depending on codec registration. Casting the function output to `::text` and using `json.loads` is portable across versions.
- The scoring function uses Postgres `sign()` for W/D/L comparison: `sign(predicted_home - predicted_away) = sign(actual_home - actual_away)`. The knockout no-draw rule combines this with `NOT (is_knockout AND pred_diff = 0) AND NOT (is_knockout AND actual_diff = 0)` so neither side can earn result points on a 90-minute draw.
- Same total goals + opposite winner = goals-only points (2pts), e.g. predicted 2-1 actual 1-2.
- Two reflex test bugs caught by CI: predicted 1-1 vs actual 2-2 (totals differ → 0 goals pts) and predicted 1-0 vs actual 0-1 (totals match → 2 goals pts). Author had labelled both wrongly; the function was correct.

---

## Phase 1.6 — Scoring Trigger & Snapshot Insert
**Date:** 2026-05-08
**Model:** Claude Opus 4.7
**Commits:** 1896c8a (trigger + tests), b7cbd8d (split DDL), 28b2979 (rank-tie test fix)

### Files modified
- `migrations/versions/005_scoring_trigger.py` — new; two triggers on `matches`:
  - `matches_set_result_entered_at` (BEFORE UPDATE): stamps `result_entered_at = now()` atomically with the score update.
  - `matches_score_results` (AFTER UPDATE): cascades scoring into `predictions`, `knockout_predictions`, and `leaderboard_snapshots` for every active player. Uses `RANK() OVER (ORDER BY total_points DESC)` so ties share a rank.
  - Both fire only on the NULL → value transition of `actual_home_score`/`actual_away_score`, so unrelated UPDATEs (venue change, status flip) don't re-trigger.
- `apps/api/tests/test_scoring_trigger.py` — new; 16 integration tests against a live Postgres covering: group-stage scoring, leaderboard snapshot row per active player, soft-deleted player exclusion, knockout round points per stage (parametrised across r32/r16/qf/sf/third_place/final), penalty-decided draws, group match leaving knockout_predictions untouched, RANK() tie semantics (1, 1, 3 — gap), NULL prediction → `no_prediction: true` breakdown, atomicity (predictions / snapshots / `result_entered_at` all visible together after the UPDATE returns).

### CI status
Push to main at commit 28b2979. CI: all jobs completed success (lint, mypy, unit tests, migration check, build web).

### Key facts / gotchas
- asyncpg + SQLAlchemy uses prepared statements and rejects multi-statement SQL with `cannot insert multiple commands into a prepared statement`. `DROP TRIGGER ... ; CREATE TRIGGER ...` must be split into separate `op.execute()` calls in alembic migrations.
- The trigger's `WHEN` clause uses `(OLD.actual_home_score IS NULL OR OLD.actual_away_score IS NULL) AND NEW.actual_home_score IS NOT NULL AND NEW.actual_away_score IS NOT NULL` so any subsequent edit (including correcting a wrong score) won't re-fire and double-snapshot. A separate "result_overridden" path will be needed in a later phase if admins need to amend a result.
- 90-min knockout draw: the trigger reads `NEW.penalty_winner_id` to determine the actual winner for `knockout_predictions`. If that field is NULL (e.g. ET-only match), no one is awarded the round points.
- `RANK()` (not `DENSE_RANK()`) was chosen for leaderboards — tied players share a rank and the next rank skips. So 10pts, 10pts, 0pts → ranks 1, 1, 3.
- Tests build their own fixtures via raw SQL helpers (`_insert_group`, `_insert_team`, `_insert_profile`, `_insert_match`, `_insert_prediction`, `_insert_knockout_prediction`); the `db_conn` fixture rolls back on test exit so no cross-test pollution.
- Reflex test bug caught by CI: predicted 0-1 vs actual 1-0 scores 2pts (matching totals), not 0pts. Test rewritten with carol predicting 0-2 to guarantee a clean zero.

---

## Phase 0.4 — Supabase Setup & Auth

**Date:** 2026-05-09
**Model:** Claude Sonnet 4.6
**Commits:** fe44846 (auth impl), ee47ff2 (CI fixes — ruff format + mypy dict[str,Any])

### Files modified
- `apps/api/src/auth.py` — new; JWT creation/decode (access 24h, refresh 30d), bcrypt PIN helpers, `get_current_player` + `require_admin` FastAPI dependencies.
- `apps/api/src/routers/auth.py` — new; `POST /api/v1/auth/login` (bcrypt verify, account lockout after 5 failures, 15-min lock, slowapi 10/min rate limit), `POST /api/v1/auth/refresh` (rotation — old record revoked, new issued), `POST /api/v1/auth/logout` (revoke token, always 204).
- `apps/api/src/main.py` — import auth router, wire slowapi limiter + exception handler.
- `apps/api/tests/test_auth.py` — new; 15 tests covering login happy/error paths, lockout, refresh rotation, logout idempotency, `require_admin` 403.
- `apps/web/src/lib/tokens.ts` — new; localStorage helpers (store/get/clear access+refresh tokens + player info), JWT expiry check.
- `apps/web/src/lib/api.ts` — new; `apiFetch` wrapper with proactive silent refresh (60s before expiry), 401 retry-once with refresh, redirect to /login on session expire.
- `apps/web/src/contexts/AuthContext.tsx` — new; `AuthProvider` + `useAuth` hook (login, logout, stored player state).
- `apps/web/src/pages/LoginPage.tsx` — new; name + PIN form, error display, redirects to `/` on success.
- `apps/web/src/components/ProtectedRoute.tsx` — new; `<Outlet>` guard: unauthenticated → `/login`, non-admin on admin route → `/`.
- `apps/web/src/App.tsx` — new; react-router-dom `<BrowserRouter>` with login route, player-protected `/`, admin-only `/admin`.
- `apps/web/src/main.tsx` — rewritten; replaces design-system preview with `<App />`.

### CI status
Push to main at ee47ff2. All jobs green: lint (ruff), typecheck (mypy), unit tests (pytest), migration check, build web.

### Key facts / gotchas
- RLS policies were included in the Phase 1.1 migration (`001_core_schema.py`) with a DO-block that skips on plain Postgres and only enables them when the Supabase `auth` schema exists. No separate migration needed for Phase 0.4.
- Refresh token scheme: the JWT refresh token itself is the client secret. We store `sha256(jwt_string)` in `refresh_tokens.token_hash` for O(1) lookup without exposing the token. On refresh: decode JWT → extract `jti` (= DB record UUID), hash the incoming JWT, `WHERE id = jti AND token_hash = hash AND revoked_at IS NULL`.
- slowapi `_rate_limit_exceeded_handler` has a signature that doesn't match FastAPI's `add_exception_handler` expected type. Must add `# type: ignore[arg-type]` on that line for mypy strict mode.
- `app.dependency_overrides[get_db]` is required to mock the DB in FastAPI tests — `patch("src.routers.auth.get_db")` does NOT work because FastAPI resolves dependencies at startup, not at call time.
- The worktree branch `claude/dreamy-banach-eb8a80` was pushed to `origin main` via `git push origin HEAD:main` since the CI only runs on `main`/PRs targeting `main`.

---

### Phase 2.1 — Invite API
**Date:** 2026-05-09
**Model:** Claude Sonnet 4.6
**Status:** ✅ Complete
**Commits:** 6221dfb (worktree), b7764d8 (main via cherry-pick)
**CI:** ✅ All jobs green (run 25613178144)

**Files modified:**
- `apps/api/src/routers/admin.py` — new; `POST /api/v1/admin/invites` (create with optional display_name_hint + expires_in_days), `GET /api/v1/admin/invites` (list all, descending), `DELETE /api/v1/admin/invites/{id}` (revoke: sets is_active=False). All behind `AdminPlayer` dependency.
- `apps/api/src/main.py` — registered admin router.
- `apps/api/src/models/base.py` — added Python-level `default=_utcnow` to `TimestampMixin.created_at` so unit-tested ORM objects have valid timestamps without a DB round-trip.
- `apps/api/src/models/invite.py` — added `default=True` to `is_active` for the same reason.
- `apps/api/tests/test_invites.py` — new; 9 tests covering create (with/without hint, with/without expiry), list (multiple, empty), revoke (success, 404, already-revoked idempotency), auth guard.

**Key facts / gotchas:**
- SQLAlchemy `mapped_column(server_default=...)` does NOT set a Python attribute default — the value is only known after flush+SELECT from DB. Tests that mock `db.refresh` as a no-op need Python-level `default=` on any column the endpoint reads back post-commit, or must set attributes explicitly in the router before calling `_to_response`.
- Phase 2.1 was built on the worktree branch `claude/great-shamir-f35fa7`. That branch diverged from main (main had 2 conftest commits the worktree lacked). Used `git cherry-pick` to land on main.
- The `_to_response` helper is intentionally in the same file (not a shared util) — no other router needs it yet.

**Next:** Phase 2.2 — Join Flow API

---

## Session: 2026-05-10 — Phases 2.2, 2.3, 2.4

**Model:** claude-sonnet-4-6
**Commits:** `aa3914f` (feat), close-out commit to follow
**CI:** ✅ green (run 25625656979) — two extra fix commits needed: ruff E501 (line length) and ruff format

### Files modified
- `apps/api/src/routers/auth.py` — added `POST /auth/join`, `GET /auth/me`, `PUT /auth/me/pin`
- `apps/api/src/routers/admin.py` — added `POST /admin/players/{id}/reset-pin`, `DELETE /admin/players/{id}`
- `apps/api/src/routers/players.py` — new file: `GET /players`, `GET /players/{id}`
- `apps/api/src/main.py` — registered `players` router
- `apps/api/tests/test_join.py` — 8 tests for join flow
- `apps/api/tests/test_auth_extras.py` — 7 tests for me/pin/reset-pin
- `apps/api/tests/test_players.py` — 10 tests for player list/get/delete

### Key facts for future sessions
- `UUIDPrimaryKeyMixin.id` uses `default=uuid.uuid4` which is a column-level INSERT default in SQLAlchemy 2.x — it is NOT set on the Python object at `__init__` time. Any router that needs the new object's id before a real DB flush (e.g. to set FK on a related object) must pass `id=uuid.uuid4()` explicitly in the ORM constructor. This is done in `POST /auth/join`.
- `CurrentPlayer` type alias lives in `src/auth.py` — import it directly there, not from the router.
- `NotificationPreferences` model is in `src/models/prediction.py` (shared file with Prediction, etc.) — import from there.
- `hash_pin` is in `src/auth.py` alongside `verify_pin`; both are importable into routers.
- The venv for this project is at `apps/api/.venv` in the **main repo**, not in the worktree directory — use the absolute path `/Users/craigrobinson/wc_2026_predictor/apps/api/.venv/bin/pytest` when running tests from within a worktree.
- `GITHUB_TOKEN` is in `/Users/craigrobinson/wc_2026_predictor/.env`. The `gh` CLI is NOT installed — use `curl` + the GitHub REST API directly. See memory file `reference_github_token.md` for the full polling pattern.
- CI runs both `ruff check` (lint) and `ruff format --check` (formatting). Always run both locally before pushing: `ruff check . && ruff format .` from `apps/api/`.

**Next:** Phase 2.5 — Join & Login UI

---

## Session: 2026-05-10 — Phases 2.5 & 2.6

**Model:** claude-sonnet-4-6
**Commits:** `3b4230e` (feat), `35bcd28` (fix: empty interface + mypy dict type), `0ed5b54` (fix: tsconfig TS6305)
**CI:** ✅ green (run 25627812713) — 3 extra fix commits: eslint empty-interface, mypy type-arg, tsconfig TS6305

### Files modified / created

**Backend:**
- `apps/api/src/routers/auth.py` — added `GET /auth/invite/{token}` (public invite preview)
- `apps/api/src/routers/players.py` — added `GET /players/names` (public, no auth)
- `apps/api/src/routers/admin.py` — added `GET /admin/players` (include_deleted flag)
- `apps/api/tests/test_new_endpoints.py` — 10 new tests

**Frontend:**
- `apps/web/src/pages/JoinPage.tsx` — new: /join/:token, invite validation, PIN + timezone
- `apps/web/src/pages/LoginPage.tsx` — updated: name dropdown from API, locked-account error
- `apps/web/src/pages/admin/InvitesPage.tsx` — new: /admin/invites (list/create/copy/revoke)
- `apps/web/src/pages/admin/PlayersPage.tsx` — new: /admin/players (list/delete/reset-PIN modal)
- `apps/web/src/App.tsx` — added routes for /join/:token, /admin/invites, /admin/players
- `apps/web/src/components/ui/input.tsx` — new shadcn component
- `apps/web/src/components/ui/label.tsx` — new shadcn component
- `apps/web/src/components/ui/select.tsx` — new shadcn component (Radix)
- `apps/web/src/components/ui/dialog.tsx` — new shadcn component (Radix)
- `apps/web/src/test/JoinPage.test.tsx` — 4 vitest tests
- `apps/web/src/test/LoginPage.test.tsx` — 3 vitest tests
- `apps/web/src/test/setup.ts` — vitest setup with @testing-library/jest-dom
- `apps/web/vite.config.ts` — added vitest config block (jsdom + globals + setupFiles); changed `@` alias to `fileURLToPath(new URL('./src', import.meta.url))`
- `apps/web/package.json` — added @radix-ui/react-dialog, @radix-ui/react-label, @radix-ui/react-select, sonner, @testing-library/jest-dom
- `pnpm-lock.yaml` — updated for new packages

### Key facts for future sessions
- `GET /api/v1/players/names` is **unauthenticated** — designed for the login dropdown. Do not add auth to it.
- `GET /api/v1/auth/invite/{token}` is **unauthenticated** — returns only `{display_name_hint}`. Used by JoinPage on mount.
- JoinPage stores tokens by calling `storeTokens()` directly (import from `@/lib/tokens`) and then does `window.location.href = '/'` to force AuthProvider to re-read from localStorage. It does NOT use the `login()` from AuthContext because join returns a full token pair, not just player+pin.
- vitest must be run from `apps/web/` directory (not monorepo root) — the `vite.config.ts` is at workspace level and vitest resolves aliases relative to it.
- pnpm is at `/usr/local/bin/pnpm` but requires node ≥18 — use `PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" pnpm ...` in the worktree shell where only node 14 is on PATH.
- The `@/` alias in `vite.config.ts` uses `fileURLToPath(new URL('./src', import.meta.url))` — `'/src'` absolute path works in dev server but not in vitest (which runs from the workspace root).
- badge.tsx variants: `default` (blue), `success` (green), `error` (red), `muted` (grey), `accent` (orange) — NOT `secondary` or `destructive`.
- ESLint rule `@typescript-eslint/no-empty-object-type` rejects `interface Foo extends Bar {}` with no members — use `type Foo = Bar` instead.
- mypy requires `dict[str, str | None]` not bare `dict` for return types.

**Next:** Phase 3 — Predictions & Scoring

---

## Session: 2026-05-10 — Phases 3.1–3.4

**Model:** claude-sonnet-4-6
**Commits:** `d219ee2` (feat: Phases 3.1–3.4 Match API, Groups API, Schedule UI, Group Standings UI), `6821d05` (fix: mypy typed generics + test_group_columns standings_override)
**CI:** ✅ green (run 25640340275) — 1 fix commit after first run failed (mypy + pytest)

### Files modified / created

**Backend:**
- `migrations/versions/006_groups_standings_override.py` — adds JSONB `standings_override` column to groups table
- `apps/api/src/models/group.py` — added `standings_override: Mapped[Any]` JSONB column
- `apps/api/src/routers/matches.py` — new: GET /api/v1/matches, /upcoming, /live, /{id} with team resolution
- `apps/api/src/routers/groups.py` — new: GET /api/v1/groups, /groups/{name} with FIFA tiebreaker (points→GD→GF→H2H)
- `apps/api/src/routers/admin.py` — added POST /api/v1/admin/groups/{name}/override-standings
- `apps/api/src/main.py` — registered matches and groups routers
- `apps/api/tests/test_matches.py` — 7 tests (auth guard, list, list with stage filter, upcoming, live, get by id, invalid stage)
- `apps/api/tests/test_groups.py` — 11 tests (6 unit tests for _compute_standings, 5 HTTP endpoint tests)
- `apps/api/tests/test_models.py` — updated test_group_columns to include standings_override

**Frontend:**
- `apps/web/src/lib/types.ts` — new: TeamRef, MatchResponse, TeamStanding, GroupResponse types
- `apps/web/src/lib/supabase.ts` — new: Supabase JS client singleton
- `apps/web/src/hooks/useCountdown.ts` — new: countdown hook (1s interval) returning CountdownParts
- `apps/web/src/components/NavBar.tsx` — new: sticky nav with brand + NavLinks
- `apps/web/src/components/Layout.tsx` — new: NavBar + Outlet wrapper
- `apps/web/src/pages/SchedulePage.tsx` — new: /schedule — matches by timezone date, countdown, stage filter
- `apps/web/src/pages/GroupsPage.tsx` — new: /groups — all groups with Supabase Realtime subscription
- `apps/web/src/pages/GroupDetailPage.tsx` — new: /groups/:name — standings table with H2H highlighting
- `apps/web/src/App.tsx` — rewrote with QueryClientProvider, Layout, new routes
- `apps/web/.env.local` — created (not committed) with VITE_SUPABASE_URL/ANON_KEY

### Key facts for future sessions
- `_apply_h2h` in groups.py has a guard `if len(sorted_codes) > 1` — needed to avoid IndexError on empty groups.
- All typed generics in groups.py use `dict[str, Any]` / `dict[str, dict[str, Any]]` — bare `dict` fails mypy strict.
- FastAPI returns **401** (not 403) when the bearer token is missing — auth guard tests must use `assert resp.status_code in (401, 403)`.
- Supabase Realtime subscription: subscribe to `postgres_changes` on `matches` table, invalidate React Query cache key `['groups']` or `['group', name]` on any event.
- `apps/web/.env.local` is gitignored — Supabase URL/anon key come from the main `.env`. Copy them manually to the worktree's `.env.local` when starting a new session.
- vitest must run from `apps/web/` (not monorepo root): `PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" pnpm --dir apps/web test`.
- badge.tsx variants in this project: `default`, `success`, `error`, `muted`, `accent` — NOT `secondary` or `destructive`.

**Next:** Phase 3.5 — Match Lock Scheduler & Reschedule Handling

---

## 2026-05-10 — Phase 3.5: Match Lock Scheduler & Reschedule Handling
**Model:** Opus 4.7
**Commits:** `dba69df` (feat), `1323b87` (mypy fix)
**CI:** ✅ all 5 jobs green (lint, mypy, tests, migration check, web build)

### What changed
**Backend:**
- `apps/api/src/scheduler.py` — new: APScheduler `AsyncIOScheduler` with `lock_due_matches` job. Selects scheduled matches with `kickoff_utc ≤ now` and `deleted_at IS NULL`, transitions them to `locked`, sets `locked_at`, and writes one `audit_log` row per lock (`action_type=predictions_locked`, `actor_type=system`).
- `apps/api/src/main.py` — lifespan starts the scheduler when `settings.scheduler_enabled` is True and shuts it down on exit (`wait=False`).
- `apps/api/src/config.py` — new `scheduler_enabled: bool = True` setting.
- `apps/api/src/routers/admin.py` — three new endpoints under `/api/v1/admin/matches/{id}`:
  - `POST /reschedule` — body `{ kickoff_utc }`; sets `original_kickoff_utc` if not already set; if status=locked and `locked_at < new_kickoff`, re-opens to `scheduled` and clears `locked_at`; writes `kickoff_changed` audit row.
  - `POST /postpone` — body `{ reason }`; sets status=postponed and `postponed_reason`; writes `match_postponed` audit row.
  - `POST /cancel` — sets status=cancelled; writes `match_cancelled` audit row.
- `apps/api/tests/test_scheduler.py` — 7 tests: lock logic with mock session+clock, audit row contents, no-op when nothing due, scheduler config (job id + 1-min interval), lifespan start/stop with `scheduler_enabled=True/False`.
- `apps/api/tests/test_admin_matches.py` — 9 tests: reschedule (basic, preserves existing original, re-opens locked, 404), postpone (basic, 404), cancel (basic, 404), auth guard.

### Key facts for future sessions
- The lifespan lazy-creates the scheduler and only starts it when `settings.scheduler_enabled` is True. Httpx `ASGITransport` does **not** drive lifespan by default, so existing tests never start a real scheduler.
- `AsyncIOScheduler.running` doesn't flip to False synchronously after `shutdown(wait=False)`; need an `await asyncio.sleep(0)` to let the event loop process the shutdown callback. Tests rely on this.
- The architecture doc's text "locked_at > new kickoff" is functionally inverted; implementation uses `locked_at < new_kickoff` (re-open when rescheduling forward past the lock instant) — matches user-facing intent.
- mypy 1.x (local) flags `apscheduler` as `[import-untyped]`; mypy 2.x (CI) silences it via `ignore_missing_imports=true` but then complains about `unused-ignore`. Use combined `# type: ignore[import-untyped,unused-ignore]` for both.
- `coalesce=True, max_instances=1` on the lock job — if the API hangs, the scheduler skips overlapping runs instead of queueing them.

---

## Phase 4.2 — My Predictions UI
**Date:** 2026-05-10
**Model:** claude-sonnet-4-6
**Commits:** 786be84
**CI:** ✅ green

### Files modified
- `apps/web/src/lib/types.ts` — added `PredictionResponse` + `PointsBreakdown` types
- `apps/web/src/pages/PredictionsPage.tsx` — new: `/predictions` page — group tabs A–L, prediction card per match, debounced autosave (800 ms), save-all button per group, points badge once result entered, locked/postponed/cancelled inputs disabled with visual state
- `apps/web/src/test/PredictionsPage.test.tsx` — new: 10 vitest tests (tab rendering, editable/disabled inputs, voided badge, points badge, autosave PUT call, save button state)
- `apps/web/src/App.tsx` — added `/predictions` route + dashboard card
- `apps/web/src/components/NavBar.tsx` — added "Predict" nav item

### Key facts for future sessions
- `@testing-library/jest-dom` was missing from the installed packages — added it as a devDep. It's now in `apps/web/package.json` and the lockfile.
- vitest localStorage stubs must use the correct keys from `tokens.ts`: `wc2026_access`, `wc2026_refresh`, `wc2026_player` — NOT `wc_access_token` / `wc_player`.
- `isAccessTokenExpiringSoon()` parses the JWT — tests need a fake JWT with a future `exp`, not just `'fake-token'`. Pattern: `eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwMSIsImV4cCI6OTk5OTk5OTk5OX0.fake`
- The predictions page uses debounced autosave (800 ms) per match ID stored in a `useRef<Record<string, ReturnType<typeof setTimeout>>>`. Save-all skips matches with empty inputs.
- PUT `/api/v1/predictions/{match_id}` returns 409 `PREDICTION_LOCKED` when match is not `scheduled` — the component only enables inputs for `scheduled` status.

**Next:** Phase 4.3 (TBD — check architecture doc)

---

## Phase 4.3 — Prediction Card Polish

**Date:** 2026-05-11
**Model:** claude-sonnet-4-6
**Commits:** 5767257
**CI:** ✅ green

### Files modified
- `apps/web/src/pages/PredictionsPage.tsx` — ScoreInput: Bebas Neue font (`font-display text-3xl`) + ▲/▼ spinner buttons; `PointsBadge` component with count-up animation; lock indicator (padlock icon + live countdown) for `locked` matches; "Not predicted yet" warning for empty editable cards; deadline warning (orange border + kickoff text) when < 1hr to kickoff; imported `useCountdown` hook + `Lock` from lucide-react
- `apps/web/src/test/PredictionsPage.test.tsx` — 7 new tests: lock indicator, not-predicted warning, deadline warning, spinner ▲/▼ clicks, count-up badge; fixed existing tests to use exact aria-label strings (regex matched spinner buttons as false positives)

### Key facts for future sessions
- `getByLabelText(/pattern/i)` regex will now match spinner button labels ("Increment X", "Decrement X") as well as the input — always use exact string `'Home score for match N'` for input queries.
- `vi.useFakeTimers()` breaks `waitFor` (which uses real `setTimeout` internally). For time-dependent tests: mock `Date.now` only via `vi.spyOn(Date, 'now').mockReturnValue(...)`. For animation tests: just use `waitFor` with a longer timeout — the count-up finishes in ≤ 600ms.
- The `PointsBadge` component starts from 0 and increments at `Math.max(30, Math.min(120, 600/points))` ms per step. For 5 pts that's 120ms/step × 5 = 600ms total.
- `formatCountdown` is a module-level helper in PredictionsPage.tsx — used by both the lock indicator and the deadline warning.

**Next:** Phase 4.4 (check architecture doc)

---

## Phase 4 Integration Fix

**Date:** 2026-05-11
**Model:** claude-sonnet-4-6
**Commits:** ff5cc6a
**CI:** ✅ green

### What happened
Phases 4.1 (Prediction API) and 4.4 (Match Detail Page) were built in a separate worktree session (`sweet-einstein-5ff706`) and merged to remote main by the user as commit `1bf2fd8`. The current worktree was behind that merge. Cherry-picked the feature commits and resolved a one-line import conflict in App.tsx.

Discovered that Phase 4.1 renamed `PredictionResponse.points` → `points_awarded` and dropped `points_breakdown`. Updated the three test fixtures in PredictionsPage.test.tsx to match the actual type shape.

### Files modified
- `apps/web/src/test/PredictionsPage.test.tsx` — fixtures updated: `points` → `points_awarded`, `points_breakdown` removed
- `wc2026-architecture.md` — Phase 4.1 and 4.4 marked ✅

### Key facts for future sessions
- `PredictionResponse` (in types.ts) has `points_awarded: number | null` — NOT `points`. No `points_breakdown` field.
- `noSubmission` in PredictionCard is `isCompleted && !prediction` (no prediction object at all), not a `no_prediction` flag.
- All four Phase 4 sub-phases are now merged to main and CI-green.

---

## Phase 5A — Admin Results API + football-data.org Client

**Date:** 2026-05-11
**Model:** claude-sonnet-4-6
**Commits:** e7164ed
**CI:** ✅ green

### Files modified
- `apps/api/src/routers/admin.py` — added `POST /api/v1/admin/results/{match_id}` (manual entry) and `PUT /api/v1/admin/results/{match_id}` (override); new schemas `ResultRequest`, `ResultResponse`; audit_log writes on every call
- `apps/api/src/services/__init__.py` — new package (empty)
- `apps/api/src/services/football_data.py` — `FootballDataClient` with typed Pydantic models (`FDMatch`, `FDScore`, `FDTeam`, `FDMatchesResponse`, `FDMatchStatus`); 429 exponential backoff; `FootballDataRateLimitError` / `FootballDataServerError`
- `apps/api/tests/test_admin_results.py` — 15 HTTP-layer tests (mock DB, always run) + 2 DB-backed integration tests (skip without DATABASE_URL)
- `apps/api/tests/test_football_data_client.py` — 13 unit tests covering all status types, 429 retry path, 5xx error, auth header injection

### Key facts for future sessions
- The scoring trigger fires on NULL→non-NULL transition for `actual_home_score`/`actual_away_score`. The override (PUT) nulls out scores first via `db.flush()`, then re-sets them — this is required to re-trigger the WHEN condition.
- `FootballDataClient` always injects `X-Auth-Token` into `.headers` even when a custom httpx.AsyncClient is passed (needed for test transport injection without losing auth).
- Tests run with `PYTHONPATH=apps/api` — the venv is at `/Users/craigrobinson/wc_2026_predictor/apps/api/.venv/` and is NOT symlinked into the worktree.
- Services live in `apps/api/src/services/` — not yet registered in `main.py` (the client is instantiated on demand, no global singleton yet).

---

## Phase 5.3 — Auto Result Fetch Job

**Date:** 2026-05-11
**Model:** claude-opus-4-7
**Commits:** 6eb88fa
**CI:** ✅ green (first run)
**Merged to main:** yes (fast-forward)

### What shipped
A 5-minute APScheduler IntervalTrigger that pulls the WC competition feed
from football-data.org and applies a per-match status delta with row-level
locks. Idempotent at the DB level (skips when `result_source IS NOT NULL`),
race-safe (`SELECT ... FOR UPDATE`), and audit-logged with
`actor_type=system`. Three consecutive API failures write
`auto_sync_failed` notifications to every admin profile.

### Files modified
- `apps/api/src/services/result_sync.py` — new: `sync_results()` driver +
  per-status appliers (`_apply_finished`, `_apply_postponed`,
  `_apply_cancelled`, `_apply_live`, `_apply_kickoff_drift`) +
  `_record_failure` with admin-alert escalation. Module-level
  `_consecutive_failures` counter resets to 0 on every successful run.
- `apps/api/src/scheduler.py` — registered `sync_results` job:
  `interval=5min`, `id=sync_results`, `coalesce=True`, `max_instances=1`.
- `apps/api/tests/test_result_sync.py` — new: 13 unit tests covering all
  acceptance criteria (FINISHED write+audit, idempotent no-op,
  manual-entry race skip, POSTPONED/CANCELLED/IN_PLAY transitions,
  kickoff drift updates + preserves original_kickoff_utc, no-drift no-op,
  single-failure audit row, three-consecutive-failure admin alert,
  counter reset on success, unknown FD ID silent skip, scheduler job
  registration).

### Key facts for future sessions
- The "lock-job re-registration on kickoff change" requirement is
  satisfied by the existing periodic `lock_due_matches` job (Phase 3.5
  design) — there's no per-match DateTrigger to cancel/re-register, so
  the kickoff_utc DB update alone suffices. The next 1-minute tick of
  the lock job picks up the new kickoff naturally.
- `_consecutive_failures` is process-local. Across a Railway worker
  restart the streak resets — acceptable for this phase, would need a
  `system_state` table to survive restarts.
- The FINISHED handler only writes when local status ∈ {locked, live,
  completed}; if the local match is still `scheduled` (lock job hasn't
  fired yet) the result is intentionally deferred. The next 5-min tick
  retries once the lock job catches up.
- `FootballDataError` (base class) catches both `*RateLimitError` and
  `*ServerError`. Failure path commits its own audit row in a separate
  session-factory transaction so the main loop's commit still runs on
  the happy path.
- Tests use a MagicMock-based session, NOT a real Postgres. The
  `SELECT ... FOR UPDATE` and BEFORE/AFTER scoring triggers are only
  exercised in CI's integration job — guard tests with `db_engine`
  fixture when adding Postgres-specific coverage.
- venv lives at `/Users/craigrobinson/wc_2026_predictor/apps/api/.venv/`,
  not in the worktree. Use absolute paths to invoke it
  (`PYTHONPATH=<worktree>/apps/api .venv/bin/python -m pytest <tests>`)
  rather than `cd` — `cd` outside the worktree root triggers a sandbox
  block in this environment.

**Next:** Phase 5.4 — Admin Sync UI (🟢 Sonnet 4.6)

---

## Phase 5.4 — Admin Sync UI
**Commits:** f60307c · CI ✅

### Key facts for future sessions
- `GET /api/v1/admin/sync/status` derives last-run from audit_log (actor_type=system, action_type ∈ {result_auto_fetched, sync_failed, kickoff_changed, sync_triggered}). `next_run_at` comes from `request.app.state.scheduler.get_job("sync_results").next_run_time`.
- `POST /api/v1/admin/sync/trigger` calls `await sync_results()` directly then returns updated status — no separate audit write needed.
- `GET /api/v1/admin/results` lists completed matches ordered by result_entered_at DESC, limit 100. Team query is conditionally skipped when all home/away team IDs are None (all placeholder matches).
- `/admin` route now exists as `AdminDashboardPage`; Phase 5.6 expanded it.

**Next:** Phase 5.5 — Points Reveal (🟢 Sonnet 4.6)

---

## Phase 5.5 — Points Reveal
**Commits:** f60307c · CI ✅

### Key facts for future sessions
- sonner `<Toaster>` added to `App.tsx` (position=bottom-right, richColors, closeButton). sonner was already in package.json.
- Realtime subscription in `PredictionsPage` uses channel name `predictions-match-results` on `matches` table UPDATE. Detects null→non-null transition via `prevScoresRef` (a ref tracking which match IDs had null scores after the last `matches` query render).
- On result arrival: invalidates `['matches','group']`, then `fetchQuery` for `['predictions','me']` (not just invalidate — needs the fresh data synchronously to build the toast). Card highlight lasts 2500 ms via `highlightedMatchIds` Set state.
- `PredictionCard` now takes a `highlighted` boolean prop; `GroupPanel` takes `highlightedMatchIds: Set<string>` and passes it down.

**Next:** Phase 5.6 — Admin Dashboard (🟢 Sonnet 4.6)

---

## Phase 5.6 — Admin Dashboard
**Commits:** f60307c · CI ✅

### Key facts for future sessions
- `GET /api/v1/admin/dashboard` runs 5-6 DB queries (players, upcoming locks, pending results, optional team map, audit, then 2 sync-status queries). Team query is skipped when all lock+pending matches have null team IDs — test mocks must account for this (6 side-effects, not 7).
- "Pending results" = locked or live matches with `result_source IS NULL`. Does NOT include manually-delayed completed matches.
- "Active players" = all profiles where deleted_at IS NULL (includes admins).
- Dashboard refetches every 30 s (staleTime 15 s).

**Next:** Phase 5.7 — Leaderboard Page (🟢 Sonnet 4.6)

---

## Phases 6.1–6.4 — Leaderboard API, UI, History Chart, Round Leaderboard
**Commits:** 9f830ed · CI ✅

### Key facts for future sessions
- Migration 007 adds `profiles.is_active BOOLEAN NOT NULL DEFAULT TRUE`. Separate from `deleted_at` (hard-delete). Leaderboard filters `is_active=true` by default; pass `?include_inactive=true` to see all.
- Round leaderboard uses a subquery to pre-filter predictions by stage before aggregating — direct outer join would sum all prediction points regardless of stage.
- Recharts Tooltip `formatter` prop: both `value` (ValueType | undefined) and `name` (NameType | undefined) must not be typed as `string`/`number` — let TS infer, handle undefined with `?? ''`.
- ESLint no-unused-expressions fires on ternaries used as statements (`cond ? a : b` as a statement). Pattern: use `if/else` instead.
- Worktree node_modules must be symlinked to parent repo for Vite dev server: `ln -sfn <parent>/apps/web/node_modules <worktree>/apps/web/node_modules`.

**Next:** Phase 6.5 — Predictions Lock UI (🟢 Sonnet 4.6)

---

## Phase 7.1 — Knockout Match Creation API
**Commits:** e607047 · CI ✅

### Key facts for future sessions
- R32 bracket is a hardcoded `BRACKET_R32: list[tuple[str, str]]` in `apps/api/src/services/knockout_advancement.py` using slot labels `1A..1L`, `2A..2L`, `T1..T8`. Each label is used exactly once; admin can reshuffle pairings per-match later — the architecture explicitly leaves this open.
- Best-3rd ranking sorts by `(-pts, -gd, -gf, team_code)` — the team_code tiebreak is deterministic, not FIFA-spec.
- `_FD_R32_STAGE_LABELS = {"LAST_32", "ROUND_OF_32", "PRELIMINARY_ROUND"}` — football-data.org has no confirmed 2026 R32 label yet; we accept any of the three.
- Endpoint maps service exceptions to HTTP: `AlreadyAdvancedError → 409`, `GroupStageIncompleteError → 422`, `MissingKickoffsError → 502`, `FootballDataError → 502`.
- One `AuditLog` row per created match (16 total) with `action_type=knockout_advanced` and the slot labels + team codes in `changes`.
- CI gotcha: `.github/workflows/ci.yml` only triggers `on: push` for `main` and `claude/**`. A `feat/*` branch won't fire CI on push — open a PR or mirror to `claude/<name>` (and the personal access token in `.env` lacks PR-creation scope, so use the mirror trick).

**Next:** Batch 3 — Phases 7.2 & 7.4 (🟢 Sonnet 4.6)

---

## Phases 7.2, 7.4 — Knockout Prediction API + UI
**Commits:** 0e07f38, 7048736, c7165dc, 40e1077 · CI ✅

### Key facts for future sessions
- Round-level lock: `PUT /api/v1/knockout-predictions/{match_id}` checks if ANY match in the same stage is no longer `scheduled`. If so, the whole round is locked (409 `PREDICTION_LOCKED`). This differs from group-stage which is per-match.
- `KnockoutPrediction` model has no `deleted_at` field — queries don't filter on it (unlike `Prediction`).
- `predicted_winner_id` validated against `match.home_team_id` / `away_team_id` only when both are non-null; future rounds with TBD teams bypass validation.
- Frontend fetches ALL matches (`GET /api/v1/matches`) and filters knockout stages client-side; group + winner stages excluded.
- CI check: always use `claude/` branch prefix (not `feat/`) — `feat/` branches don't trigger the workflow.
- Two ruff CI failures on first push: long import line (E501/I001 in `main.py`) and unformatted router (format check). Fixed in c7165dc and 40e1077.

**Next:** Phase 7.3 — Bracket Visualisation (🔴 Opus)

---

## Phase 7.3 — Bracket Visualisation
**Commits:** c066e2d · CI ✅

### Key facts for future sessions
- Per-player accent colour is computed by hashing `player.id` into the shared 15-colour `PALETTE` (same array as `LeaderboardHistoryPage`). The `Profile` model has no `avatar_color` field — when one is added later, replace `playerColor()` in `BracketPage.tsx` with the stored colour.
- Bracket SVG uses `<foreignObject>` for each match box so Tailwind classes work inside the SVG — handy when a future round needs richer hover/focus states.
- Round-to-round pairing is **schematic only** — adjacent match_number pairs feed the next round in order. The architecture lets admin reshuffle R16+ pairings; if/when shuffling happens, the connector lines will look misleading. Fix would be a real bracket graph (parent_match_id on matches).
- BracketPage subscribes to NO realtime channel — picks are read-only here. Updates flow through the existing `KnockoutPredictionsPage` invalidations on `['knockout-predictions', 'me']`.
- Worktree dev-server gotcha (not committed): vite resolves project root from `process.cwd()`. `bash apps/web/dev.sh` from a parent CWD ends up serving parent files; the worktree's dev.sh must `cd "$(dirname "$0")"` (or be invoked from inside apps/web) for HMR to pick up worktree edits.

**Next:** Batch 5 — Phases 8.1, 8.2 — Specials API + UI (🟢 Sonnet 4.6)

---

## Phases 8.1, 8.2 — Special Predictions API + UI
**Commits:** c4234e8, 0184b01, 17a356d · CI ✅

### Key facts for future sessions
- Lock sentinel is the earliest `kickoff_utc` among all `stage='group'` matches (not a config value). `GET /specials` returns `lock_at` and `is_locked` so the frontend doesn't need to re-query matches.
- `GET /specials/all` returns 403 pre-lock and 200 post-lock — designed for the comparison view. No separate "reveal" step needed.
- `POST /admin/specials/award` sets `points_awarded` on ALL predictions for the type (correct → N pts, wrong → 0 pts). Can be re-run to correct an error.
- Golden boot matching is case-insensitive `.strip().lower()` on both sides — intentional, keeps it simple.
- mypy strict caught `dict[str, dict]` (bare unparameterized generic) in `get_all_specials`; fixed to `dict[str, PlayerSpecialsItem]`.
- Frontend team picker sources teams from `GET /api/v1/groups` (standings), not a dedicated `/teams` endpoint.

**Next:** Batch 6 — Phases 9.1, 9.2, 9.3 — Stats API + profile page + H2H API (🟢 Sonnet 4.6)

---

## Phases 9.1, 9.2, 9.3 — Stats API + Player Profile UI + H2H API
**Commits:** e5d04e7 · CI ✅

### Key facts for future sessions
- Stats accuracy/exact rate uses only group predictions (they have `points_breakdown` with `result`/`exact` keys); knockout predictions have no score breakdown so they only count toward total_points/streak/best_worst_round.
- `GET /players/{player_id}/predictions/recent` added to players router (not stats router) — returns last N settled group predictions with team names via a batch team fetch.
- `GET /compare/{a}/{b}` allows soft-deleted players (no `deleted_at` filter on profile lookup) so historical predictions remain visible after a player is removed.
- H2H "winner" per match is purely by `points_awarded` comparison; a missing prediction from one side is treated as 0 pts (player A wins that match by default).
- Frontend H2H mini table on PlayerProfilePage uses stats-endpoint data (no Phase 9.3 API); Phase 9.4 will build the full interactive compare UI with the compare API.
- CI branch rule: use `claude/` prefix — `feat/` branches don't trigger the workflow (unchanged from prior sessions).

**Next:** Batch 7 — Phase 9.4 — H2H UI (🔴 Opus)

---

## Phase 9.4 — Head-to-Head UI
**Commits:** c20d164 · CI ✅

### Key facts for future sessions
- `/compare` state lives entirely in URL search params (`?a=&b=`) — both the dropdown pickers and the leaderboard long-press navigation write/read the same params, so deep links work and there's no in-component state to keep in sync.
- Default-A-to-current-user runs only when both `a` and `b` are empty (one-time effect on mount); switching A back to "Select…" via the dropdown won't re-trigger the default.
- `useLongPress` hook uses pointer events, 500 ms default, 10 px move-cancel threshold, suppresses the trailing click after a long-press fires, and suppresses the context menu only when fired (so right-click still works on links inside the row).
- `LeaderboardRow` was extracted as a sub-component so each row can call `useLongPress` legally; the nested player-name `<Link>` calls `stopPropagation` on both pointerdown and click so it can't start the long-press timer.
- Winner highlight is `bg-primary/10` + `text-primary` on the points number — draws leave both sides unhighlighted; the per-row marker glyph (`◀`/`▶`/`=`) is purely cosmetic.

**Next:** Batch 8 — Phases 10.1, 10.2, 10.3, 10.4 — PWA + Web Push end-to-end (🟢 Sonnet 4.6)

---

## Phases 10.1, 10.2, 10.3, 10.4 — PWA + Web Push end-to-end
**Commits:** 3a3d7ae, eb788d2, abeb289, 85d369f, 0a2b75e, 65fa3b8 · CI ✅

### Key facts for future sessions
- `vite-plugin-pwa` must use `strategies: 'injectManifest'` (not `generateSW`) so the custom `sw.ts` can handle `push` events; `workbox:` config block is not valid under injectManifest.
- `session_factory` in scheduler/result_sync tests must be `MagicMock()` (not `AsyncMock()`); an `AsyncMock` returns a coroutine when called, breaking `async with session_factory() as session`.
- Existing tests that mock `session.execute` with a fixed `side_effect` list broke when notification trigger calls added extra `execute()` calls — fixed by `autouse=True` fixtures that patch the trigger functions in `test_scheduler.py`, `test_result_sync.py`, `test_join.py`, `test_specials.py`, `test_admin_matches.py`.
- `send_notification` is called with positional args (not kwargs) — test assertions must use `call_args.args[2]` for `notification_type`, `.args[3]` for title, `.args[4]` for body.
- CI uses mypy 2.1.0 which ships pywebpush stubs; `# type: ignore[import-untyped]` became unused — silenced with `# type: ignore[import-untyped,unused-ignore]`.
- Quiet hours overnight window (e.g. 23:00–07:00): `_is_quiet` checks `t >= start or t < end`; daytime window uses `start <= t < end`.

**Next:** Batch 9 — Phases 11.1, 11.3, 11.4, 11.5 — Dashboard + optimistic UI + backup + runbooks (🟢 Sonnet 4.6)

---

## Phases 11.1, 11.3, 11.4, 11.5 — Dashboard + Optimistic UI + Backup + Runbooks
**Commits:** 94e809c · CI ✅

### Key facts for future sessions
- Dashboard lives in `DashboardPage.tsx` (extracted from inline `Dashboard` fn in `App.tsx`); three parallel queries: leaderboard, `GET /matches/upcoming?n=1`, `GET /players/{id}/predictions/recent?limit=1`.
- Mini leaderboard appends the current player's row below a `···` separator if they're outside the top 5 — no separate stat card needed.
- Optimistic saves: `LocalPrediction.error` field removed; on `savePrediction` failure, local state rolls back to `queryClient.getQueryData(['predictions', 'me'])` + `toast.error`.
- Backup service (`src/services/backup.py`) uses `pg_dump --format=plain`; filename regex `wc2026_\d{8}_\d{6}\.sql` guards path traversal at the service layer; Railway `/tmp` is ephemeral — download backups immediately after creation.
- Daily backup job: `run_scheduled_backup` cron at 03:00 UTC in `scheduler.py`; requires `pg_dump` in PATH (verify in Railway Docker image).

**Next:** Batch 10 — Phase 11.2 — Offline service worker (🔴 Opus)

---

## Phase 11.2 — Offline Support
**Commits:** 7073c61 · CI ✅

### Key facts for future sessions
- SW route matcher is by `url.pathname` (not full URL) so it works with both same-origin dev (`/api/v1/...` via vite proxy) and cross-origin prod (`VITE_API_URL`) without an origin allowlist.
- API caching split: `StaleWhileRevalidate` for `matches|groups` (shared, 24h, 80 entries); `NetworkFirst` with 3s timeout for per-player `predictions|leaderboard|players|stats|specials|knockout-predictions` (1h, 80 entries). `CacheableResponsePlugin` restricts to 200s so 401/403 are never poisoned into the cache.
- `offlineQueue.flushQueue()` is in-flight-coalesced via a module-scoped promise — concurrent flushes (e.g. `online` event firing twice, or mount-flush racing event-flush) return the same promise rather than double-sending.
- `useOfflineQueue` invalidates `['predictions','me']` after a successful flush so RQ refetches authoritative server state and clears the dirty local optimistic value.
- PredictionsPage `savePrediction` checks `!navigator.onLine` BOTH before `apiFetch` (skip the call entirely) AND in the catch (fetch failed mid-request). Otherwise the existing rollback + error toast path runs.
- Banner has three states keyed off `(isOnline, pendingCount)`: hidden / amber "offline — N queued" / green "syncing N pending…". Test selector: `data-testid="offline-banner"`.

**Next:** Batch 11 — Phases 11.6, 11.7 — A11y sweep + E2E tests (🟢 Sonnet)

---

## Phases 11.6, 11.7 — Accessibility Pass + Playwright E2E Tests
**Commits:** be1075c, 8dbf591, 0342ab6 · CI ✅

### Key facts for future sessions
- Supabase client in `src/lib/supabase.ts` must have `?? fallback` values — `createClient(undefined, undefined)` throws at module load time and crashes the entire React module graph. CI never sets `VITE_SUPABASE_URL`.
- Playwright route matching is LIFO: register `catchAllApi()` FIRST in every test, then specific handlers after — last registered wins for a given URL.
- jest-axe tests disable the `color-contrast` rule (`AXE_CONFIG`) because jsdom can't resolve CSS custom properties; all structural/ARIA rules remain enabled.
- `CardTitle` uses `<h2>` (not `<h3>`) to satisfy axe heading-order — skipping h2 is a violation.
- E2E `e2e/` dir excluded from vitest via `exclude: ['**/e2e/**']` in `vite.config.ts`; without this, vitest tries to run Playwright spec files.
- `getByRole('spinbutton', { name: '…' })` targets `<input type="number">` uniquely; `getByLabel` was ambiguous because ▲/▼ increment buttons share the same label prefix.

**Next:** Batch 12 — Phase 11.8 — Visual Polish & Empty States (🔴 Opus)

---

## Phase 11.8 — Visual Polish & Empty States
**Commits:** 8382f34 · CI ✅

### Key facts for future sessions
- All player + admin routes are `React.lazy()`-imported in `App.tsx`; **Layout is also lazy** because it transitively pulls framer-motion (PageTransition) + supabase realtime (OfflineBanner) — keeping these out of the unauth `/login` chunk is what hit mobile Lighthouse Perf 95.
- `vite.config.ts` `manualChunks` only carves out `react-vendor` + `query` — framer-motion and recharts are intentionally NOT in manualChunks because Vite injects a `<link rel="modulepreload">` for every named manual chunk on the entry, which would eagerly load them on `/login` and tank perf.
- `Skeleton` (`components/ui/skeleton.tsx`) has `role="status" aria-busy="true" aria-label="Loading"` baked in — page-level skeleton groups should add `aria-label` on the wrapper too so the inner repeats don't all announce "Loading".
- `ErrorBoundary` in `Layout` is `key={location.pathname}` so a thrown error on one page is automatically reset by navigation to another — without the key, the boundary state persists across routes.
- Tests asserting empty/loading copy break easily when EmptyState text changes; new pattern (see `PredictionsPage.test.tsx`) uses `container.querySelector('[aria-label="Loading X"]')` instead of brittle text matches.
- Lighthouse `--preset=desktop` skips the harsh mobile throttling — useful sanity check (100/100/96/100) but mobile is the canonical target for this PWA.

**Next:** All 59 phases shipped — tournament starts 11 June 2026. Remaining work is deployment + real-world testing, not new phases.

---

## Batch D2 — Provision Staging
**Commits:** 28f61b7 · no CI (infra/docs — no test suite changes)

### Key facts for future sessions
- Railway cannot reach Supabase direct host (`db.<ref>.supabase.co:5432`) — must use Session pooler (`aws-0-<region>.pooler.supabase.com:5432`) with username `postgres.<project-ref>` and `?prepared_statement_cache_size=0` appended.
- VAPID private key must be stored as a base64url raw scalar (no PEM headers, single line) — Railway corrupts newlines in multi-line env vars, breaking pywebpush with ASN.1 parse error. Use the `cryptography` library directly; `py_vapid` API is broken on newer installs.
- Root `Dockerfile` required so Railway's Docker builder runs instead of railpack, which misidentifies the monorepo as Node (sees `pnpm-workspace.yaml`). Run `railway up` from `apps/api` (not repo root).
- `leaderboard_snapshots.created_at` was missing from migration 003 despite `TimestampMixin` — fixed in migration 008; required Railway redeploy to clear asyncpg prepared statement cache.
- FK ordering fix needed in both `bootstrap_admin.py` and `auth.py` join endpoint: flush profile row before inserting `notification_preferences`.
- `last_sync_at` was never updating because no audit log row was written on sync runs — fixed in `result_sync.py`; `sync_triggered` action type now written after every successful sync.

**Next:** Batch D3 — Staging soak (exercise all features; invite 1–2 friends; verify iOS PWA push, offline resync, first 03:00 UTC backup)

---

## Batch D4 — Provision Production
**Commits:** 46b4a1a · no CI (infra — no test suite changes)

### Key facts for future sessions
- Prod Supabase project is the original one created at project start (ref: `kznxjyaanotrejcevngy`) — DB was already at migration 005 + seeded; upgraded to head (008) in-session.
- Prod Railway project: `wc2026-api-prod` / service `wc2026-api` — domain `wc2026-api-production-a0f4.up.railway.app`.
- Prod Vercel project: `wc2026-prod` — domain `wc2026-prod.vercel.app`.
- `startCommand` in `railway.toml` must NOT be set — Railway runs it without shell expansion, so `$PORT` is passed literally and uvicorn fails. Dockerfile CMD handles port correctly with `sh -c`. Fixed in 46b4a1a.
- `railway up` requires `CI=true --path-as-root --detach --json` to run non-interactively from a non-TTY shell.
- Vercel env vars must be set via REST API (`/v10/projects/{id}/env`) when `vercel env add` fails non-interactively.
- Admin PIN for prod Craig reset to 2102 during this session.

**Next:** Batch D3 → D5 — Production soak + open invites (exercise prod, invite players once stable)

---

## Review batch R1 — Backend hardening
**Commits:** 0417772, 1393c38, 87b1f28 · CI ✅

### Key facts for future sessions
- `jwt_access_secret`/`jwt_refresh_secret` are now required fields (no default); env vars must be set. CI test-api job sets `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` explicitly. `settings = Settings()` carries `# type: ignore[call-arg]` since mypy can't see pydantic-settings env-var injection.
- `SecurityHeadersMiddleware` reads `settings.environment` at request time (not startup), so monkeypatching `src.middleware.settings.environment` works in tests.
- Three `test_result_sync` noop assertions were pre-existing failures on main (not introduced by R1) — fixed by filtering `sync_triggered` from the AuditLog assertion; `sync_results` always writes one for observability even when count=0.

**Next:** Review batch R2 — Scoring integrity (🔴 Opus, extended thinking)

---

## Review batch R2 — Scoring integrity
**Commits:** 5bf2412, cce2606 · CI ✅

### Key facts for future sessions
- Migration 009 drops the AFTER trigger's `WHEN (OLD NULL → NEW not-NULL)` clause; any update to `actual_*_score` now re-fires `matches_score_results`. The BEFORE trigger keeps its WHEN so `result_entered_at` still means "first entry time".
- `apps/api/src/services/leaderboard.py::recompute_leaderboard_snapshot` is the single non-trigger entry point — it calls `session.flush()` first so callers can rely on it picking up in-memory ORM mutations (e.g. `award_specials` mutating `points_awarded` before the helper runs).
- `cancel_match` zeroes `predictions.points_awarded` and `knockout_predictions.points_awarded` for the cancelled match (single UPDATE each), then calls the helper — without this the cancelled match keeps awarding points (spec §6.13).
- Tests using `db_conn`: every trigger fire inside one test shares `now()` (transaction start time), so don't `ORDER BY snapshot_at DESC LIMIT 1` — assert against the *set* of `total_points` values instead. See `test_override_result_twice_latest_snapshot_reflects_latest_scores`.
- `test_specials.py`'s autouse fixture now patches out `recompute_leaderboard_snapshot` so the existing mock-based award tests don't blow the `side_effect` budget; the wiring test re-patches it locally to assert it's called.

**Next:** Review batch R3 — Auth & rate limits (🟢 Sonnet)

---

## Review batch R3 — Auth & rate limits
**Commits:** 91a2fc8, 4ece8c8 · CI ✅

### Key facts for future sessions
- `rate_limit.py` exports one shared `limiter` + three key helpers. `login_key`/`refresh_token_key` are **sync** (not async) — the installed slowapi version does not await coroutine key functions. They read `request._body` which FastAPI has already cached before the route wrapper fires.
- Locked accounts now return `401 "Invalid credentials"` (not 429) to avoid leaking lock state. The pre-existing `test_login_locked_account` was updated to assert 401.
- `conftest.py` gains an `autouse` `reset_rate_limits()` fixture that calls `limiter._storage.reset()` before every test — required for test isolation once any endpoint has a rate-limit decorator.
- CI runs `ruff 0.15.13`; local venv was `0.15.12`. Format differences surfaced in `conftest.py` and `test_r3_rate_limits.py` — commit `4ece8c8` fixed them. Always run `ruff format` before pushing.

**Next:** Review batch R4 — Scheduler race + scoring-preview parity (🔴 Opus extended thinking)

---

## Review batch R4 — Scheduler race + scoring-preview parity
**Commits:** 8bef4c2 · CI ✅

### Key facts for future sessions
- The PUT-handler kickoff re-check is the actual safety net; the 15 s scheduler tick is just an optimisation. Both prediction PUT and knockout-prediction PUT now refuse with 409 `PREDICTION_LOCKED` when `match.kickoff_utc <= _now()` regardless of stale `match.status`. Order matters in knockout: kickoff check runs **before** `_is_round_locked` so the per-match safety net always fires first.
- `specials._is_locked` already calls `_now()` per invocation (not session start) — verified, no change needed.
- `packages/shared/src/scoring.ts` now takes `Stage` and mirrors lines 99–103 of `migrations/versions/004_scoring_function.py`: `correctResult` is zero when knockout AND (predicted draw OR actual draw). No callers exist in `apps/web` yet — function is currently library-only.
- Test fixtures `_make_match` in both prediction test files now default `kickoff_utc` to `_now() + 1h` (was `_now()`) so existing happy-path tests still pass under the new check; race-window tests pass `kickoff_utc=_now() - 1s` explicitly.

**Next:** Review batch R5 — Frontend resilience (🟢 Sonnet)

---

## Review batch R5 — Frontend resilience
**Commits:** 89d6677 · CI ✅

### Key facts for future sessions
- `clearTokens()` is now `async` — any call site that was fire-and-forget (e.g. `api.ts` silentRefresh, 401 handler) must `await` it or the cache delete races with page navigation.
- The production VITE_API_URL assertion lives at **module load** in both `api.ts` and `AuthContext.tsx` — it is guarded by `import.meta.env.PROD` so the CI build (which does not set `VITE_API_URL`) does not blow up. Workbox cache names (`api-user-data`, `api-matches`) were confirmed in `src/sw.ts` before wiring.
- `useOfflineQueue` backoff delays live in `RETRY_DELAYS = [30_000, 60_000, 120_000]`; the timer is module-scoped via `retryTimer` ref inside the `useEffect` closure and is cancelled both on unmount and when the queue empties. Concurrent flush coalescing (module-scoped `inFlight` in `offlineQueue.ts`) is preserved.
- Vitest fake-timer gotcha: use `vi.useFakeTimers({ shouldAdvanceTime: true })` so `waitFor` (real `setTimeout`) still works alongside `vi.advanceTimersByTime`.

**Next:** Review batch R6 — Observability (🟢 Sonnet)

---

## Review batch R6 — Observability
**Commits:** 558694a · CI ✅

### Key facts for future sessions
- `notify_backup_failed` in `notification_triggers.py` reuses `NotificationType.auto_sync_failed` (no new DB enum value needed); `ActionType.backup_failed` + `backup_downloaded` are the new audit_log enum values (migration 010).
- `download_backup` now takes a `db: Annotated[AsyncSession, Depends(get_db)]` param — existing tests for the 404/400 paths needed a `get_db` override added.
- All `await notify_*` calls in `scheduler.py` and `result_sync.py` are wrapped in `try/except Exception: log.exception(...)` — a push-provider failure logs with `exc_info=True` and does not propagate.
- Sentry `traces_sample_rate` is `0.0` in all non-production environments, `0.05` in production.

**Next:** Review batch R7 — Playwright smoke test (🟢 Sonnet)

---

## Review batch R7 — Playwright smoke test
**Commits:** 3d8cae0, 53556f8, 0dd5371, 0e403a5, 4db564e · CI ✅

### Key facts for future sessions
- `ENVIRONMENT: development` (not `test`) is required in the smoke CI job — R1.1 secret guard only skips when environment is exactly `"development"`.
- `blockSupabase(page)` must be called before `page.goto()` in any browser test running against a real backend — placeholder Supabase URLs cause WebSocket connection attempts that interfere with navigation.
- `AuthContext` reads `wc2026_player` from localStorage **synchronously on mount**; `ProtectedRoute` redirects to `/login` if it is absent. Any `addInitScript` auth setup must set all three keys: `wc2026_access`, `wc2026_refresh`, `wc2026_player`.
- Scoring for exact group-stage prediction: 2 pts (goals total) + 3 pts (correct result) + 5 pts (exact scoreline) = **10 pts**. Previous session notes incorrectly said 7.
- Smoke cleanup (`DELETE /api/v1/test/cleanup`) deletes the player profile by name — must match the constant `PLAYER_NAME = 'SmokePlayer'` in `smoke.spec.ts` exactly.
- Smoke fixtures registered in `main.py` only when `settings.environment != "production"`.

**Next:** all pre-launch review batches shipped — run `/next-batch-prompt review` to confirm.

---

## Polish batch U1 — Logo + brand voice + self-hosted fonts
**Commits:** e12a942, c978262 · CI ✅

### Key facts for future sessions
- `apps/web/generate-icons.mjs` uses `@resvg/resvg-js` to render the SVG mark to PNG at every required size (192/384/512/maskable-512/180-touch/32-favicon). Run on demand, not in the build pipeline — regenerate after editing the source SVG.
- Concept 3 (bold S letterform) was the original direction in `e12a942`; swapped to Concept 4 (pitch-as-spreadsheet) in `c978262`. Concept 4 ships with a companion `docs/logo-concepts/concept-4-pitch-favicon.svg` — simplified centre-circle + ball, used as the 32 px favicon (the full pitch mark is too dense at that size).
- LoginPage kept as `variant="splash"` (wordmark only). The new `variant="lockup"` (mark left + wordmark right) exists in `Brand.tsx` but is not used on the splash — the mark felt out of place there. The mark only ships via favicon/install/manifest/SW precache.
- Self-hosted fonts are in `apps/web/public/fonts/` — JBM 600+700 + Outfit 400+600, ~70 KB total. `<link rel="preload">` for JBM 600 (the LCP element). Google Fonts `<link>` + preconnect hints removed from `index.html`; `fonts.gstatic.com` route removed from `sw.ts`.
- `PageHeader` brass divider (`border-t border-accent/30`) fires only when an `eyebrow` is present — ~20 consumers automatically inherit it. No per-page wiring needed.

**Next:** Polish batch U2 — Form unification + navigation consistency (🟢 Sonnet)

---

## Polish batch U2 — Form unification + navigation consistency
**Commits:** dbf1469, 666e605 · CI ✅

### Key facts for future sessions
- `apps/web/src/components/PinInput.tsx` — 4 segmented cells, auto-advance on input, backspace returns focus, paste of 4 digits fills all cells. Single controlled API: `value: string` + `onChange: (v: string) => void`. Length is hardcoded at 4.
- shadcn `Select` (Radix) replaces native `<select>` on LoginPage, SpecialsPage (team pickers), ComparePage (Player A/B). `<input type="time">` and `<input type="date">` left native (platform pickers are genuinely better).
- `PageHeader` gained an optional `back` prop (`{ to?: string; label?: string }`) rendering a top-left chip above the eyebrow. Seven pages migrated off the right-slot back pattern: GroupDetail, LeaderboardHistory, RoundLeaderboard, Compare, PlayerProfile, admin/Results, admin/Sync. Right slot is now action-only.
- `SpecialCard` save button cycles `Save → Update → "Saved ✓"` (1.2 s flash) — implemented as a single component state machine; resting label depends on whether the player has a committed value.
- Push notification denied state → platform-aware "How to enable" inline message instead of a non-functional Subscribe button. Chrome / iOS / generic copy variants.
- Playwright e2e fixes (`666e605`): shadcn Select needs `getByRole('combobox')` → click → `getByRole('option')`; PinInput needs 4 sequential `.fill('1')` calls on the four cell inputs (not a single `fill('1234')`).

**Next:** Polish batch U3 — Dashboard rebalance + copy polish + a11y contrast (🟢 Sonnet)

---

## Polish batch U3 — Dashboard rebalance + copy polish + a11y contrast
**Commits:** d643644 · CI ✅

### Key facts for future sessions
- `apps/web/src/lib/leaderboard.ts dedupedLeaderboard()` — dedupes the leaderboard endpoint response by `player_id` (keeps first occurrence) and recomputes competition ranks locally (`1, 1, 1` when all tied; `1, 1, 3` when two tied at top). Applied on both `LeaderboardPage` and `DashboardPage` `MiniLeaderboard`. Vitest: 9 dup rows × 3 players all rank 4 → 3 rows all rank 1. Defensive against the C-2 backend bug (still open, separate ticket).
- React Query `keepPreviousData` on leaderboard / upcoming / recent queries on Dashboard — kills the "—" flicker during refetch even after data has already loaded once. Vitest test asserts stale data stays visible during stalled refetch.
- `apps/web/src/lib/format.ts` — humanises hour deltas as `Xd Yh / Xh Ym / Xm before`. Used for `AVG SUBMIT TIME` on PlayerProfile; reusable.
- `--text-muted` lifted in dark mode from `#5A6478` → `#7B859B` to clear WCAG AA 4.5:1 on `bg-surface` (`#131720`). Single CSS-var edit; all ~30 page eyebrows passed.
- **U3.11 second clause did NOT ship** — primary button on-colour contrast (white text on emerald `#10B981` in light mode = 2.53) is still failing accessibility. Lighthouse Final still flags it. See `docs/lighthouse-final-2026-05-26.md` "Remaining issue" for the 5-min follow-up fix (new `--on-primary` token + Button variant update).
- Flaky `PredictionsPage` test fix: `waitFor` timeout raised to 3 s — the count-up animation takes up to 600 ms; the 1 s default times out under full-suite load.

**Next:** Polish batch U4 — Premium empty states + bracket teaser (🟢 Sonnet)

---

## Polish batch U4 — Premium empty states + bracket teaser
**Commits:** cde36da, 7959334 · CI ✅

### Key facts for future sessions
- `BracketTeaser` fetches `/api/v1/matches?stage=r32&limit=1` via React Query (key `['matches', 'r32-first']`) — shows "—" when no kickoff available; countdown via existing `useCountdown` hook.
- `GroupsPage` requires a second query (`['matches', 'group']`) to find the first scheduled match per group for the pre-tournament preview row — `GroupResponse` only carries standings, not match data.
- `UpdateBanner` uses `registerSW` from `virtual:pwa-register` (not `useRegisterSW` from `/react`) — the SKIP_WAITING message listener in `sw.ts` handles the actual SW activation.
- The `feat/frontend-polish` branch was merged directly to staging (About page, install gate, WelcomeCard, InstallPromptController) without going through `feat/premium-polish` — caused repeated merge conflicts. Fixed by merging `origin/staging` → `feat/premium-polish` at close-out. Both branches are now identical.
- `mockImplementationOnce` in `UpdateBanner.test.tsx` requires casting the return value (`as unknown as () => Promise<void>`) — vite-plugin-pwa's `RegisterSWOptions` type doesn't align with locally-defined callback types.

**Next:** Polish batch U5 — Motion moments + elevation depth (🔴 Opus, extended thinking ON)

---

## Polish batch U5 — Motion moments + elevation depth
**Commits:** 129952b, 9b427c7 · CI ✅

### Key facts for future sessions
- framer-motion 11's `useReducedMotion` reads matchMedia once via `useState(initial)` — it's not reactive and does NOT respect `<MotionConfig reducedMotion>`. Use the also-exported `useReducedMotionConfig` for new motion code so MotionConfig overrides work in tests (`<MotionConfig reducedMotion="always">`).
- The Tailwind utility `top-safe-or-0` does NOT exist in this codebase — it was silently dropped, which pinned `<UpdateBanner>` under the iOS status bar (un-tappable in standalone PWA). The convention here is `top-0` + `pt-safe` on the *outer* wrapper (with the colour also on the outer so the notch strip is filled), matching `<TopBar>`.
- `ScoreInput` paints the digit with an overlaid `<motion.span>` keyed on a pulse counter while the native `<input>` is rendered `text-transparent` — lets the spring replay on every value change (typed / chevron / keyboard) without disturbing input focus or numeric IME behaviour.
- Per-player palette (`LeaderboardHistoryPage` + `BracketPage`) reserves the entire green band — brand primary is green-only. Slate neutrals (`#94a3b8`, `#cbd5e1`) replaced `#22c55e` and `#14b8a6`. Semantic green elsewhere (bracket "Correct" indicator using `#10b981`) is intentional and NOT from this palette.
- Local `pnpm --dir apps/web build` fails with `Rollup failed to resolve "workbox-window"` — pre-existing on the branch (reproduced by stashing U5 changes). CI builds clean (different lockfile state); a fix already exists on `feat/frontend-polish` (`27bbcdc`). Out of scope for U5.

**Next:** Verification + real-phone soak per `docs/polish-batches.md` "Verification (run at the end of U5, before merge)". After user sign-off, tag `main` as `v1.0-pre-multi-league`.

---

## Lewis soak prep — C-2 dedupe fix + end-to-end scoring verification
**Commits:** e7796e1 · CI ✅ · Tag `v1.0-pre-multi-league`

### Key facts for future sessions
- C-2 fix uses SQLAlchemy `aliased(LeaderboardSnapshot, subquery)` so the `(profile, snapshot)` tuple shape is preserved across the DISTINCT-ON subquery. ORDER BY must start with the distinct keys (`player_id, snapshot_at DESC, id DESC`); the secondary `id DESC` is the deterministic tie-break for snapshots inserted inside the same Postgres transaction (both `now()` calls return the same `transaction_timestamp()`).
- `db_conn`-backed API tests (new pattern in `apps/api/tests/test_leaderboard.py`) bind an `AsyncSession` to the same connection and override `get_db` to yield it. Lets you hit the real SQL via the FastAPI route inside the autoroll-back transaction.
- Staging Railway is **manual deploy** — CI only deploys the Vercel frontend. Use `cd apps/api && railway up --service wc2026-api`. The `RAILWAY_API_TOKEN` in `.env` doesn't work as CLI auth; create a project-scoped token from the Railway dashboard (project Settings → Tokens) and run with `RAILWAY_TOKEN=<token> railway up`.
- `/api/v1/test/lock-now/{match_id}` is registered on staging (`settings.environment != "production"`). Useful for synthetic scoring runs — sets kickoff to `now-1min` and status to `locked`, bypassing the scheduler. Restore the original `kickoff_utc` in rollback or the match shows as "starting in the past" during the soak.
- No knockout matches are seeded on staging — only the 72 group matches. To test the SQL trigger's knockout-draw exception end-to-end you have to SQL-INSERT throwaway R32 matches (e.g. match_numbers 9001–9003) and delete them afterwards. The TS algorithm in `packages/shared/src/scoring.ts` covers the same cases at unit level, but the trigger was verified against scenarios G/H/I (1-1→1-1=7, 1-1→2-1=0, 2-1→2-1=10) this session.
- `predictions.points_breakdown` JSONB column is correctly populated by the AFTER UPDATE trigger (`{"goals", "result", "exact", "total", "no_prediction"}`) but **not exposed** by `PredictionResponse` or any other API response. Data is sitting in the DB ready for a future per-prediction breakdown tooltip — wire it through the API when that UI is built.

**Next:** Lewis 2–3 day soak on `wc2026-staging.vercel.app` → findings into `docs/lewis-soak-findings.md` → iterate fixes on `fix/*` branches off main → then begin the multi-league architecture phases.

---

## feat/per-prediction-breakdown — Points breakdown tooltip
**Commits:** f5b08aa · CI ✅

### Key facts for future sessions
- `points_breakdown` was already in the DB (`predictions` JSONB column, populated by the AFTER UPDATE trigger) — this work was purely API plumbing + UI, no migration.
- `PointsBreakdownPopover` is a tap-to-expand inline component (no floating positioning) — works correctly in table cells and flex rows on mobile. Location: `apps/web/src/components/PointsBreakdownPopover.tsx`.
- The empty `<div>` in `KnockoutCard` (knockout winner predictions) that had a comment "points_awarded lives on the prediction" was wired up at the same time — `pointsAwarded` prop now threaded from `RoundPanel` into `KnockoutCard`. Winner predictions have no breakdown so the popover is a no-op there.
- `RAILWAY_API_TOKEN` in `.env` was expired; replaced with `959d7ac4-54dd-4902-83e2-635dbbe56b0b`.

**Next:** Lewis soak findings → multi-league architecture phases.

---

## Multi-league design — architecture + phase plan landed
**Commits:** 6fa494e · planning session only (no code changes)

### Key facts for future sessions
- Design doc lives at `docs/multi-league-architecture.md` (~10 sections, full DDL + mermaid ERD + 8-phase breakdown M1–M8). It is **additive** to `wc2026-architecture.md` — v1 invariants (§6.1 scoring, §6.13 state machine, §8 security, §9 reliability) stay authoritative there; the design doc cross-references rather than restates.
- **Foundational call: predictions are global** (one row per (player, match), scored against every league the player is in). Schema treats `predictions`, `knockout_predictions`, `special_predictions` as un-scoped. Only `leaderboard_snapshots` and `invites` gain `league_id`.
- New tables: `leagues`, `league_memberships`, `league_join_requests`. Profile gains `email/first_name/last_name/email_verified_at`; `role` → `site_role` ENUM('superadmin','user'). Per-league role lives in `league_memberships`.
- C-2 dedupe pattern (aliased subquery + DISTINCT ON + `id DESC` tie-break) is preserved keyed on `(player_id, league_id)` — see § 2.2 MD-13. Scoring trigger rewrite (M2) inserts one snapshot per (player, active league) on each result. New index: `(league_id, player_id, snapshot_at DESC, id DESC)`.
- Login switches from name-dropdown to email + PIN. Email verification is optional and async (Resend free tier recommended); self-service PIN reset is gated on verified email. Admin PIN-reset paths unchanged. League privacy: `private` / `public_request` / `public_open`; Steele Spreadsheet defaults to `private` post-migration.
- Cross-league summary math = **average rank** across leagues with ≥3 members, secondary sort by total_points. Surfaces on dashboard hero.
- Phase batches appended to `docs/phase-batches.md` as M1–M8. Implementation order is strict (M1 before M2, etc.). Total ~7–8 sessions.
- Migration backfill script (`scripts/backfill_multi_league.py`) is M1's deliverable and is idempotent — must run cleanly on staging before prod; manual email entries via JSON sidecar (OQ-1) for existing v1 profiles whose emails aren't already known.

**Next:** Batch M1 — Schema foundations + Steele Spreadsheet backfill (🔴 Opus, extended thinking ON)

---

## Multi-league batch M1 — Schema foundations + Steele backfill
**Commits:** 369ad6f · CI ✅

### Key facts for future sessions
- M1 is **additive** — `profiles.role` (`player_role` enum) is left untouched alongside the new `profiles.site_role` (`site_role` enum: `superadmin`/`user`). Backfill populates `site_role` from `role`; the old column is dropped in M8. This is why v1 application code keeps working through M1–M7.
- `profiles.email` uses a partial unique index (`ix_profiles_email_unique_lower` on `LOWER(email) WHERE email IS NOT NULL`) rather than a plain UNIQUE constraint — the column is NULLABLE until M8, and Postgres treats NULLs as distinct so a partial index is the only correct shape.
- Migration 011 downgrade has a safety check: it refuses to restore `uq_profiles_display_name` if duplicate display names exist. Resolve duplicates first if rollback is ever needed.
- Backfill script (`scripts/backfill_multi_league.py`) defaults to **dry-run**; `--apply` is required to commit. It self-aborts on: missing migration 011, no active `Craig` profile, resulting Steele privacy ≠ `'private'`, or zero admin memberships. Idempotent via per-row UPSERT on `league_memberships` + slug-lookup on `leagues`.
- Sidecar JSON shape: `{"<profile_id>": {"email": "...", "first_name": "...", "last_name": "..."}}`. Any subset of fields is fine; missing values derive from `display_name`. Sidecar lives outside the repo (PII) — see `docs/runbooks/multi-league-migration.md`.
- `_make_profile` helper in `tests/test_multi_league_migration.py` mirrors the `_insert_profile` pattern in `test_scoring_trigger.py` (raw INSERT with `CAST(:r AS player_role)`). The `db_conn` fixture already soft-deletes pre-existing profiles, so each test starts with an empty active profile set.

**Next:** Multi-league batch M2 — Per-league snapshots + scoring trigger rewrite (🔴 Opus)

---

## Multi-league batch M2 — Per-league snapshots + scoring trigger rewrite
**Commits:** 35a4669, 0e1e73e · CI ✅

### Key facts for future sessions
- Migration 012 uses `UPDATE ... SET league_id = (SELECT id FROM leagues WHERE slug='steele-spreadsheet')` as the backfill. On a fresh DB the subquery returns NULL but the table is empty, so the UPDATE is a no-op and the subsequent `ALTER COLUMN ... SET NOT NULL` still succeeds — that's why CI's `alembic upgrade head` works without running `scripts/backfill_multi_league.py` first.
- The new trigger fans out via `JOIN league_memberships lm` AND inner-joins the player_totals subquery, which filters on `pr.deleted_at IS NULL`. So soft-deleted profiles get no snapshots even if their membership rows are still active. The conftest soft-deletes all pre-existing profiles, which is what isolates each test from leaked snapshot rows.
- `tests/conftest.ensure_default_league_membership(conn, profile_id)` is the canonical helper for trigger/leaderboard tests — it idempotently creates the `steele-spreadsheet` league and adds the profile. Every `_insert_profile` helper in trigger-touching test files routes through it. Soft-deleted profiles intentionally skip it.
- `admin.create_invite` and `auth.join` both resolve `steele-spreadsheet` at request time (no module-level cache) — the slug is the contract until M3 ships per-league invite endpoints. `test_helpers.seed` materialises the league for CI smoke runs and `cleanup` deletes memberships **before** profiles because the membership → profile FK has no ondelete cascade.
- `notify_leaderboard_shifts` still squashes by `player_id`, so multi-league players get one non-deterministic rank-shift notification per result event. Acceptable for M2 (everyone is in Steele); proper per-league notifications arrive with MD-12 in M3+.
- C-2 endpoint scopes via `LeaderboardSnapshot.league_id == (SELECT id FROM leagues WHERE slug='steele-spreadsheet').scalar_subquery()`. If the Steele league is ever missing, the subquery is NULL and the endpoint returns empty — degraded but not crashing.

**Next:** Multi-league batch M3 — League management API (CRUD) (🟢 Sonnet)

---

## Multi-league batch M3 — League management API (CRUD)
**Commits:** a15cb59, 0809780, 837f424 · CI ✅

### Key facts for future sessions
- `require_league_admin(slug)` is defined in `leagues.py` and imported by both `league_memberships.py` and `league_join_requests.py`. All three routers share the same `LeagueAdminDep` / `LeagueMemberDep` type aliases.
- CI runs `ruff format --check` separately from `ruff check`. Local venv used an older ruff version that didn't flag format drift — always run `ruff format` before pushing, or sync venv ruff version to `ruff==0.15.x` (whatever CI installs).
- `_upsert_membership` restores soft-deleted rows (sets `deleted_at=NULL`, refreshes `joined_at`, resets role) — mirrors the M1 backfill script semantic. Join endpoints and join-request approval both go through this path.
- Privacy transition side effects are in `update_league` (PATCH): `→ private` cancels pending requests; `public_request → public_open` auto-approves pending requests up to `max_members`.
- Legacy `POST /admin/invites` kept working with `Deprecation: true` header; M5 removes it.
- `ActionType` in `notification.py` has 17 new M3 values — `test_action_type_values` in `test_models.py` is an exhaustive allowlist that must be updated whenever the enum grows.

**Next:** Multi-league batch M4 — Auth refactor — email signup + verification + reset (🟢 Sonnet)

---

## Multi-league batch M4 — Auth refactor — email signup + verification + reset
**Commits:** 4c0c055, 10826f2 · CI ✅

### Key facts for future sessions
- Email tokens (verify + PIN reset) are JWTs signed with `jwt_access_secret`; distinguished by a `scope` claim (`email_verify` / `pin_reset`). No new DB table — the JWT carries everything.
- PIN reset for an unverified email silently sends a verification email instead and returns the same generic message — no enumeration leak. The check is `email_verified_at IS NULL`.
- `LoginRequest` now accepts `email` (primary) **or** `display_name` (deprecated). The deprecated path validates `min_length=2, max_length=30, pattern=^[\w\s'\-]+$` so R1 hardening tests still pass. Deprecated path adds `X-Deprecation: use-email` response header.
- `send_verification_email` / `send_pin_reset_email` in `src/services/email.py` are sync functions (Resend SDK is sync); called via `BackgroundTasks.add_task` — FastAPI runs them in a threadpool. Failures are logged only, never surfaced to the caller.
- When `RESEND_API_KEY` is empty (local dev), the email service logs a warning and returns without sending — no mock needed in tests that don't care about email delivery.
- mypy is now a mandatory gate: run `python -m mypy src --ignore-missing-imports` before every commit.

**Next:** Multi-league batch M5 — Per-league API scoping + cross-league summary (🔴 Opus)

---

## Multi-league batch M5 — Per-league API scoping + cross-league summary
**Commits:** fb1127e, 38f1a92 · CI ✅

### Key facts for future sessions
- Per-league read endpoints are a SECOND `league_router` (prefix `/api/v1/leagues`) inside `leaderboard.py`/`stats.py`/`compare.py`/`players.py`; the old `router` keeps only 410 stubs. `require_league_member`/`LeagueMemberDep` are imported from `leagues.py` (no import cycle).
- Retired v1 paths answer 410 + `Link: <successor>; rel="successor-version"` (helper `src/routers/_gone.py`). Kept as superadmin tools (NOT moved): `GET`+`DELETE /admin/invites`, `GET`+`DELETE /admin/players`, `POST /admin/players/{id}/reset-pin`. Only `POST /admin/invites` was 410'd.
- **Migration 013** backfills the 15 M3 league `action_type` enum values that M3 added to the Python enum (+`test_action_type_values` allowlist) but never to Postgres — M3/M4 tests mock the DB, so it only surfaced as a 500 in M5's full-stack smoke (`POST /leagues/{slug}/invites`). **M8's planned "migration 013" must become 014.**
- Cross-league summary `GET /api/v1/me/cross-league-summary` reads the stored per-league snapshot rank (MD-13), averages only leagues with ≥3 members, and uses 3 fixed queries (no N+1).
- Frontend is still single-league: pages fetch via a hardcoded `DEFAULT_LEAGUE_SLUG` in `apps/web/src/lib/api.ts`; `dedupedLeaderboard(entries, leagueSlug)`. LeagueContext + per-league routes are M7 — deliberate stopgap to keep CI/smoke green.
- New DB-backed acceptance tests (cross-league avg-rank, other-league hiding, multi-league C-2 dedupe) run in CI only — they need Postgres and skip locally.

**Next:** Multi-league batch M6 — Frontend — signup + league management UI (🟢 Sonnet)

---

## Multi-league batch M6 — Frontend: signup + league management UI
**Commits:** c3e664d, f043c5d, c472ead, 8be05cb · CI ✅

### Key facts for future sessions
- `LeagueContext.tsx` owns the active league slug; persists to `localStorage` (`wc2026_active_league_slug`); redirects to `/welcome` if `/leagues/mine` returns empty. Use `useLeagueOptional()` (null-safe) in components that render outside the provider (e.g. TopBar).
- `LeagueAwareLayout` wraps only regular authenticated routes — admin routes (`/admin/*`) are NOT wrapped; they don't need league context and wrapping caused a re-render race that detached the Sync Now button in E2E.
- Playwright LIFO gotcha: in `catchAllApi`, register the `**/api/v1/**` catch-all FIRST and `**/api/v1/leagues/mine` SECOND. Last registered = highest priority. Getting this backwards silently makes `/leagues/mine` return `[]` → LeagueProvider redirects → pages unmount mid-test.
- `seedAuth()` now also sets `wc2026_active_league_slug` in localStorage so LeagueProvider restores state without waiting for the `/leagues/mine` network response.
- LoginPage now takes email + PIN (no player-name dropdown). `AuthContext.login()` signature changed to `(email, pin)`. `AuthContext.signup()` added for the new `/signup` page.

**Next:** Multi-league batch M7 — Frontend: per-league screens under /leagues/{slug}/*, dashboard hero, superadmin all-leagues page (🟢 Sonnet)

---

## Multi-league batch M7 — Frontend: reshape existing screens for multi-league
**Commits:** 053ae36 · CI ⚠️ (runner quota exhaustion — all local suites green)

### Key facts for future sessions
- All per-league pages now read `slug` from `useParams` + call `useLeagueSlugSync(slug)` — never from `useLeague()` directly. This avoids a provider re-render race on hard-nav.
- `LeagueRedirect` reads `wc2026_active_league_slug` from localStorage directly (not `useLeague()`) so the redirect is synchronous before the `/leagues/mine` fetch resolves.
- `AllLeaguesPage` reuses the existing `DELETE /api/v1/leagues/{slug}` endpoint by auto-filling `confirm_name` from the stored league object — no new delete endpoint needed.
- DashboardPage `CrossLeagueSummaryWidget` handles `avg_rank === null` gracefully (shows "No average available yet") — API returns null when no leagues have ≥3 members yet.
- Playwright LIFO ordering: catch-all `**/api/v1/**` mock registered first, specific routes after — per M6 note above. E2E admin tests added for `/admin/all-leagues`.
- GitHub Actions runner quota was exhausted for the entire month of May — CI runs showed `runner_id=0`, 0 steps, 3-second completion. Not a code issue.

**Next:** Multi-league batch M8 — Cleanup + polish + multi-league soak (🟢 Sonnet)

---

## Multi-league batch M8 — Cleanup + polish + multi-league soak
**Commits:** 499f735, a52dd32 · CI ⚠️ (runner quota exhaustion — all local suites green)

### Key facts for future sessions
- Migration 014 has a built-in preflight guard: aborts with a clear error if any active profile has NULL email/first_name/last_name/site_role. Run the M1 backfill first if it fires.
- All deprecated 410-stub routes removed entirely (`_gone.py` deleted). Old paths (`/leaderboard`, `/players`, `/stats/league`, `/compare/{a}/{b}`, `POST /admin/invites`) now return 404 naturally.
- `LoginRequest` is now email-only — `display_name` field removed. Any test that passed `display_name` to `/auth/login` had to be updated to `email`.
- Tests that asserted 410 + Link header were updated to assert 404/405; `test_login_by_display_name_still_works` deleted.
- `ruff format --check .` (run from `apps/api/`) catches 4 files the narrower `ruff check src/ tests/` missed — always run both from the package root in CI.
- The multi-league Playwright spec (`e2e/multi-league.spec.ts`) follows the LIFO mock registration pattern from M6/M7.

**Next:** M-series complete — staging soak with Lewis, then tag `v1.1-multi-league` on main

---

## Multi-league batch M9 — Frontend: Leagues tab + drop active-league switcher
**Commits:** 8aaaeff · CI ⚠️ (runner quota exhaustion — all local suites green: 187 tests, typecheck clean, lint 0 errors)

### Key facts for future sessions
- `LeagueContext` now exposes only `{ leagues, isLoading, refetch }` — `activeLeague`, `setActiveLeague`, `wc2026_active_league_slug` localStorage key, `useLeagueSlugSync`, and `useLeagueOptional` are fully removed; nothing reads or writes that key anymore.
- Bottom nav "Standings" → "Leagues" at `/leagues`; desktop nav LeagueSwitcher dropdown deleted; Compare removed from both navs (it's per-league, reached from inside a league).
- `/leaderboard`, `/leaderboard/history`, `/leaderboard/round/:stage`, `/compare` now redirect to `/leagues` — old bookmarks land cleanly, no blank screens.
- `MyLeaguesPage` now shows live rank + points per league card (per-league leaderboard fetch + `dedupedLeaderboard`); `PlayerProfilePage` back-links point to `/leagues`.
- 9 per-league pages had no-op `useLeagueSlugSync` calls removed; they already read `slug` from `useParams`.

**Next:** M-series complete — staging soak with Lewis, then tag `v1.1-multi-league` on main

---

## Review batch R8 — Deploy detection & fail-fast
**Commits:** 5e9ad9f, 75ab75c · CI ✅

### Key facts for future sessions
- `RAILWAY_GIT_COMMIT_SHA` is the confirmed env var name Railway injects; defaults to `"unknown"` if absent so boot never crashes on a missing var.
- `/health/ready` now returns HTTP 503 (was 200) when DB unreachable — any caller doing a status-code check will now correctly detect the degraded state.
- Prod validator (`_reject_weak_secrets_in_prod`) extended: also rejects localhost/empty `frontend_origin` and empty `database_url` — a misconfigured Railway deploy will refuse to start rather than silently misbehave.
- `migrations/env.py` sets `lock_timeout='5s'` on the migration connection; transactional DDL rolls back cleanly on timeout, no half-applied migration risk.
- `ship-prod.md` Step 3 now has two hard gates: SHA gate (stops if actual SHA ≠ pushed main HEAD or is `"unknown"`) and post-deploy synthetic hitting `/api/v1/matches/upcoming` through the prod frontend origin.

**Next:** Review batch R9 — CI runs the production frontend bundle (🟢 Sonnet)

---

## Review batch R9 — CI runs the production frontend bundle
**Commits:** 171f13a, 3eea100 · CI ✅

### Key facts for future sessions
- Separate `playwright.prod-bundle.config.ts` (port 4173, no webServer) keeps prod-bundle tests fully isolated from the dev-server e2e projects.
- `prod-bundle*.spec.ts` files must be in `testIgnore` for the chromium/firefox/webkit projects in `playwright.config.ts` — otherwise they're picked up by the dev-server e2e job where `import.meta.env.PROD` is `false` and the guard test fails.
- `prod-bundle-check` CI job manages vite builds and preview starts manually; it runs two cycles (positive with `VITE_API_URL` set, negative without) back-to-back in the same job.
- The guard test passes when the R5.1 error fires; if the guard regresses the test fails, blocking CI.

**Next:** Review batch R10 — Deploy docs reconciliation (🟢 Sonnet)

---

## Review batch R10 — Deploy docs reconciliation
**Commits:** f699202, aba97b5 · CI ✅

### Key facts for future sessions
- `deploys-ongoing.md` now uses `wc2026-prod.vercel.app` throughout (the old `wc2026.vercel.app` references all replaced); `wc2026-api-production-333a.up.railway.app` (deleted project) replaced with `wc2026-predictor-staging.up.railway.app`.
- Single-replica assumption is now written down in the "Operational concerns" section — do not scale Railway replicas without adding scheduler leader election and a migration lock.
- `docs/runbooks/env-manifest.md` created: ownership table for every runtime var (Railway vs Vercel, per env), with ⚠️ flags on the four that break prod silently (`VITE_API_URL`, `FRONTEND_ORIGIN`, `DATABASE_URL`, `SCHEDULER_ENABLED`).

**Next:** R8–R10 review series complete — operator actions OP1–OP5 remain (dashboard-only, see docs/review-batches.md)

---

## Multi-league batch M10 — Staging soak fixes
**Commits:** d62afea, c6d21ec · CI ✅

### Key facts for future sessions
- `WelcomePage` (`/welcome`) removed entirely — post-signup now redirects straight to `/dashboard`. The route no longer exists; any deep-linked `/welcome` URLs will 404.
- Invites + Settings buttons on the league page are gated to `role === 'admin'`; non-admin members see neither.
- OP4 confirmed N/A: `wc2026.vercel.app` is not owned by this project; canonical prod frontend stays `wc2026-prod.vercel.app`.

**Next:** E2 — Email setup (Resend) whenever Resend account + domain are ready (`/next-batch-prompt env`)

---

## Review batch R11 — Supabase RLS lockdown (C1)
**Commits:** 47e3b4a, 47ad360 · CI ✅

### Key facts for future sessions
- Migration `015_r11_rls_lockdown.py`: REVOKES anon/authenticated write grants on all 13 tables and enables RLS; `matches` + `leaderboard_snapshots` get a SELECT-for-all policy (realtime still flows); the 11 other tables are deny-all.
- Prediction table realtime subscriptions were removed from the frontend — prediction pages now refresh via `matches`/`leaderboard_snapshots` channel events + FastAPI refetch.
- The backend uses the service role (bypasses RLS), so no API behaviour changed.
- **Operator follow-up still open:** re-run the Supabase advisor (or `SELECT relname, relrowsecurity FROM pg_class`) on **prod** `kznxjyaanotrejcevngy` to confirm `rls_disabled_in_public` is clear there too.
- R12/R13 are the next soak-audit batches (tenant isolation + admin hardening) — not soak-blockers.

**Next:** Review batch R12 — Backend tenant isolation 🟢 Sonnet (`/next-batch-prompt review`)

---

## Review batch R12 — Backend tenant isolation
**Commits:** 02a4478, a38a6b8 · CI ✅

### Key facts for future sessions
- New `src/deps.py` with `shared_league_player_ids(requester_id, db)` — one SQL call (correlated subquery); always includes requester's own ID.
- Six endpoints now gate on shared-league membership: GET /players/{id}, GET /players/{id}/predictions/recent, GET /stats/{id}, GET /predictions/player/{id} return 403; GET /predictions/match/{id} and GET /specials/all filter rows silently.
- Leaderboard helpers `_leaderboard_entries` and `_leaderboard_history` now inner-join `league_memberships` (deleted_at IS NULL); `_round_leaderboard` already had this join.
- `GET /leagues/{slug}`: private league + non-member now returns 404 (not 403); membership check moved before `_active_member_count` — existing tests updated to match new call order.
- Existing mock tests for predictions/players/stats/specials patched with `unittest.mock.patch` for `shared_league_player_ids` to avoid stub exhaustion.

**Next:** Review batch R13 — Admin authority + hardening cleanup 🟢 Sonnet (`/next-batch-prompt review`)

---

## Review batch R13 — Admin authority + hardening cleanup
**Commits:** 19dddc0 · CI ✅

### Key facts for future sessions
- `require_admin` now checks `site_role == SiteRole.superadmin` (not legacy `PlayerRole.admin`). `PlayerRole` is explicitly docstringed "Legacy" in `models/profile.py`.
- `Environment(StrEnum)` in `config.py` — unknown env strings raise `ValidationError` at startup. Default unchanged (`development`); fail-closed is the enum rejection, not the default.
- `main.py` test_helpers guard changed from `!= "production"` to `== Environment.development` — staging no longer mounts test helpers.
- `prune_leaderboard_snapshots()` in `scheduler.py` runs at 04:00 UTC: keeps latest 50 rows + one daily sample per (league_id, player_id). `rowcount` access uses `# type: ignore[attr-defined]`.
- Dead `compare.router` (zero routes, never mounted) removed from `compare.py:23`.
- RANK vs DENSE_RANK: RANK intentional (gaps after ties = standard sports table). Comment in `services/leaderboard.py`.

**Next:** all R-batches complete — project ready for soak / prod launch

---

## Polish batch U6 — Variable-length PIN, unified everywhere
**Commits:** c042b15, 436d23c, fe9b004, 2fefc31 · CI ✅

### Key facts for future sessions
- `PinInput` now accepts `maxLength` (default 4), `label` (default `'PIN'`), and `autoComplete` props. Signup/Join pass `maxLength={8}`, `autoComplete="new-password"`, and confirm gets `label="Confirm PIN"` to disambiguate the two groups.
- Login updated to `maxLength={8}` so users with longer PINs can sign in.
- Playwright `getByRole('group', { name: 'PIN' })` substring-matches `'Confirm PIN'` without `exact: true` — always use `exact: true` when scoping PIN group queries in E2E tests.
- Added `fillPinGroup(group, pin)` helper to `e2e/helpers.ts` for DRY per-cell fills.
- JoinPage Vitest test gained missing `AuthProvider` wrapper (pre-existing failure now fixed).

**Next:** Polish batch U7 — Invite-flow cleanup + finish issues 🟢 Sonnet

---

## Polish batch U7 — Invite-flow cleanup + finish issues
**Commits:** 1e5719c · CI ✅

### Key facts for future sessions
- `LeagueAdminInvitesPage` no longer captures or sends `invitee_email`; backend param left nullable for back-compat — no migration needed.
- All destructive actions (remove member, leave league, delete player, revoke invite) now use a `ui/dialog` type-to-confirm pattern. Member/player removal requires typing the display name; leave league requires `LEAVE`; revoke invite requires `REVOKE`.
- `font.display` in `tokens.ts` corrected to `"Outfit"` — Instrument Serif was never loaded; the token was a lie.

**Next:** Polish batch U8 — Partnership lockup polish 🟢 Sonnet

---

## Polish batch U8 — Partnership lockup polish
**Commits:** 9035327 · CI ✅

### Key facts for future sessions
- `robinsons-logo.png` (439×227 raster, blue-sky background) replaced by `apps/web/public/robinsons-logo.svg` — hand-authored arch SVG: even-odd filled band (outer r=110, inner r=69), gold border (r=110/67), `<textPath>` for "ROBINSONS" on a radius-85 arc, two-ellipse leaf. Transparent background; renders crisp at any size.
- Partnership lockup extracted to `PartnershipLockup` component (`apps/web/src/components/PartnershipLockup.tsx`) — imports `brand.tagline`, renders "In partnership with" label + SVG logo + italic tagline.
- `SignupPage` previously showed only `<Brand variant="splash" />`; now shows the full lockup to match Login. Both pages are now identical in their pre-card splash content.

**Next:** U8 is the last defined polish batch (round 3). Run `/next-batch-prompt polish` to check for further batches or pivot to the next phase.

---

## Polish batch U9 — Login + leagues quick wins
**Commits:** 8ddf043, 6ab843f · CI ✅

### Key facts for future sessions
- PIN reverted to exactly 4 digits (reverses U6 5–8 range). The `PinInput` component's `maxLength` prop was already there — only the _callers_ and the backend Pydantic patterns changed.
- Smoke test seed PINs were 8 digits (`"11111111"`, `"22222222"`) — updated to `"1111"` / `"2222"` in `test_helpers.py` and `smoke.spec.ts`; missed on first push, caught by CI smoke job.
- `robinsons-logo.svg` removed; `PartnershipLockup` reverts to `.png`. The raster was already in HEAD — U8.1 only _added_ the SVG alongside it; restoring was a pointer swap + file delete.
- `LeagueCard` is now a block `<Link>` wrapping the whole card — no nested-interactive children so no a11y issue.
- `SelectContent` (Radix) lacked a height cap; all dropdowns (including 48-team specials picker) now scroll via `max-h-[min(20rem,var(--radix-select-content-available-height))]` + `ScrollUpButton`/`ScrollDownButton`.

**Next:** Polish batch U10 — Forgot-PIN + first-run onboarding 🟢 Sonnet

---

## Polish batch U10 — Forgot-PIN + first-run onboarding
**Commits:** 73f064a, 26c0d22 · CI ✅

### Key facts for future sessions
- `FirstRunController` renders tour-then-notifications modals when authenticated and localStorage flags unset; lives inside `AuthProvider` in `App.tsx` alongside `InstallPromptController`.
- E2E `seedAuth` helper must pre-seed `sss_tour_seen` and `sss_notif_prompt_seen` (added in `26c0d22`) — any future E2E test that calls `seedAuth` gets this automatically.
- `NotificationsPromptModal` checks `window.matchMedia('(display-mode: standalone)')` at render time — iOS non-standalone shows install nudge only, never the Enable button.
- `/pin/reset/:token` route (not `/pin-reset/`) — backend email template must link to this exact path.
- The "ask your league admin" U2.3 copy was never present in the codebase at this point — grep confirmed absent.

**Next:** Polish batch U11 — Home screen rebalance 🟢 Sonnet

---

## Polish batch U11 — Home screen rebalance
**Commits:** bc755d4 · CI ✅

### Key facts for future sessions
- `MiniLeaderboard` + `LeagueCard` removed; replaced by `CompactLeagueRow` — uses same `['leaderboard', slug]` queryKey so React Query cache is shared with any other page fetching that endpoint.
- `LatestResultCard` now renders the 3-way `points_breakdown` (result/goals/exact) inline; falls back to total-only pill if `points_breakdown` is null (pre-tournament or no entry).
- `SpecialsCTA` is shown unconditionally — no pre/post-tournament toggle; aligns with user's ask to keep specials always reachable from home.
- DashboardPage test updated: keepPreviousData assertion now checks `42 pts` (Alice's points in compact strip) instead of `Zara` (who no longer appears on dashboard).

**Next:** Polish batch U12 — Multi-use join code + invite UX 🟢 Sonnet

---

## Polish batch U12 — Multi-use join code + invite UX
**Commits:** b3e4232, 2dc408d, 90cfae7 · CI ✅

### Key facts for future sessions
- `join_code` is 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no I/O/0/1), generated by `generate_join_code()` in `src/auth.py`.
- Migration 016 adds the column + backfills; migration 017 adds a PostgreSQL `server_default` (needed because integration tests INSERT leagues via raw SQL without specifying `join_code`).
- `GET /leagues/by-code/{code}` is intentionally **public** (no auth) — needed so unauthenticated users can see the league name before creating an account.
- `/join/:token` in the frontend detects join codes by exact length (`/^[A-Z0-9]{6}$/`) — invite tokens from `generate_opaque_token()` are 43 chars, so no ambiguity.
- Single-use invite flow (`claim_invite_authenticated`, `auth/join`) is untouched; `invite.is_active = False` deactivation is still at `league_memberships.py:91-93`.
- `/welcome` route is public (outside `<ProtectedRoute>`) — share it with friends who don't have the app yet.

**Next:** Polish batch U13 — Knockout/schedule skeleton + progression 🔴 Opus (extended thinking ON)

---

## Polish batch U13 — Knockout/schedule skeleton + progression
**Commits:** 19e9db9 · CI ✅

### Key facts for future sessions
- Migration 018 adds `home_source` / `away_source` nullable `VARCHAR(50)` columns to `matches`; knockout matches carry positional placeholders like `winner_group_a`, `runner_up_group_b`, `winner_match_73`.
- `seed.py` now seeds all 32 knockout slots (R32×16, R16×8, QF×4, SF×2, 3rd×1, Final×1) with real kickoff dates/venues; total calendar is 104 matches.
- `knockout_progression.py` is a pure resolver (no DB side-effects): resolves placeholders → real team IDs using group standings + best-third-placed qualification table. Call `resolve_all_knockouts(db)` from the admin or scheduler layer.
- Best-third-placed logic uses the 2026 fixed mapping of which 4 of the 8 third-placed qualify into R32 slots — the 12-group mapping table is in `knockout_progression.py:~L50`.
- `SchedulePage.tsx` renders knockout rounds with placeholder labels ("Winner Group A" / "Runner-up Group B") grouped by round; no "No matches found" empty state for KO rounds.
- `KnockoutPredictionsPage.tsx` renders the per-round placeholder list against seeded match IDs; picks save as normal.

**Follow-up commit:** eba3679 — knockout view consistency (round label unification + smart default stage).

**Next:** Polish batch U14 — Golden Boot player typeahead 🟢 Sonnet
