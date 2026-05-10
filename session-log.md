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
