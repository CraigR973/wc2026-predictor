# Review batches (R1–R10)

Fixes from the 2026-05-18 pre-launch review, grouped to amortize the cold
system prompt: same-model adjacent, same files / conceptual area together,
shared helpers before their consumers. Each batch is one session, one PR.

Mark batches complete by striking through the row.

| Batch | Model | Effort | Items | Rationale |
|---|---|---|---|---|
| ~~R1~~ | ~~🟢 Sonnet~~ | ~~~2 h~~ | ~~R1.1–R1.5~~ | ✅ Shipped 2026-05-18 |
| ~~R2~~ | ~~🔴 Opus (extended thinking)~~ | ~~~3 h~~ | ~~R2.1–R2.5~~ | ✅ Shipped 2026-05-19 |
| ~~R3~~ | ~~🟢 Sonnet~~ | ~~~2.5 h~~ | ~~R3.1–R3.4~~ | ✅ Shipped 2026-05-19 |
| ~~R4~~ | ~~🔴 Opus (extended thinking)~~ | ~~~2 h~~ | ~~R4.1–R4.3~~ | ✅ Shipped 2026-05-19 |
| ~~R5~~ | ~~🟢 Sonnet~~ | ~~~2 h~~ | ~~R5.1–R5.3~~ | ✅ Shipped 2026-05-19 |
| ~~R6~~ | ~~🟢 Sonnet~~ | ~~~2.5 h~~ | ~~R6.1–R6.4~~ | ✅ Shipped 2026-05-19 |
| ~~R7~~ | ~~🟢 Sonnet~~ | ~~R7.1~~ | ✅ Shipped 2026-05-20 |

**Total ≈ 16.5 h** across ~5 focused sessions.

---

## R1 — Backend hardening 🟢 Sonnet · ~2 h

- **R1.1** `apps/api/src/config.py:11-12` — make `jwt_access_secret` and `jwt_refresh_secret` required (no default). Validator that rejects the literal placeholders `"change-me-access"` / `"change-me-refresh"` AND empty `vapid_private_key`, `supabase_service_key`, `football_data_api_key` when `environment != "development"`. App must refuse to start in prod with weak secrets. (~15 min)
- **R1.2** `apps/api/src/database.py:8-13` — add `pool_pre_ping=True, pool_recycle=1800` to `create_async_engine`. Matches spec §9.5. (~5 min)
- **R1.3** New `apps/api/src/middleware.py` (extend existing file) — `SecurityHeadersMiddleware` setting HSTS (`max-age=63072000; includeSubDomains`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. Register in `main.py:98` after the existing middleware. Skip HSTS when `environment == "development"`. (~30 min incl. test asserting headers present)
- **R1.4** Pydantic validators on auth + prediction schemas:
  - `auth.py` LoginRequest, JoinRequest, ChangePinRequest: `pin: str = Field(pattern=r"^\d{4,8}$")`, `display_name: str = Field(min_length=2, max_length=30, pattern=r"^[\w\s'\-]+$")`
  - `predictions.py` PredictionRequest: `predicted_home/predicted_away: int = Field(ge=0, le=20)`
  - Cover with test: each rejects invalid input with 422. (~45 min)
- **R1.5** `admin.py:57` — `expires_in_days: int | None = Field(default=7, ge=1, le=30)`. (~5 min)

**Acceptance:** `pytest apps/api/tests` green. New tests: bad-PIN rejected, bad-name rejected, negative score rejected, app refuses to start with placeholder JWT secret, security headers present on every response.

---

## R2 — Scoring integrity 🔴 Opus (extended thinking ON) · ~3 h

> **Decision (carried from review):** drop the `WHEN (OLD IS NULL...)` clause from the AFTER trigger so any update to scores re-fires scoring. Keep it on the BEFORE trigger so `result_entered_at` stays meaning "first entry time". This lets us delete the null-then-set hack from `override_result` and lets the trigger handle every recompute path.

- **R2.1** New migration `009_scoring_trigger_runs_on_every_update.py` — recreate the `matches_score_results` trigger without the `WHEN` clause:
  ```sql
  CREATE TRIGGER matches_score_results
  AFTER UPDATE OF actual_home_score, actual_away_score ON matches
  FOR EACH ROW EXECUTE FUNCTION matches_score_results();
  ```
  Keep the BEFORE trigger unchanged. Downgrade restores the WHEN clause. (~20 min)
- **R2.2** `apps/api/src/routers/admin.py:635-645` — delete the null-then-set hack from `override_result`. Single-shot UPDATE now re-fires the trigger naturally. (~10 min)
- **R2.3** New `apps/api/src/services/leaderboard.py` — pure-Python `recompute_leaderboard_snapshot(session: AsyncSession, triggered_by_match_id: UUID | None) -> None` that inserts a fresh `leaderboard_snapshots` row per active player. Mirror the SUM(...) shape from `005_scoring_trigger.py:138-177`. Single source of truth for the non-trigger paths. (~45 min)
- **R2.4** Wire `recompute_leaderboard_snapshot` into:
  - `specials.py:award_specials` — after the bulk update, before the commit. **Critical:** without this the leaderboard is forever stale once the final is scored.
  - `admin.py:cancel_match` — after setting status, zero `predictions.points_awarded` and `knockout_predictions.points_awarded` for that match_id (single UPDATE each), then call the helper. Spec §6.13.
  (~45 min)
- **R2.5** Tests in `tests/test_specials.py` and `tests/test_admin_matches.py`:
  - After `award_specials`, latest snapshot per player has correct `special_points` and `total_points`.
  - After cancel of a previously-completed match, snapshot reflects zero contribution from that match.
  - Existing `test_override_recalculates_points` still passes (now via the simpler trigger path).
  - One new test: override the same result twice — final snapshot reflects the latest scores. (~60 min)

**Acceptance:** all existing scoring tests pass against new trigger; three new tests added; nothing in the codebase still calls the null-then-set pattern.

---

## R3 — Auth & rate limits 🟢 Sonnet · ~2.5 h

- **R3.1** New `apps/api/src/rate_limit.py` — single `limiter = Limiter(key_func=...)` instance + a `per_player_key(request)` helper that pulls `player_id` off `request.state` (set by a small dependency that decodes the bearer). Replace the two existing `Limiter(...)` calls in `main.py:77` and `auth.py:36` with imports. (~30 min)
- **R3.2** Apply spec §8.3 decorators:
  - `POST /auth/login` → `5/15 minutes` per `f"{display_name}:{get_remote_address(request)}"`
  - `POST /auth/join` → `3/hour` per IP
  - `POST /auth/refresh` → `60/hour` per refresh-token-hash
  - `PUT /auth/me/pin` → `3/hour` per player
  - `PUT /predictions/{match_id}` → `60/hour` per player
  - `PUT /knockout-predictions/{match_id}` → `60/hour` per player
  - `GET /leaderboard` → `120/minute` per player
  - `POST /admin/sync/trigger` → `10/hour` per player
  - `POST /admin/backup` → `5/day` per player
  - `POST /notifications/test` → `5/hour` per player
  (~45 min)
- **R3.3** `routers/auth.py:141-172` — fix login enumeration:
  - On no-player-found: still run `bcrypt.checkpw` against a fixed dummy hash so response time matches the real-player path.
  - On `locked_until` true: return same generic `401 "Invalid credentials"` (not `429`). Log `account_locked_attempt` server-side.
  - Keep the failed-attempt counter logic. (~30 min, includes test)
- **R3.4** `auth.py:117-119` `get_current_player` — add `Profile.is_active.is_(True)` to the WHERE clause so soft-disabled players can't authenticate. (~10 min, includes test)

**Acceptance:** all rate-limited endpoints return 429 after threshold (one test each, parameterised); response times for valid vs invalid login fall in same band (within ±20 %); inactive player gets 401 on `/auth/me`.

---

## R4 — Scheduler race + scoring-preview parity 🔴 Opus (extended thinking ON) · ~2 h

- **R4.1** `apps/api/src/scheduler.py:107-115` — drop the `lock_due_matches` interval from `minutes=1` to `seconds=15`. Confirm `max_instances=1, coalesce=True` are still set. (~5 min)
- **R4.2** Defence in depth — kickoff re-check inside the PUT handlers (the actual safety net; the scheduler is just an optimisation):
  - `routers/predictions.py:104` — additional check `if match.kickoff_utc <= _now(): raise 409 PREDICTION_LOCKED` regardless of `match.status`.
  - `routers/knockout_predictions.py` — equivalent in `upsert_knockout_prediction`.
  - `routers/specials.py:171` — already covered by `_is_locked`; just verify the helper compares against `_now()` not session start.
  - Test: monkeypatch a match's `kickoff_utc` to 1 s ago, with `status=scheduled`, assert PUT returns 409. Reasoning here is the race window: scheduler hasn't fired yet, status is stale, kickoff has passed — server must still refuse. (~45 min)
- **R4.3** `packages/shared/src/scoring.ts` — take `stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third_place' | 'final'` and exclude `correctResult` when `stage !== 'group'` AND (predicted draw OR actual draw). Mirror lines 99-103 of `migrations/versions/004_scoring_function.py` exactly. Update every caller (`apps/web/src/...` — grep for `scoreMatchPrediction`). Vitest cases: knockout draw-on-draw scores 7 not 10; knockout win-on-win unchanged. (~60 min)

**Acceptance:** new prediction tests pass; new Vitest cases pass; no caller of `scoreMatchPrediction` left without a stage argument.

---

## R5 — Frontend resilience 🟢 Sonnet · ~2 h

- **R5.1** `apps/web/src/lib/api.ts:10` and `contexts/AuthContext.tsx:4` — replace the `?? 'http://localhost:8000'` fallback with a module-load assertion: throw a clear `Error("VITE_API_URL is required in production builds")` when `import.meta.env.PROD && !import.meta.env.VITE_API_URL`. Keep the localhost fallback only in dev. (~15 min)
- **R5.2** `apps/web/src/lib/tokens.ts:clearTokens` — also clear Workbox caches: `await caches.delete('api-user-data')` (and `'api-matches'` if you want a hard reset). `clearTokens` becomes async; update `AuthContext.logout` and `api.ts` retry path to `await` it. Test: after logout, `caches.has('api-user-data')` is false. (~30 min)
- **R5.3** `apps/web/src/hooks/useOfflineQueue.ts` — after `runFlush` returns, if `getQueueCount() > 0 && navigator.onLine`, schedule a retry with backoff (30 s → 60 s → 120 s, cap 5 min). Cancel on unmount or successful empty flush. Vitest: enqueue → flush succeeds for one entry, second entry added during flush, retry timer triggers second flush automatically. (~75 min)

**Acceptance:** production build with no env var fails fast at load; logout removes API caches; queue auto-replays even on a persistently-online session.

---

## R6 — Observability 🟢 Sonnet · ~2.5 h

- **R6.1** `migrations/versions/010_audit_log_action_types.py` — add `backup_failed` and `backup_downloaded` to the `audit_log.action_type` enum. (~15 min)
- **R6.2** `apps/api/src/scheduler.py:96-103` `run_scheduled_backup` — on exception, write an `AuditLog(action_type=backup_failed, actor_type=system, changes={"error": ...})` row and call a new `notify_backup_failed(db, reason)` (mirror `notify_auto_sync_failed`). Test: induced pg_dump failure produces both rows. (~45 min)
- **R6.3** `apps/api/src/routers/admin.py:download_backup` — write `AuditLog(action_type=backup_downloaded, actor_id=admin.id, changes={"filename": filename})` before returning the file. (~15 min)
- **R6.4** `apps/api/src/main.py:57` — `traces_sample_rate=0.0 if environment != "production" else 0.05`. (~5 min)
- **R6.5** Wrap each `await notify_*` call in `scheduler.py` and `services/result_sync.py` in `try/except Exception: log.exception(...)` so a failing push provider doesn't roll back the surrounding match update. (~30 min)
- **R6.6** Test: simulated push failure → match still committed, log line contains exception trace. (~30 min)

**Acceptance:** failing backup produces a push to admin + an audit row; downloading a backup produces an audit row; push provider raising never blocks scoring.

---

## R7 — Playwright smoke test 🟢 Sonnet · ~2.5 h

- **R7.1** Install `@playwright/test` in `apps/web`, scaffold `apps/web/playwright.config.ts`, write `apps/web/e2e/smoke.spec.ts`:
  1. Admin creates an invite via API (use a test bootstrap helper that seeds a known admin)
  2. Browser navigates to `/join/{token}`, submits name + PIN
  3. Browser PUTs a prediction for an upcoming seeded match
  4. Test helper advances `kickoff_utc` past now and waits for lock (or calls a `/test/lock-now/{match_id}` admin-only fixture endpoint)
  5. Admin posts a result via API
  6. Browser loads `/leaderboard`, asserts the test player has expected points
  
  Wire into `.github/workflows/ci.yml` — depend on backend tests passing, run against a Docker-spun-up Postgres + the FastAPI app. (~2.5 h incl. CI wiring)

**Acceptance:** smoke test is green in CI on a fresh PR; failing it blocks merge.

---

## Deployment audit batches (R8–R10) — added 2026-05-30

Fixes from the 2026-05-30 deployment-setup audit (the "seamless, zero manual
back-and-forth" review). Same batching rationale as R1–R7: one session, one PR,
themed for review-ability. Each item notes its audit finding id (C/H/M/L) so you
can cross-reference the original report. **Some audit findings are dashboard/infra
actions, not code** — those are listed under *Operator actions* below and are
intentionally not R-rows (nothing to merge or close out).

| Batch | Model | Effort | Items | Rationale |
|---|---|---|---|---|
| ~~R8~~ | ~~🟢 Sonnet~~ | ~~R8.1–R8.5~~ | ✅ Shipped 2026-05-30 |
| ~~R9~~ | ~~🟢 Sonnet~~ | ~~R9.1~~ | ✅ Shipped 2026-05-30 |
| ~~R10~~ | ~~🟢 Sonnet~~ | ~~R10.1–R10.3~~ | ✅ Shipped 2026-05-30 |

Land **R8 first** — R9, R10, and the operator actions all reference the SHA
endpoint it adds.

---

## R8 — Deploy detection & fail-fast 🟢 Sonnet · ~3 h

> Why this batch exists: the audit's top finding (C2) is that the backend exposes
> no running-commit signal, so the incident that already happened — Railway serving
> a stale image while `/api/v1/health` returns 200 — is invisible to `/ship-prod`'s
> verification. This batch makes "is the new code actually live?" answerable, and
> makes a few near-misses fail fast instead of silently.

- **R8.1** (audit C2) `apps/api/src/config.py` + `apps/api/src/routers/health.py:12` — read the Railway-injected commit SHA into Settings (Railway provides `RAILWAY_GIT_COMMIT_SHA` to the deploy env — **confirm the exact var name in the Railway dashboard before coding**; default `None`) and return it from `GET /api/v1/health` as `{"status":"ok","sha":<sha|"unknown">}`. Then in `.claude/commands/ship-prod.md` Step 3, after the health curl, assert the returned `sha` equals the just-pushed `main` HEAD SHA; if it differs or is `unknown`, fail the promotion with a clear "backend still serving a previous image — check the Railway source/branch trigger (Operator action OP2)" message. (~60 min)
- **R8.2** (audit L1) `apps/api/src/routers/health.py:17-25` — `GET /api/v1/health/ready` must return HTTP **503** (not 200) on the DB-unreachable branch, keeping the JSON body. Test: monkeypatch the session to raise, assert status 503 and `db:"unreachable"`. (~20 min)
- **R8.3** (audit M4, narrowed) `apps/api/src/config.py` — **extend the existing prod-config validator added in R1.1** (do not build a new one): when `environment == "production"`, also reject a `frontend_origin` that is empty or starts with `http://localhost`, and reject an empty `database_url`. R1.1 already covers the JWT/VAPID/Supabase/football-data secrets — only add the two it doesn't. Test: prod env + localhost origin → app refuses to start. (~25 min)
- **R8.4** (audit L2) `migrations/env.py` — set a short `lock_timeout` (e.g. `SET lock_timeout = '5s'`) on the migration connection in `run_migrations_online`, so a migrate-on-boot blocked on a lock fails fast instead of hanging toward the 300 s Railway healthcheck timeout. Transactional DDL still rolls back cleanly. (~20 min)
- **R8.5** (audit M1) `.claude/commands/ship-prod.md` Step 3 — add a post-deploy synthetic that goes through the deployed prod frontend origin to a real read-only API route (e.g. `/api/v1/matches/upcoming`) and asserts 2xx + expected shape, so a prod-only env/CORS mismatch (which a green staging run cannot catch) surfaces at promote time. Runs after R8.1's SHA gate. (~30 min)

**Acceptance:** `pytest` green incl. new health tests (503 on DB down; `sha` present in `/health`); the prod-config validator rejects a localhost `FRONTEND_ORIGIN` in production with a test proving it; `ship-prod.md` documents the SHA assertion + synthetic as hard gates. No infra changes in this batch — branch protection etc. are Operator actions.

---

## R9 — CI runs the production frontend bundle 🟢 Sonnet · ~1.5 h

> Why: the `VITE_API_URL` hard-assert (shipped in R5.1) is gated on
> `import.meta.env.PROD`, and Playwright's webServer is `pnpm dev`
> (`apps/web/playwright.config.ts:23`), so the assert is dead in CI — a missing
> `VITE_API_URL` passes lint + build + e2e + smoke and only breaks in a real
> browser. This batch makes CI execute the prod bundle.

- **R9.1** (audit M2) `apps/web` + `.github/workflows/ci.yml` — add a CI step (or a dedicated Playwright project) that builds the web app in production mode (`vite build` with `VITE_API_URL` set to a dummy `https://` origin), serves it with `vite preview`, loads `/` headless, and asserts (a) no uncaught module-load error and (b) the served bundle references the configured API origin. Add a negative case: build with `VITE_API_URL` **unset**, load the page, and assert the R5.1 module-load throw fires (in a step allowed to fail, matching the thrown message) so the guard can't silently regress. Keep this separate from the existing dev-server `e2e`/`smoke` jobs. (~90 min)

**Acceptance:** CI has a job/step that loads the production-built bundle in a browser and goes red when `VITE_API_URL` is missing at build time; existing `e2e`/`smoke` jobs unchanged.

---

## R10 — Deploy docs reconciliation 🟢 Sonnet · ~1 h

> Doc-only, zero deploy risk — but incident-time-critical: today's runbook points
> operators at the wrong prod host and a deleted staging backend.

- **R10.1** (audit H2) `docs/runbooks/deploys-ongoing.md` — replace every `wc2026.vercel.app` with the canonical prod host `wc2026-prod.vercel.app` (lines 28, 41, 73, 94, 219) and the deleted `wc2026-api-production-333a.up.railway.app` with `wc2026-predictor-staging.up.railway.app` (line 44). Fix the rollback section and the local-deploy escape hatch so they target the real prod Vercel project. Cross-check against memory `reference_prod_urls.md` / `reference_staging_urls.md` (authoritative). (~30 min)
- **R10.2** (audit L3) Same file (or `CLAUDE.md`) — add a one-paragraph note that the backend assumes a **single Railway replica**: APScheduler jobs and migrate-on-boot have no leader election, so scaling to 2+ replicas would double-fire scheduled jobs and race on migrations. (~10 min)
- **R10.3** (audit M4, doc half) New `docs/runbooks/env-manifest.md` (or a table in `deploy.md`) — list every runtime var from `.env.example` and which surface owns it per env: Railway `production`/`staging` vs Vercel `wc2026-prod`/`wc2026-staging`, flagging the ones whose mismatch breaks prod silently (`VITE_API_URL`, `FRONTEND_ORIGIN`, `DATABASE_URL`, `SCHEDULER_ENABLED`). Reference it from `.env.example`. (~20 min)

**Acceptance:** `grep -rnE "wc2026\.vercel\.app|333a" docs/runbooks/deploys-ongoing.md` returns nothing; the single-replica assumption is written down; an env-var ownership manifest exists and `.env.example` links to it.

---

### Operator actions (no code — do these in the GitHub / Railway / Vercel dashboards)

Not R-batches: there is nothing to merge or close out, so they do not run through
`/ship-staging` or `/phase-closeout`. Tick them here when done.

- [ ] **OP1** (audit H1) — Enable GitHub branch protection on `main` **and** `staging`: require the `CI` workflow to pass before merge. This is the only thing that makes the `/ship-prod` gate un-bypassable by a direct `git push origin main`.
- [ ] **OP2** (audit C1) — In the Railway `wc2026-api-prod` project, verify both environments' GitHub **Source → branch → deploy-on-push** triggers are connected (`production`→`main`, `staging`→`staging`). Record the settings here so re-establishing them after any project change is mechanical. This is the trigger that silently went missing in the 2026-05-29 incident.
- [ ] **OP3** (audit M3) — Confirm the Railway `staging` env sets `SCHEDULER_ENABLED=false` (the code default is `True`, `apps/api/src/config.py:42`). Otherwise staging polls football-data.org every 5 min and sends real web-push alongside prod.
- [x] **OP4** (audit H2, infra half) — N/A: `wc2026.vercel.app` is not owned by this project. Canonical prod frontend is `wc2026-prod.vercel.app`; no action required.
- [ ] **OP5** (audit L4) — Scope `VERCEL_TOKEN` to the narrowest available access and confirm the annual rotation reminder in `deploys-ongoing.md`.

---

## Notes on close-out

Each batch closes out the same way phase batches do: `/phase-closeout R<n>` after CI is green, append a short entry to `session-log.md`, strike the row above. Generate each batch's paste-prompt with `/next-batch-prompt review` — review mode reads this file directly (acceptance lives inline per `## R<N>` section), so no inline pasting is needed.
