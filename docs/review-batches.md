# Pre-launch review batches (R1–R7)

Fixes from the 2026-05-18 pre-launch review, grouped to amortize the cold
system prompt: same-model adjacent, same files / conceptual area together,
shared helpers before their consumers. Each batch is one session, one PR.

Mark batches complete by striking through the row.

| Batch | Model | Effort | Items | Rationale |
|---|---|---|---|---|
| ~~R1~~ | ~~🟢 Sonnet~~ | ~~~2 h~~ | ~~R1.1–R1.5~~ | ✅ Shipped 2026-05-18 |
| ~~R2~~ | ~~🔴 Opus (extended thinking)~~ | ~~~3 h~~ | ~~R2.1–R2.5~~ | ✅ Shipped 2026-05-19 |
| R3 | 🟢 Sonnet | ~2.5 h | R3.1–R3.4 | Auth & rate limits — unify Limiter, apply spec §8.3 decorators across every endpoint, login enumeration fix, is_active enforcement. Mechanical, well-known patterns. |
| R4 | 🔴 Opus (extended thinking) | ~2 h | R4.1–R4.3 | Scheduler race + scoring-preview parity — kickoff re-check in PUT, drop poll to 15 s, frontend scoring takes `stage`. Race-window reasoning + TS/SQL math parity. |
| R5 | 🟢 Sonnet | ~2 h | R5.1–R5.3 | Frontend resilience — VITE_API_URL hard-assert, SW cache clear on logout, offline-queue auto-retry. All frontend, same area. |
| R6 | 🟢 Sonnet | ~2.5 h | R6.1–R6.4 | Observability — backup-failure alerting, backup-download audit log, env-aware Sentry rate, notification dispatch error wrapping. CRUD-shaped. |
| R7 | 🟢 Sonnet | ~2.5 h | R7.1 | One Playwright smoke test in CI: join → predict → lock → score → leaderboard. Mostly scaffolding. |

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

## Notes on close-out

Each batch closes out the same way phase batches do: `/phase-closeout R<n>` after CI is green, append a short entry to `session-log.md`, strike the row above. The next-batch prompt generator (`/next-batch-prompt`) won't work out-of-the-box for these since the items aren't phases in `wc2026-architecture.md`; either paste the items inline when starting each session, or extend the skill to look here as a fallback.
