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
