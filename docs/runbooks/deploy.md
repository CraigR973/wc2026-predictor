# Runbook: First-Time Deployment

Use this runbook to deploy the WC 2026 Predictor from scratch onto Supabase (Postgres) + Railway (FastAPI backend) + Vercel (React frontend). Follow the steps in order; each one assumes the previous step succeeded.

Run this **twice** — once for a `staging` environment, then again for `production`. Staging shakes out env-var typos before any real players see them.

---

## Prerequisites

- Accounts: GitHub (repo access), [Supabase](https://supabase.com), [Railway](https://railway.app), [Vercel](https://vercel.com)
- CLIs installed locally:
  - `psql` (for migrations + manual SQL)
  - `node` ≥ 20 and `pnpm`
  - Python 3.11 with the project venv at `apps/api/.venv/`
  - `railway` CLI (`npm i -g @railway/cli`)
  - `vercel` CLI (`npm i -g vercel`)
- A working clone of this repo at `/Users/craigrobinson/wc_2026_predictor`
- A football-data.org API key — register at <https://www.football-data.org/client/register> (free tier, requires email confirmation)

---

## Step 1 — Provision the Supabase project

1. In the Supabase dashboard, create a new project (region: nearest to Railway region — usually `eu-west-1` if your players are UK).
2. Wait ~2 min for provisioning, then capture from **Project Settings → API**:
   - Project URL → `SUPABASE_URL`
   - `anon` public key → `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY` (same value)
   - `service_role` key → `SUPABASE_SERVICE_KEY` (backend only, never expose)
3. Capture from **Project Settings → Database → Connection string**:
   - URI form, with the password you set at project creation → `DATABASE_URL`
   - **Important:** rewrite the scheme from `postgresql://` to `postgresql+asyncpg://` for the backend (the app uses asyncpg).

> Staging vs prod: create **two separate Supabase projects**, not branches. Service keys are project-scoped; sharing them between envs leaks prod creds into staging.

---

## Step 2 — Generate the JWT + VAPID secrets

JWT secrets (need at least 32 chars each; the two values must differ):

```bash
python -c "import secrets; print('ACCESS=', secrets.token_urlsafe(48)); print('REFRESH=', secrets.token_urlsafe(48))"
```

VAPID keypair (one set per environment — staging and prod must NOT share):

```bash
/Users/craigrobinson/wc_2026_predictor/apps/api/.venv/bin/python -m pip install py-vapid
/Users/craigrobinson/wc_2026_predictor/apps/api/.venv/bin/python - <<'PY'
from py_vapid import Vapid01
v = Vapid01()
v.generate_keys()
print('VAPID_PUBLIC_KEY=', v.public_key.decode())
print('VAPID_PRIVATE_KEY=', v.private_key.decode())
PY
```

Record these in a password manager. You'll paste them into Railway + Vercel in the next steps.

> **Gotcha:** the public key goes into BOTH `VAPID_PUBLIC_KEY` (backend signs push requests) and `VITE_VAPID_PUBLIC_KEY` (frontend subscribes the browser). Same value, two variable names.

---

## Step 3 — Apply migrations to Supabase

From the repo root, run Alembic against the new Supabase Postgres:

```bash
export DATABASE_URL='postgresql+asyncpg://postgres:<password>@<host>:5432/postgres'
PYTHONPATH=/Users/craigrobinson/wc_2026_predictor/apps/api \
  /Users/craigrobinson/wc_2026_predictor/apps/api/.venv/bin/alembic \
  -c /Users/craigrobinson/wc_2026_predictor/apps/api/alembic.ini \
  upgrade head
```

Expect 7 migrations to apply (`001_core_schema` through `007_profile_is_active`). Verify with:

```bash
psql "${DATABASE_URL/postgresql+asyncpg/postgres}" -c "\dt"
```

You should see the full schema (profiles, matches, predictions, leaderboard_snapshots, etc.).

---

## Step 4 — Seed tournament data

The seed script is idempotent: groups + teams upserted by code, matches by `match_number`. Re-runnable safely.

```bash
cd /Users/craigrobinson/wc_2026_predictor/apps/api
DATABASE_URL='postgresql+asyncpg://postgres:<password>@<host>:5432/postgres' \
  PYTHONPATH=. .venv/bin/python -m src.seed
```

Expect: 12 groups, 48 teams, 72 group-stage matches loaded. Knockout matches are NOT seeded — they're created automatically after the group stage completes.

`football_data_match_id` columns remain NULL until the sync job populates them — that happens on the first scheduler tick once Railway is up with `FOOTBALL_DATA_API_KEY` set.

---

## Step 5 — Deploy the backend to Railway

```bash
cd /Users/craigrobinson/wc_2026_predictor
railway login
railway init           # pick "Empty Project", name it wc2026-api-{staging,prod}
railway link
```

In the Railway dashboard, set the service root directory to `apps/api` and the start command to:

```
python -m uvicorn src.main:app --host 0.0.0.0 --port $PORT
```

Add **all** of these env vars in the Railway service (Settings → Variables):

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://...` (from Step 1, NOT the pooled URL) |
| `SUPABASE_URL` | from Step 1 |
| `SUPABASE_SERVICE_KEY` | from Step 1 |
| `JWT_ACCESS_SECRET` | from Step 2 |
| `JWT_REFRESH_SECRET` | from Step 2 |
| `VAPID_PUBLIC_KEY` | from Step 2 |
| `VAPID_PRIVATE_KEY` | from Step 2 |
| `VAPID_CONTACT_EMAIL` | your real email — push services may reject placeholder addresses |
| `FOOTBALL_DATA_API_KEY` | from the football-data.org dashboard |
| `FRONTEND_ORIGIN` | leave blank for now — set in Step 7 after Vercel gives you a URL |
| `SENTRY_DSN_BACKEND` | optional (see Step 9) |

Verify `pg_dump` is in the Railway image PATH (it should be on the default Python image). The daily backup job at 03:00 UTC will fail loudly if it's not — check the first day's scheduler logs.

Deploy:

```bash
railway up
```

Once deployed, capture the Railway-generated domain (e.g. `wc2026-api-staging.up.railway.app`). Smoke test:

```bash
curl https://wc2026-api-staging.up.railway.app/api/v1/health
curl https://wc2026-api-staging.up.railway.app/api/v1/health/ready
```

Both must return `200` with `{"status": "ok"}` and `{"status": "ready", "db": "ok"}` respectively. If `/health/ready` returns `db: unreachable`, your `DATABASE_URL` is wrong — most often the asyncpg scheme prefix is missing.

---

## Step 6 — Deploy the frontend to Vercel

```bash
cd /Users/craigrobinson/wc_2026_predictor/apps/web
vercel login
vercel link    # create new project, name it wc2026-{staging,prod}
```

In the Vercel dashboard, confirm:

- **Framework Preset:** Vite (auto-detected)
- **Root Directory:** `apps/web`
- **Build Command:** `pnpm build`
- **Output Directory:** `dist`

Add env vars (Settings → Environment Variables → Production):

| Variable | Value |
|---|---|
| `VITE_API_URL` | the Railway URL from Step 5, e.g. `https://wc2026-api-staging.up.railway.app` |
| `VITE_SUPABASE_URL` | from Step 1 |
| `VITE_SUPABASE_ANON_KEY` | from Step 1 |
| `VITE_VAPID_PUBLIC_KEY` | from Step 2 (same as backend's `VAPID_PUBLIC_KEY`) |
| `VITE_SENTRY_DSN` | optional (see Step 9) |

Deploy:

```bash
vercel --prod
```

Capture the assigned domain (e.g. `wc2026-staging.vercel.app`).

---

## Step 7 — Close the CORS loop

Go back to Railway and set:

```
FRONTEND_ORIGIN=https://wc2026-staging.vercel.app
```

Redeploy the backend so the new env takes effect (`railway up` or the dashboard's "Redeploy" button). Then verify CORS from the frontend domain:

```bash
curl -I -X OPTIONS https://wc2026-api-staging.up.railway.app/api/v1/health \
  -H "Origin: https://wc2026-staging.vercel.app" \
  -H "Access-Control-Request-Method: GET"
```

Look for `access-control-allow-origin: https://wc2026-staging.vercel.app` in the response headers.

---

## Step 8 — Bootstrap the first admin

There is no CLI bootstrap; this is intentional (no env-driven privilege escalation). Do it in three sub-steps:

**8a. Create your join invite directly in the database** (chicken-and-egg: no admin exists yet to call the admin API).

```bash
psql "${DATABASE_URL/postgresql+asyncpg/postgres}" <<'SQL'
INSERT INTO invites (token, display_name_hint, is_active, created_at)
VALUES (gen_random_uuid()::text, 'Admin', true, now())
RETURNING token;
SQL
```

Copy the returned token.

**8b. Join via the frontend**: visit `https://<frontend>/join/<token>`, set your display name + PIN + timezone. You'll be auto-logged-in as a regular `player`.

**8c. Promote yourself to admin** by direct SQL (look up your `id` from the `profiles` table):

```bash
psql "${DATABASE_URL/postgresql+asyncpg/postgres}" -c \
  "UPDATE profiles SET role = 'admin' WHERE display_name = 'Admin';"
```

Refresh the frontend — the **Admin** nav link should now appear. From `/admin/invites` you can issue invites for the other 14 players without ever touching SQL again.

---

## Step 9 — (Optional) Wire up Sentry

If you want centralised error tracking:

1. Create two Sentry projects: `wc2026-api` (FastAPI/Python) and `wc2026-web` (React).
2. Set `SENTRY_DSN_BACKEND` in Railway and `VITE_SENTRY_DSN` in Vercel.
3. Trigger a test error from each to confirm events land in Sentry.

PII scrubbing is already enabled in both `apps/api/src/main.py` and `apps/web/src/sentry.ts` — names + PINs are stripped before transmission.

---

## Step 10 — End-to-end smoke test

Sign in as admin, then verify each flow against the deployed staging stack:

- [ ] `/` Dashboard renders with rank `—` and "No upcoming matches" (no results yet)
- [ ] `/schedule` lists all 72 group-stage matches
- [ ] `/groups` shows 12 groups with 4 teams each
- [ ] `/predictions` shows the group tabs and accepts a saved score
- [ ] `/bracket` shows the empty-state "Bracket isn't ready yet"
- [ ] `/settings` → enable push notifications, click **Send test** → notification arrives on the device
- [ ] `/admin/sync` → click **Sync Now** → verify it returns success and updates `last_sync_at` (football-data.org may have no live matches yet — that's fine, `last_sync_action: no_changes` is the expected response pre-tournament)
- [ ] `/admin/invites` → create an invite, copy the link, open in a private window, join as a second player

If any step fails, check **Railway logs** (`railway logs`) and **browser DevTools console** — most prod-only issues are env-var typos that surface here.

---

## Step 11 — Promote to production

Repeat Steps 1–10 with `-prod` names everywhere. **Use a separate Supabase project, separate Railway service, separate Vercel project, and a fresh VAPID keypair** — sharing any of these between staging and prod defeats the point of staging.

Once prod is green, share invite links with the real players.

---

## Common failure modes

| Symptom | Likely cause |
|---|---|
| Frontend loads but every API call returns CORS error | `FRONTEND_ORIGIN` on Railway doesn't match the Vercel domain exactly (must include scheme, no trailing slash) |
| `/health/ready` returns `db: unreachable` | `DATABASE_URL` is missing the `+asyncpg` scheme suffix, or the Supabase password contains characters that need URL-encoding |
| Push subscription returns `InvalidAccessError` | `VITE_VAPID_PUBLIC_KEY` doesn't match the `VAPID_PUBLIC_KEY` Railway is signing with, or one of them is from a different env |
| Service worker never registers | The site is not served over HTTPS — Vercel does this automatically, but a custom domain in pending-verification state can serve HTTP briefly |
| Daily backup at 03:00 UTC fails | `pg_dump` is not in the Railway image PATH — add a Nixpacks step or switch to a Postgres-bundled base image |
| Auto-sync logs `401 Unauthorized` | `FOOTBALL_DATA_API_KEY` invalid or quota exceeded — free tier is 10 requests/min, 100 requests/day per key |
