# Runbook: Ongoing Deploys

Deploy patterns for day-to-day work after the initial setup in
[`deploy.md`](deploy.md). Covers the normal change → staging → prod flow,
hotfixes, and rollback.

---

## The setup, in one diagram

```
feat/foo ──┐
fix/bar  ──┼─► PR ─► merge ──► staging branch ──┐         ┌──► wc2026-staging.vercel.app
chore/xyz ─┘                                    │ CI gate │     (staging API + staging DB)
                                                ▼         ▼
                                          GitHub Actions ─┤
                                          (deploy job)    │
                                                          │
                                          merge staging → main ──► wc2026-prod (Vercel auto)
                                                                   └► wc2026.vercel.app
                                                                      (prod API + prod DB)
```

| What | Where it deploys | How it deploys |
|---|---|---|
| Push to `main` | `wc2026.vercel.app` (custom prod) | Vercel GitHub integration auto-deploys |
| Push to `staging` | `wc2026-staging.vercel.app` | GitHub Actions `deploy-staging` job in `ci.yml` runs after every other job passes, then `vercel deploy --prebuilt --prod` |
| Push to any other branch | nothing | Both Vercel projects skip the build (ignore-build-step) |
| Local CLI `vercel deploy` | one-off preview URL on whichever project's linked | rare — only when staging is currently in use by someone else |

---

## Normal change flow

1. **Branch off `main`**:
   ```bash
   git checkout main && git pull --ff-only origin main
   git checkout -b feat/whatever  # or fix/, chore/
   ```
2. **Develop, commit, push**. CI runs but no deploy.
3. **Open a PR into `main`** (target = `main`, not `staging`). PR previews on Vercel are off — verify on staging instead.
4. **Merge into `staging`** (fast-forward where possible):
   ```bash
   git checkout staging && git pull --ff-only origin staging
   git merge --no-ff feat/whatever -m "merge: feat/whatever -> staging"
   git push origin staging
   ```
   GitHub Actions runs the full CI suite. On success, deploys to
   `https://wc2026-staging.vercel.app`. **Test on iPhone here.**
5. **When happy, merge `staging` → `main`** (or merge the original PR):
   ```bash
   git checkout main && git pull --ff-only origin main
   git merge --ff-only staging  # or non-ff if there are merge commits
   git push origin main
   ```
   Vercel auto-deploys to `https://wc2026.vercel.app`. **Live in ~90 s.**

> [!NOTE]
> Tests + typecheck + lint + alembic-migration-check + Playwright smoke
> are a **hard gate** on the staging branch. The `deploy-staging` job in
> `.github/workflows/ci.yml` won't fire unless every other job in the
> same run succeeded.

---

## Hotfix flow (production is broken)

The fastest fix is to roll back, not roll forward.

### Rollback (~30 s)

In the Vercel dashboard for `wc2026-prod`:
1. Go to **Deployments** tab.
2. Find the last known-good production deployment (look for the green
   ✓ + "Production" badge before the bad one).
3. Hover the row → **⋯** menu → **Promote to Production**.
4. Confirm. The custom domain (`wc2026.vercel.app` + any alias) repoints
   in seconds.

This rolls back the **frontend only**. If the broken release also
shipped a backend migration, follow the schema-change section below.

### Roll forward instead (if rollback won't help)

1. Branch off `main` (which is the broken state):
   ```bash
   git checkout main && git pull origin main
   git checkout -b fix/$(date +%Y%m%d)-something
   ```
2. Fix, commit, push.
3. Open a PR → `main`. **Skip the staging merge** for time-critical hotfixes.
4. Merge to `main`. Vercel auto-deploys in ~90 s.

> [!WARNING]
> The "skip staging" route bypasses iPhone-touch validation on the staging
> URL. Only use during an active outage or a kickoff-time fire. For
> anything non-urgent, do the normal `staging → main` two-step.

---

## Schema changes (backend migration + frontend)

When a PR touches both:

1. **Order matters**: migrate first, deploy frontend second.
2. Railway auto-applies migrations on container boot (per
   `apps/api/Dockerfile` CMD). So:
   - Merge the backend-only part of the change → Railway redeploys →
     migrations apply.
   - Verify backend health: `curl https://wc2026-api-production-a0f4.up.railway.app/api/v1/health`
   - Merge the frontend part → Vercel deploys.
3. **Avoid backwards-incompatible migrations** during the live tournament
   window (Jun 11 – Jul 19, 2026). Keep new columns nullable, add before
   removing, etc.

---

## Kickoff-time freeze

During the **30 minutes before and 30 minutes after** any scheduled match
kickoff, don't push to `main`. Players are submitting predictions and any
deploy briefly interrupts in-flight requests.

- Find the next kickoff: `Schedule` page on the live site, or query
  `/api/v1/matches/upcoming?n=1`.
- If a hotfix is truly required during this window, ship it but warn the
  player group on whatever channel you use.

---

## Operational concerns

### Where to look when something's off

- **Vercel deployments**:
  [vercel.com/craigr973s-projects/wc2026-prod/deployments](https://vercel.com/craigr973s-projects/wc2026-prod/deployments)
  [vercel.com/craigr973s-projects/wc2026-staging/deployments](https://vercel.com/craigr973s-projects/wc2026-staging/deployments)
- **GitHub Actions runs**:
  [github.com/CraigR973/wc2026-predictor/actions](https://github.com/CraigR973/wc2026-predictor/actions)
- **Railway backend logs**: `railway logs --service wc2026-api`
- **Sentry frontend + backend errors**: see project links in
  `~/.claude/projects/-Users-craigrobinson-wc-2026-predictor/memory/`
- **Supabase tables**: dashboard or use the Supabase MCP.

### Required secrets

- `VERCEL_TOKEN` on the GitHub repo (used by `deploy-staging` job in CI).
  Rotate annually via [vercel.com/account/tokens](https://vercel.com/account/tokens).
- `GITHUB_TOKEN` available in `.env` locally (for ad-hoc CI status
  polling and the gh-less PR creation flow).

### What auto-deploy will NOT catch

- A frontend that builds but throws at module load (R5 hard-assert
  catches `VITE_API_URL` missing; other env vars don't have asserts).
- A backend migration that runs but corrupts data (no automated
  rollback — see `restore.md`).
- A 4xx/5xx surge on the API (set up uptime monitoring before launch).
- A PWA service worker that updates but the cached old assets stay on a
  user's home-screen icon (the SW now has `skipWaiting + clientsClaim`,
  so this is mostly resolved, but iOS still caches the icon itself
  separately — icon changes need a reinstall).

---

## Local manual deploy (escape hatch)

Only use when the GitHub Action pipeline is broken and you need to push
something out right now.

```bash
cd apps/web

# Deploy to staging (overwrites wc2026-staging.vercel.app)
VERCEL_PROJECT_ID=prj_hVMpuWm33XjuNrVUWrCti27ZfIX7 \
VERCEL_ORG_ID=team_MVQMOaFtYHlwO5QVzSOZQ0Ud \
vercel deploy --prod --yes

# Deploy to prod (overwrites wc2026.vercel.app — be careful)
VERCEL_PROJECT_ID=prj_xSA1k6vKHfk0KLRjGNPUTluZD8UT \
VERCEL_ORG_ID=team_MVQMOaFtYHlwO5QVzSOZQ0Ud \
vercel deploy --prod --yes
```

Requires `vercel login` to have been run on the laptop. Skips all CI
checks — use sparingly.
