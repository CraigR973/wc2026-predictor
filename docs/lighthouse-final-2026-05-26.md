# Lighthouse final — 26 May 2026

Phase 4 verification run, comparing against
`docs/lighthouse-baseline-2026-05-25.md` (captured before U1).

## Run details

| Field | Value |
|---|---|
| Target | `https://wc2026-staging.vercel.app/login` (same URL as baseline) |
| Lighthouse version | 12.8.2 |
| Form factor | mobile (default emulation, throttled) |
| Fetched at | 2026-05-26T16:27:33Z |
| `main` HEAD | `5816fd9` — "docs: mark Batch U5 shipped" |

## Category scores

| Category | Baseline | Final | Δ | Target met? |
|---|---|---|---|---|
| **Performance** | **0.82** | **0.92** | **+0.10** | ✅ target 0.90 |
| Accessibility | 0.96 | 0.96 | 0 | ⚠️ target 1.00 — see "Remaining issue" below |
| Best Practices | 1.00 | 1.00 | 0 | ✅ |
| SEO | 1.00 | 1.00 | 0 | ✅ |

## Web Vitals

| Metric | Baseline | Final | Δ | Notes |
|---|---|---|---|---|
| First Contentful Paint | 1.9 s | **1.7 s** | −202 ms | self-hosted fonts (U1.5) |
| Largest Contentful Paint | 2.5 s | **2.5 s** | −60 ms | wordmark; same value, score 0.89 → 0.90 |
| **Total Blocking Time** | **540 ms** | **260 ms** | **−281 ms (−52 %)** | ✅ beat 400 ms target |
| Cumulative Layout Shift | 0.02 | 0.02 | 0 | unchanged |
| Speed Index | 2.3 s | **1.7 s** | −666 ms | |
| Time to Interactive | 3.3 s | **2.5 s** | −817 ms | |
| Max Potential FID | 360 ms | **216 ms** | −140 ms | |
| Server response time | 23 ms | 20 ms | unchanged (Vercel edge) |

## Resource summary (cold `/login`)

| Type | Baseline | Final | Δ |
|---|---|---|---|
| Total | 318 KB | 326 KB | +8 KB |
| Document | 1.6 KB | 1.6 KB | 0 |
| Stylesheet | 9.8 KB | 8.6 KB | −1.2 KB |
| Script | 105.3 KB | 129.3 KB | +24.0 KB (U2–U5 components) |
| Font | 64.0 KB | 49.3 KB | −14.7 KB (self-hosted + scoped to splash) |
| Image | 133.3 KB | 130.1 KB | −3.2 KB |
| Other | 4.4 KB | 6.9 KB | +2.5 KB |
| **Third-party** | **65.9 KB** | **0.5 KB** | **−65.4 KB** (Google Fonts removed) |

## Remaining issue — Accessibility 0.96

One `color-contrast` audit still failing on the primary CTA button:

- `button.w-full` (the Sign-in button on `/login`)
- Foreground `#FFFFFF`, background `#10B981` (light-mode primary at `#059669` also fails)
- Measured contrast 2.53 — needs 4.5 minimum for AA

This was specified in U3.11's acceptance criteria but only the
`--text-muted` half of U3.11 shipped — the primary-button on-colour
fix didn't. **The token `--text-inverse` resolves to `#FFFFFF` in
light mode**, and the `default` Button variant uses `text-text-inverse`.

**Proposed fix** (5-minute follow-up, not yet applied):

1. Add a new token `--on-primary: #0B0E13` (same value in both modes, since the primary green is dark enough in either mode that dark text reads cleanly)
2. Register `'on-primary': 'var(--on-primary)'` in `apps/web/tailwind.config.ts`
3. Update `apps/web/src/components/ui/button.tsx`:
   - `default` variant: `text-text-inverse` → `text-on-primary`
   - `accent` variant: same swap (also currently broken in light mode, white on `#A77C2A` ≈ 3.7:1)
4. Re-run Lighthouse → expect Accessibility 1.00

Without this, accessibility floor (0.96 — no regression) is held but
target (1.00) is missed.

## How to reproduce

```sh
PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" \
  npx --yes lighthouse https://wc2026-staging.vercel.app/login \
  --form-factor=mobile --screenEmulation.mobile=true \
  --output=json --output-path=/tmp/lh-staging-login-post.json \
  --quiet --chrome-flags="--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage"
```
