# Premium polish round 2 — batches (U1–U5)

Implementation plan for the items locked in by the 2026-05-25 design audit
(`docs/design-audit-2026-05-25.md`) and the chosen logo direction
(Concept 3 — bold S letterform with football pentagon panel, see
`docs/logo-concepts/`).

Same idea as `review-batches.md`: group same-model adjacent work, one
conceptual area per batch, ship-able in a single focused session.

Mark batches complete by striking through the row.

| Batch | Model | Effort | Items | Status |
|---|---|---|---|---|
| ~~U1~~ | ~~🟢 Sonnet~~ | ~~~3.5 h~~ | ~~U1.1–U1.5~~ | ~~Shipped e12a942~~ |
| ~~U2~~ | ~~🟢 Sonnet~~ | ~~~3 h~~ | ~~U2.1–U2.6~~ | ~~Shipped dbf1469~~ |
| ~~U3~~ | ~~🟢 Sonnet~~ | ~~~4.5 h~~ | ~~U3.1–U3.11~~ | ~~Shipped d643644~~ |
| ~~U4~~ | ~~🟢 Sonnet~~ | ~~~3.5 h~~ | ~~U4.1–U4.7~~ | ✅ Shipped 2026-05-26 |
| ~~U5~~ | ~~🔴 Opus (extended thinking)~~ | ~~~3 h~~ | ~~U5.1–U5.5~~ | ✅ Shipped 2026-05-26 |

**Total ≈ 17 h** across 5 focused sessions.

Each batch ships as one PR off `feat/premium-polish`. Do not merge to
`main` until all five are done and the user has finished a real-phone
soak — see "Close-out" notes at the bottom.

---

## Scope guardrails

**In scope for this round:**
- The five batches below — roughly one third of the audit findings, picked from the audit's recommended priority list (Q-13).

**Explicitly out of scope, tracked separately:**
- Backend leaderboard duplicate-rows bug (C-2) — backend ticket, not this PR.
- Recharts → hand-rolled SVG chart (LH-2) — 107 KB gzipped win, but disrupts the polish flow; future ticket.
- Live-match surface (Journey 3), knockout-transition celebration (Journey 4), end-of-tournament podium (Journey 5) — bigger features, separate scope decision.
- First-run coachmark (Q-10 recommended "no" — better served by an About page).
- Dedicated About / How-it-works page (C-11) — future ticket; not yet locked.
- "Still Email?" tagline copy (C-9) — keep as-is, see Q-2.

**Implementation pre-conditions (set by audit):**
- Logo direction = Concept 3 (`docs/logo-concepts/concept-3-letterform.svg`).
- Brand-voice recurring element = 1-px brass divider under page headers (Q-3 option a).
- Light + dark mode both supported (Q-1 — keep both, pixel-check both in Phase 4).
- Bundle baseline locked in audit doc Phase 1 section — compare in Phase 4.

---

## U1 — Logo identity + brand-voice element 🟢 Sonnet · ~3 h

The single highest-leverage visual change in the round: a real mark + a
recurring brand element that lifts every page.

- **U1.1** Refine `docs/logo-concepts/concept-3-letterform.svg`:
  - Convert any remaining `<text>` to outlined `<path>` so the mark is fully portable (currently the concept uses path-based S — no text — but double-check)
  - Tighten the pentagon panel's optical centring; verify at 16, 32, 64, 96, 192, 512 px
  - Produce **maskable variant** (mark inset to 80 % to fit Android's safe zone) in `apps/web/public/icon-maskable-512.png`
  - Export `apps/web/public/icon-192.png` (replace existing), `apps/web/public/icon-512.png` (replace existing), `apps/web/public/icon-384.png` (new)
  - Generate `apps/web/public/favicon.svg` (vector, scales perfectly) and `apps/web/public/favicon.ico` (32×32 fallback for old browsers)
  - Optional: `apps/web/public/apple-touch-icon.png` (180×180 PNG, padded — Apple ignores manifest maskable hints)
  (~75 min)

- **U1.2** `apps/web/index.html` — wire the new favicon set:
  ```html
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  ```
  Update `apps/web/vite.config.ts` `VitePWA.includeAssets` to list the new files; add the maskable icon entry to `manifest.icons`.
  (~20 min)

- **U1.3** `apps/web/src/components/Brand.tsx`:
  - Add a new `variant="lockup"` rendering the mark to the **left** of the wordmark (icon + type on one line) — for use on the splash
  - Add a `variant="mark"` rendering just the mark (16/24/32 px sizes) — for use in places we previously used the `🏆` Lucide icon
  - Keep the existing `compact` and `splash` variants unchanged so other consumers don't break
  - Update `LoginPage.tsx` to render `<Brand variant="lockup" />` on the splash (mark + wordmark)
  (~45 min)

- **U1.4** Brand-voice recurring element (C-1): in `apps/web/src/components/PageHeader.tsx`, add a 1-px brass-coloured horizontal rule between the eyebrow row and the title:
  - Use `border-t border-accent/30` (brass with low opacity so it whispers, not shouts)
  - Subtle on dark, slightly more visible on light — already handled by the token's per-mode value
  - Verify it doesn't visually compete with the existing `border-b border-border` patterns on cards
  Apply manually only if `PageHeader` doesn't already wrap every page top — grep to verify (~5 min check, ~25 min apply incl. visual sweep)
  (~30 min)

- **U1.5** Self-host the splash fonts (surfaced by Lighthouse baseline — see `docs/lighthouse-baseline-2026-05-25.md`):
  - Download the woff2 files for the two weights actually used on `/login` (JetBrains Mono 600 + 700; Outfit 400 + 600 if needed) into `apps/web/public/fonts/`
  - Update `apps/web/src/index.css` `@font-face` rules to point at `/fonts/…` rather than `https://fonts.gstatic.com`
  - Add `<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/jetbrains-mono-600.woff2">` to `apps/web/index.html` for the splash-critical weight
  - Remove the Google Fonts CSS `<link>` from `index.html`
  - Update the service worker's `googleFontsCache` route in `apps/web/src/sw.ts` to drop the (now-unused) `fonts.gstatic.com` cache tier
  - Verify the wordmark gradient still renders correctly (it depends on JetBrains Mono being loaded before paint)
  (~30 min)

**Acceptance:**
- `apps/web/public/icon-{192,512}.png` and friends present and reference the new mark
- `manifest.webmanifest` includes the new icons including maskable entry
- Favicon shows new mark in the browser tab (tested in Chrome + Safari)
- Install prompt + iOS "Add to Home Screen" both produce the new icon
- Splash on `/login` renders mark + wordmark as a lockup
- Every page with `PageHeader` shows the 1-px brass divider
- Existing `Brand variant="compact"` / `variant="splash"` callers are unbroken
- All existing Vitest + Playwright tests still pass
- New bundle delta < +20 KB gzipped (PNG icons are precached but not loaded eagerly)
- Self-hosted fonts: no requests to `fonts.gstatic.com` on cold load of `/login`; LCP element (the wordmark) paints at or before the existing 2.5 s baseline

---

## U2 — Form unification + navigation consistency 🟢 Sonnet · ~3 h

Kills the native `<select>` regression and tidies up nav inconsistencies
that fight the design system.

- **U2.1** Replace native `<select>` with the existing shadcn `Select` (Radix-based) on:
  - `apps/web/src/pages/LoginPage.tsx` (lines 77–91) — name picker
  - `apps/web/src/pages/SpecialsPage.tsx` — tournament winner picker and top scoring team picker (the Golden Boot input stays a text input)
  - `apps/web/src/pages/ComparePage.tsx` — Player A + Player B pickers
  Keep `<input type="time">` and `<input type="date">` as native (the platform picker is genuinely better there).
  (~75 min)

- **U2.2** `LoginPage.tsx` — replace the plain PIN `<Input type="password">` with a **4-cell segmented PIN input** component. Build it as `apps/web/src/components/PinInput.tsx`:
  - Four focusable cells, each `inputMode="numeric"`, single character
  - Auto-advance on input, backspace returns focus to previous cell
  - Paste of 4 digits fills all cells
  - Renders as a controlled component with one `value: string` / `onChange: (v: string) => void` API for easy form integration
  - Length is fixed at 4 (admin can extend in a future PR if/when 8-digit PINs are wanted)
  (~50 min)

- **U2.3** `LoginPage.tsx` — add a "Trouble signing in?" helper line under the submit button:
  > "Forgot your PIN? Ask your league admin for a reset."
  Small text, muted colour, non-link (PIN reset is admin-side).
  (~10 min)

- **U2.4** Back-button consistency (C-7) — in `apps/web/src/components/PageHeader.tsx`:
  - Add an optional `backTo?: string` (route) or `back?: { to?: string; label?: string }` prop
  - When set, render a top-**left** back chip (ChevronLeft + label) above the eyebrow row
  - The right-slot action slot stays for forward actions only
  - Update every page that currently uses an `← Back` chip in the right slot:
    - `GroupDetailPage` (`← Groups`)
    - `LeaderboardHistoryPage` (`← Leaderboard`)
    - `RoundLeaderboardPage` (`← Overall`)
    - `ComparePage` (`← Leaderboard`)
    - `PlayerProfilePage` (`← Leaderboard`)
    - Admin sub-pages (`← Admin`)
  - On `MatchDetailPage` keep its existing top-left back affordance unchanged (or unify with the new prop)
  (~60 min)

- **U2.5** `SpecialsPage.tsx` button label fix (Sp-4): the per-card button reads:
  - "Save" if the player has no value committed yet for that special
  - "Update" if a value already exists
  - "Saved ✓" briefly (1.2 s) immediately after a successful save (Sp-5 — animated state in U5; for this batch just change the label)
  (~30 min)

- **U2.6** Settings `Subscribe` button (Set-1): when `permission === 'denied'`, replace the button with a "How to enable" link that explains how to unblock the notification permission in browser settings. Use platform-aware copy if cheap.
  (~15 min)

**Acceptance:**
- No `<select>` element in the rendered DOM of `/login`, `/predictions/specials`, `/compare`
- New `PinInput` component renders 4 cells with auto-advance, backspace nav, and paste support — covered by a Vitest unit test
- Back chip is top-left on all pages that have one; the right slot is action-only (or empty)
- Specials button label state machine works correctly (no committed → "Save", committed → "Update")
- "How to enable" copy renders only when permission is denied
- All existing tests pass; new test for `PinInput` is green
- Accessibility test still passes (Radix selects come with role + label correctness out of the box)

---

## U3 — Dashboard rebalance + copy polish 🟢 Sonnet · ~4 h

The biggest single batch. Dashboard is the most-visited surface; this
batch flips its information hierarchy and tidies the long tail of copy
nits that surfaced in the audit.

- **U3.1** `DashboardPage.tsx` — welcome line (C-8 + D-2): drop `text-wordmark-h` on the player name. Use weight + colour contrast instead (`font-semibold text-text-primary`). The wordmark gradient is reserved for the wordmark itself.
  (~5 min)

- **U3.2** `DashboardPage.tsx` — make next-match the hero (D-3 + D-5 + D-7):
  - Move `NextMatchCard` to the top of the page (right under the welcome line), full-width, larger countdown (`text-4xl`), larger team labels
  - Move the two stat cards (`YOUR RANK`, `TOTAL POINTS`) to **below** the next match card
  - Move the quick-link nav cards (Predictions / Knockout / Specials) **above** the mini-leaderboard (D-7 — players come to predict, not gloat)
  - Add a `Predict now` button inside the `NextMatchCard` when the user hasn't yet predicted that match (1 small query: fetch the user's prediction for `nextMatch.id` and check)
  (~90 min)

- **U3.3** `DashboardPage.tsx` — rename mini-leaderboard section heading (C-10): `STANDINGS` → `LEADERS` (or `TOP OF THE TABLE` — pick whichever reads better against the tabbar item next to it).
  (~5 min)

- **U3.4** `DashboardPage.tsx` — kill the "—" placeholder flash on refetch (D-4):
  - In the React Query options for `leaderboard`, `upcoming`, `recent`, add `placeholderData: keepPreviousData` (React Query v5 helper)
  - Verify the dashboard now shows last-known values during refetch instead of "—"
  - Cover with a Vitest test that mocks an in-flight refetch and asserts the previous value is rendered
  (~30 min)

- **U3.5** `PlayerProfilePage.tsx` — streak emoji (PP-1): hide 🔥 when streak < 2 (show `0` plainly or `—`).
  (~5 min)

- **U3.6** `PlayerProfilePage.tsx` — AVG SUBMIT TIME format (PP-2): convert hours to a humanised relative format (`> 24 h ago` → `Xd Yh before`; `< 1 h` → `Xm before`). Helper in `apps/web/src/lib/format.ts` (new file) so other places can reuse.
  (~25 min)

- **U3.7** `PlayerProfilePage.tsx` — Best / Worst round (PP-3): when both Best and Worst show 0 pts AND the player has zero settled rounds, collapse the two cards into a single "No round results yet" placeholder.
  (~20 min)

- **U3.8** `PlayerProfilePage.tsx` — Recent Predictions table 0 pts (PP-4): when actual result is `?–?` (unfinished), render `—` in the Pts column with neutral colour; when actual is settled and pts is 0, keep current red treatment.
  (~15 min)

- **U3.9** `LeaderboardPage.tsx` — hint placement (LB-3): move "Tap a row for breakdown · long-press to compare" from the bottom of the page to just under the `PageHeader` (above the sub-nav). Make it dismissible — once dismissed, persist in `localStorage` (key `sss_leaderboard_hint_dismissed`).
  (~25 min)

- **U3.10** `LeaderboardPage.tsx` + `DashboardPage.tsx MiniLeaderboard` — client-side leaderboard dedupe (LB-1): introduce a `dedupedLeaderboard(entries)` helper in `apps/web/src/lib/leaderboard.ts`:
  - Dedupe by `player_id` (keep first occurrence)
  - **Recompute** rank locally using standard competition ranking (`1, 1, 1` when all tied; `1, 1, 3` when two tied for first)
  - Always run the dedupe defensively, even after backend bug is fixed (cheap, makes the frontend resilient)
  - Cover with a Vitest test: input with 9 dup rows for 3 players all `total_points: 0`, all `rank: 4` → output is 3 rows, all `rank: 1`
  (~50 min)

- **U3.11** Colour-contrast token fixes (surfaced by Lighthouse baseline — see `docs/lighthouse-baseline-2026-05-25.md`):
  - `apps/web/src/theme/tokens.ts` + `apps/web/src/index.css` — lift the dark-mode `--color-text-muted` from `#5A6478` to a value that clears WCAG AA 4.5:1 against `bg-surface` `#131720` (target ~`#7B859B` — verify with a contrast checker). Same lift for the light-mode value if it doesn't already pass.
  - Affects every page eyebrow (`FIXTURES`, `STANDINGS`, `ACCOUNT & DEVICE`, etc.) across the app — single token edit, dozens of consumers improve at once.
  - **Primary button text fix:** in `apps/web/src/components/ui/button.tsx`, the `default` variant currently lets `text-text-inverse` resolve to white on emerald — Lighthouse measured 2.53 contrast (white on `#10B981`). Force the on-primary text colour to `text-text-inverse` (`#0B0E13`) explicitly so it clears 12:1. Verify the same fix for the `accent` variant on brass.
  - Cover with a Vitest snapshot or accessibility test: re-run the existing `accessibility.test.tsx` and confirm no new violations.
  (~30 min)

**Acceptance:**
- Welcome name no longer renders with the brass gradient
- Dashboard scroll order: welcome → next match (hero) → stat cards → quick links → mini leaders
- "Predict now" button appears on the hero card when the user has no prediction for the next match
- `LEADERS` (or chosen alternative) heading on mini section
- No "—" flicker during refetch on the dashboard
- Player profile streak emoji hidden at 0
- AVG SUBMIT TIME no longer shows raw hours
- Best/Worst card collapses to single placeholder when no variance
- Recent Predictions `?–?` rows show `—` not red `0`
- Leaderboard hint visible at top, dismissible, dismissal persists across reloads
- Leaderboard + Dashboard mini-table show 3 rows (not 9) even against the buggy backend, with ranks 1/1/1 not 4/4/4
- New `format.ts` and `leaderboard.ts` lib modules covered by Vitest tests
- `--color-text-muted` and primary-button on-colour text all clear WCAG AA 4.5:1 (verify via a Lighthouse re-run during U3 close-out)
- All existing tests pass; no regressions in Playwright smoke

---

## U4 — Premium empty states + bracket teaser 🟢 Sonnet · ~3 h

Lifts the long-tail empty states from "dashed-card with text" to "feels
like the team thought about this".

- **U4.1** `BracketPage.tsx` empty state (C-6 + B-1):
  - Replace the current `EmptyState` with a custom component `BracketTeaser` rendered as:
    - A greyscale SVG silhouette of the R32 column (16 placeholder boxes in `text-text-muted/30` with the brass divider hint between halves)
    - A title "The bracket arrives after group stage"
    - A countdown to the first knockout match's scheduled kickoff (fetch via `/api/v1/matches?stage=r32&limit=1` — show "—" if not available)
    - A CTA "Make your group-stage picks →" linking to `/predictions`
  - Keep the actual bracket SVG component unchanged for the populated case
  (~75 min)

- **U4.2** `KnockoutPredictionsPage.tsx` empty state (K-1):
  - Same `BracketTeaser` component but with copy adapted: "Knockout picks open after group stage"
  - Add a CTA linking to `/predictions/specials` so the player can use their time pre-tournament
  (~15 min — reuses U4.1)

- **U4.3** `GroupsPage.tsx` pre-tournament view (G-1):
  - When every match in the group has `status === 'scheduled'`, replace the mini standings table with a "First match" preview row showing kickoff time + the two teams (since the standings are all zeros anyway)
  - The full standings table appears the moment a single match in that group is `completed`
  - Header keeps the "Details →" link so admins/curious players can still drill in
  (~45 min)

- **U4.4** `GroupDetailPage.tsx` column reduction (GD-1):
  - Default visible columns on `< 480 px` viewports: `#`, `Team`, `P`, `W`, `D`, `L`, `Pts` (drop GF, GA, GD)
  - Add a small "Show full stats" toggle below the table that expands to all 10 columns
  - In landscape (`@media (orientation: landscape)`) show full table by default
  - Drop the `(CZE)` text suffix after team name when flag + name are present (GD-3)
  (~30 min)

- **U4.5** `LeaderboardHistoryPage.tsx` — connect-line chart (LH-1):
  - Switch Recharts `<Scatter>` to `<Line>` (or layer `<Line>` underneath the scatter dots) so each player's trajectory is visible across rounds
  - Keep the dot markers on top (helpful for sparse data points)
  - Replacing recharts with a hand-rolled SVG line chart (LH-2 — 107 KB win) is **out of scope here**, tracked as a future ticket
  (~30 min)

- **U4.6** `SchedulePage.tsx` countdown trim (S-2): drop the per-match `<Countdown>` rendered under the kickoff time. The countdown already appears on the dashboard and match-detail page; the schedule list doesn't need it. Match cards become ~20 % shorter.
  Also: rename the `3rd` stage-filter pill to `3rd place` (S-1).
  (~15 min)

- **U4.7** PWA "Update available" banner — currently the app uses `registerType: 'autoUpdate'` with `self.skipWaiting()` + `clientsClaim()` in `sw.ts`, which silently swaps the SW with no user-visible signal. Users on the installed PWA have no idea a new version landed.
  - Switch `vite.config.ts` `VitePWA` `registerType` from `'autoUpdate'` to `'prompt'`
  - Add a new `apps/web/src/components/UpdateBanner.tsx` component that uses `useRegisterSW` from `virtual:pwa-register/react`:
    - Shows a slim dismissible banner at the top of the viewport when `needRefresh` is true: `"New version available"` + `"Update"` button + `"×"` dismiss
    - Calls `updateServiceWorker(true)` on button click, then `window.location.reload()`
    - Dismiss (× only) hides the banner for the current session without reloading
    - Uses existing design tokens: `bg-surface-elevated`, `border-accent/40`, `text-text-primary`, `Button` variant `accent` size `sm`
  - Mount `<UpdateBanner />` in `apps/web/src/App.tsx` (or the root layout) above the router outlet so it overlays every page
  - Remove `self.skipWaiting()` from `sw.ts` — with `registerType: 'prompt'` the SW stays in the waiting state until the user taps "Update", so we no longer want auto-activation. `clientsClaim()` can stay (it only matters at first install, not on updates)
  - Cover with a Vitest test: mock `useRegisterSW` returning `{ needRefresh: [true, vi.fn()], updateServiceWorker: mockUpdate }` and assert the banner renders with the correct text and that clicking "Update" calls `mockUpdate(true)`
  (~30 min)

**Acceptance:**
- Bracket page empty state shows the greyscale R32 silhouette, countdown, and predict-CTA
- Knockout picks page empty state mirrors the bracket teaser visually
- Groups page pre-tournament shows a "First match" preview row per group, not a wall of zeros
- Group detail standings show 7 columns by default on mobile; toggle expands to all 10
- "(CZE)" suffix removed
- Rank history chart shows connected lines per player + dot markers on top
- Schedule match cards no longer carry the per-card countdown; the page is visibly more compact
- Stage filter label is `3rd place`, not `3rd`
- When a new SW is waiting, the `UpdateBanner` appears with "New version available" + "Update" button; tapping it reloads to the new version
- Dismissing the banner (×) hides it without reloading
- `registerType` is `'prompt'`; `self.skipWaiting()` is removed from `sw.ts`
- `UpdateBanner` Vitest test passes
- All existing tests pass; new `BracketTeaser` component has a basic render test

---

## U5 — Motion moments + elevation depth 🔴 Opus (extended thinking ON) · ~3 h

The judgment-heavy batch. Three motion moments that move the app from
"competent" to "felt", plus a small elevation-tier sweep on the highest-
traffic surfaces. Run on Opus with extended thinking ON.

- **U5.1** Score-input spring (C-5, motion moment 1):
  - On `PredictionsPage.tsx` and `MatchDetailPage.tsx`, when the prediction number changes (up/down chevron or keyboard), animate the digit with a brief 1.1× scale spring (`framer-motion`, `transition={{ type: 'spring', stiffness: 380, damping: 22 }}`)
  - Respect `prefers-reduced-motion: reduce` — fall back to no animation
  - Verify the score input pattern is the same on both pages first (MD-1 — unify if not; reuse the same component)
  (~45 min)

- **U5.2** Save-confirmation animation (C-5, motion moment 2 + Sp-5):
  - On `MatchDetailPage.tsx` Save button and `SpecialsPage.tsx` Update buttons (and any other "Save" CTA), when the save resolves successfully:
    - Button briefly transitions to a `"Saved ✓"` state for 1.2 s
    - The check icon path draws in (`pathLength: 0 → 1` over 280 ms)
    - Then morphs back to the resting state
  - Single shared `SaveButton` component if reasonable (`apps/web/src/components/ui/save-button.tsx`)
  - Respect reduced-motion
  (~60 min)

- **U5.3** Rank-delta pulse (C-5, motion moment 3):
  - On `LeaderboardPage.tsx`, when a rank changes between fetches (compare `prevRank` vs `entry.rank`), animate the `<ArrowGlyph>` with a brief 1.25× scale pulse + colour intensity flash over 240 ms
  - Trigger only on the first render after a real change — not on initial mount
  - Respect reduced-motion
  (~35 min)

- **U5.4** Elevation depth sweep (C-4):
  - On `SchedulePage.tsx`, the sticky date header (`bg-bg/95 backdrop-blur-sm`) → use `bg-surface-elevated/95` so it lifts visibly above the cards underneath
  - On `MatchDetailPage.tsx`, the "Your Prediction" card → `bg-surface-elevated` so it sits above the match-header card
  - On `DashboardPage.tsx` after U3.2, the hero "Next match" card → `bg-surface-elevated` so it visually leads the page
  - One careful pass: verify each change in both light and dark, on both mobile + desktop viewports
  (~30 min)

- **U5.5** Rank-history player chip palette (LH-3):
  - In `apps/web/src/pages/LeaderboardHistoryPage.tsx` and any other consumer of the per-player colour palette, drop `#22c55e` (green primary collision) and `#10b981` from the palette; swap in two neutral but distinguishable colours (e.g. `#94a3b8` slate-400 and `#cbd5e1` slate-300, or a tasteful warm pair like `#e879f9` and `#facc15`)
  - Apply consistently across LeaderboardHistory + Bracket (the bracket also uses this palette per its `PALETTE` constant)
  (~20 min)

**Acceptance:**
- Score input number visibly springs on change (and is static under reduced motion)
- Saving a prediction or special shows the `Saved ✓` draw-in animation, then returns to resting state
- Leaderboard rank-delta arrow pulses when the player's rank changes between refetches
- Schedule date header, MatchDetail prediction card, Dashboard next-match card all use `surface-elevated` and the depth difference is visible in both light + dark
- Rank history chart no longer uses green for any player (primary green is brand-only)
- Reduced-motion test: with `prefers-reduced-motion: reduce`, none of the new animations fire
- Bundle delta: framer-motion is already shipped; expect < +3 KB gzipped total for the new motion code
- All existing tests pass; new tests cover the reduced-motion fallback and the rank-delta-pulse trigger logic

---

## Verification (run at the end of U5, before merge)

Once U1–U5 are all green and pushed:

1. **Real-phone walk-through** — every page on iOS Safari (and ideally one Android Chrome). Both light and dark mode. The full 5 user journeys.
2. **Vitest + accessibility** — `pnpm test` green.
3. **Playwright smoke** — `pnpm e2e:smoke` green against staging.
4. **Lighthouse mobile** — run against the staging URL; capture vs the Phase 1 baseline (in the audit doc). Aim: no regression on Performance / Accessibility / Best Practices.
5. **Bundle delta** — compare `pnpm build` output to the Phase 1 baseline. Target: main entry < +50 KB gzipped (excluding the new logo PNGs which are precached but not loaded eagerly).
6. **PR description** — document: what changed per batch, audit findings addressed, logo concept picked, bundle delta numbers, Lighthouse delta numbers, any deferred items.
7. **Do not merge.** Push, confirm CI green, hand to user for real-phone soak. After user sign-off + merge, tag `main` as `v1.0-pre-multi-league`.

---

## Close-out per batch

Each batch closes the same way `R1–R7` did:

1. After all items in the batch are green locally, push the branch
2. `/phase-closeout U<n>` (the slash command handles CI poll + ff-merge — fallback to manual if it doesn't recognise the `U` prefix)
3. Append a short entry to `session-log.md` (use the project's lean format)
4. Strike the row in this file's table

The branch (`feat/premium-polish`) is shared across all five batches —
each batch is a commit, not its own branch — so the close-out doesn't
ff-merge to main until U5 is done and verified per the section above.

The `/next-batch-prompt` skill won't auto-recognise `U` batches (it's
hardcoded for `phase-batches.md` and `wc2026-architecture.md`). At
batch start, paste the relevant `## U<n> — ...` section into the new
session as the prompt scope.

---

# Round 3 (soak prep) — batches (U6–U8) — added 2026-05-30

From the 2026-05-30 pre-soak UX re-audit (`docs/soak-review/ux-audit-2026-05-30.md`),
triggered by multi-league reaching more people (the Lewis soak). Round 2 (U1–U5) is
shipped; this round picks up the two **user-flagged** items plus finish issues found in
the live visual pass. **Independent of round 2** — own branch (`feat/premium-polish-3`),
ff-merge per batch once green (don't wait on anything). The current `/next-batch-prompt
polish` reads this file's `## U<n>` acceptance inline, so no manual pasting needed.

| Batch | Model | Effort | Items | Status |
|---|---|---|---|---|
| ~~U6~~ | ~~🟢 Sonnet~~ | ~~~2 h~~ | ~~U6.1–U6.3~~ | ✅ Shipped 2026-06-01 |
| ~~U7~~ | ~~🟢 Sonnet~~ | ~~~2 h~~ | ~~U7.1–U7.3~~ | ✅ Shipped 2026-06-01 |
| ~~U8~~ | ~~🟢 Sonnet~~ | ~~U8.1–U8.2~~ | ✅ Shipped 2026-06-01 |

---

## U6 — Variable-length PIN, unified everywhere 🟢 Sonnet · ~2 h

> Follow-up to **U2.2**, which built `PinInput` fixed at 4 cells with the note "admin can
> extend in a future PR if/when 8-digit PINs are wanted." Decision 2026-05-30: PIN range is
> **4–8 digits**. Today `SignupPage` pairs a 4-cell `PinInput` with a *plain* confirm box
> (visually inconsistent, confirmed in the live pass), the cell cap silently truncates to 4
> (contradicting the "4–8 digits" label), and `JoinPage` uses plain inputs for both.

- **U6.1** Make `apps/web/src/components/PinInput.tsx` variable-length: accept a `length`/`maxLength` prop (render N cells up to max, paste up to max, backspace nav across N). Keep the controlled `value`/`onChange` API. Update its Vitest test for N-length + paste. (~50 min)
- **U6.2** Use `PinInput` for **both** entry and confirm on `SignupPage` and `JoinPage` (and Login already uses it). Remove the plain `<Input type="password">` PIN/confirm fields. Set `autoComplete="new-password"` on signup/join, `current-password` on login (fixes the reused-component bug at `PinInput.tsx:68`). (~45 min)
- **U6.3** Reconcile copy + validation to 4–8 everywhere; ensure the confirm-match check works across the full range. (~20 min)

**Acceptance:** one `PinInput` used for every PIN entry/confirm on Login, Signup, Join; accepts 4–8 digits (no silent 4-cap); entry and confirm are visually identical; `autoComplete` correct per context; Vitest for variable length + paste green; a11y test green.

---

## U7 — Invite-flow cleanup + finish issues 🟢 Sonnet · ~2 h

- **U7.1** (UX U-FIX-2, user-flagged) Remove the "Invitee email (optional)" capture from `apps/web/src/pages/LeagueAdminInvitesPage.tsx` (state line 17, body field 31/37, field 83–93) — the auto-copied join link makes it dead weight. Post an empty invite body; remove the "For: {invitee_email}" line (122–126). Decide whether to retire the backend `invitee_email` column/param or leave it nullable for back-compat. (~45 min)
- **U7.2** (UX U3) Route destructive confirms through the design-system `ui/dialog.tsx` instead of native `window.confirm()`: `LeagueMembersPage` (remove member / leave, 56/70), `admin/PlayersPage` (62), `admin/InvitesPage` (98). Reuse the "type-to-confirm" pattern from `LeagueSettingsPage`. (~50 min)
- **U7.3** (UX U2) Remove/correct the stale `display: '"Instrument Serif", …'` token in `apps/web/src/theme/tokens.ts:75` — no Instrument Serif font is loaded and `font-display` aliases to Outfit; make the "single source of truth" token match reality. (~15 min)

**Acceptance:** no email field in the invite-create flow; no native `window.confirm()` for destructive actions (all styled dialog); the display-font token matches what renders; tests green.

---

## U8 — Partnership lockup polish 🟢 Sonnet · ~1.5 h

> Decision 2026-05-30: the "In partnership with Robinsons" splash joke **stays** — fix the
> quality. The Robinsons bitmap is low-res and reads as pasted clipart against the crisp
> vector wordmark, and the lockup differs between Login (full partnership line + "Still
> Email?" tagline) and Signup (wordmark only).

- **U8.1** Replace the low-res Robinsons raster with a crisp asset (vector if obtainable, else a 2–3× PNG with transparent background); align its sizing/spacing to the splash grid so it reads as an intentional element, not clipart. (~50 min)
- **U8.2** Unify the splash lockup across `LoginPage` and `SignupPage` (same partnership line + tagline placement). (~30 min)

**Acceptance:** the partnership logo renders crisp at all splash sizes (no visible pixelation); Login and Signup show the same brand lockup; no layout regression; tests green.

> Non-blocking note: embedding a real third-party brand mark carries a small trademark/professionalism consideration if the app ever goes more public — informational only for the private soak.

---

## Close-out (round 3)

Per batch: push `feat/premium-polish-3` → `/phase-closeout U<n>` (CI poll + ff-merge; manual fallback if the `U` prefix isn't recognised) → lean `session-log.md` entry → strike the row in the round-3 table above. Round 3 is independent of round 2's "do not merge until U5" rule.

---

# Round 4 (post-soak app review) — batches (U9–U13) — added 2026-06-01

From the 2026-06-01 user app-review (on-device iOS pass). Same batching rationale as
earlier rounds: user-flagged items + a code-grounded analysis of the current build,
with `file:line` refs inline. **Independent of rounds 2–3** — own branch
(`feat/premium-polish-4`), ff-merge per batch once green (don't wait on anything). The
current `/next-batch-prompt polish` reads this file's `## U<n>` acceptance inline, so no
manual pasting needed.

**Decisions locked in the review (carry these — a few reverse earlier decisions):**
- **PIN = exactly 4 digits.** *Reverses the U6 "4–8 digits" decision.* Safe to hard-force
  everywhere — **no accounts exist yet** (pre-release), so there is no existing-PIN
  lockout risk and the backend regex can tighten too.
- **Robinsons = original raster, not the U8.1 SVG.** Keep U8.2's unified lockup; only the
  asset reverts (user prefers the original look over the rendered SVG).
- **Knockout picks = per-round placeholder list** (mirrors the schedule), *not* a
  converging visual bracket (unusable on a phone). Optional read-only mini bracket on the
  existing Bracket tab for the "whole tree" view.
- **Invites = multi-use league join code** (Kahoot-style). Code-only — the league name is
  shown for *confirmation*, never typed; **do not call it a "PIN"** (collides with the
  login PIN). The shareable link carries the same code as a second door.
- **PWA deep-linking = not pursued.** iOS PWAs can't intercept `https` links or share
  storage with the Safari tab, so join is **browser-first + in-app join-by-code**; a
  generic "get the app" landing replaces all deep-link/universal-link engineering.
- **Player typeahead = deferred** to its own batch once official 26-man squads drop
  (~early June 2026). Golden Boot stays free-text until then (see *Deferred* below).
- **Quick tour = yes** — note this reverses round 2's Q-10 ("first-run coachmark: no,
  better served by an About page"). User explicitly wants a press-through intro.

| Batch | Model | Effort | Items | Status |
|---|---|---|---|---|
| ~~U9~~  | ~~🟢 Sonnet~~ | ~~~2.5 h~~ | ~~U9.1–U9.7~~   | ✅ Shipped 2026-06-01 |
| ~~U10~~ | ~~🟢 Sonnet~~ | ~~~3 h~~    | ~~U10.1–U10.3~~ | ✅ Shipped 2026-06-01 |
| ~~U11~~ | ~~🟢 Sonnet~~ | ~~~2.5 h~~ | ~~U11.1–U11.3~~ | ✅ Shipped 2026-06-01 |
| ~~U12~~ | ~~🟢 Sonnet~~ | ~~~4 h~~    | ~~U12.1–U12.5~~ | ✅ Shipped 2026-06-01 |
| ~~U13~~ | ~~🔴 Opus (extended thinking ON)~~ | ~~~5 h~~ | ~~U13.1–U13.5~~ | ✅ Shipped 2026-06-02 |
| ~~U14~~ | ~~🟢 Sonnet~~ | ~~~6 h~~ | ~~U14.1–U14.6~~ | ✅ Shipped 2026-06-02 |

**U9–U13 shipped 2026-06-02** (~17 h across 5 sessions). **U14** was promoted from the
Deferred list once official squads published — it's the one remaining round-4 batch (~6 h,
gated on sourcing the squad dataset; see U14.1).

---

## U9 — Login + leagues quick wins 🟢 Sonnet · ~2.5 h

The low-risk, high-visibility surface fixes. All small, no new infra.

- **U9.1** PIN → exactly 4 digits everywhere (*reverses U6*). Frontend: `LoginPage.tsx:69`,
  `SignupPage.tsx:154` & `:159` — `maxLength={8}` → `maxLength={4}`; `SignupPage.tsx:53-56`
  client check → require length `=== 4`; reword "4–8 digits" copy to "4-digit PIN". Backend
  `routers/auth.py` — change `pin` pattern `^\d{4,8}$` → `^\d{4}$` at `:62`, `:68`, `:100`,
  `:105-106`, `:119`. `PinInput` stays variable-length (U6) but is driven with `maxLength={4}`.
  Tests: backend rejects 3- and 5-digit PINs (422); 8-cell overflow gone. (~40 min)
- **U9.2** Robinsons revert (*reverses U8.1, keeps U8.2*). Restore the original raster
  (`apps/web/public/robinsons-logo.png`, recoverable from commit `dfd7315`) and point
  `apps/web/src/components/PartnershipLockup.tsx:10-15` back at it; remove the now-unused
  `robinsons-logo.svg`. Keep the unified Login/Signup lockup from U8.2. (~20 min)
- **U9.3** Create-account prominence. `LoginPage.tsx:78-85` — promote "Create account" from a
  muted footer text-link to a **full-width secondary/outline `Button`** directly under the
  primary "Sign in" submit. Keep "Forgot PIN?" as the small text link. (Chosen over equal-size
  buttons: returning users sign in far more often than they sign up.) (~25 min)
- **U9.4** League card fully clickable. `MyLeaguesPage.tsx` `LeagueCard` (`:13-79`) — make the
  whole card the `Link` to `/leagues/{slug}`; remove the now-redundant "View" button (`:73-75`).
  Verify no nested-interactive a11y issue (the list card has no other interactive children). (~20 min)
- **U9.5** League-detail back button. `LeagueHomePage.tsx:46` — pass the `back` prop to
  `PageHeader` (the prop exists since U2.4) → top-left "← Leagues" chip to `/leagues`. (~10 min)
- **U9.6** Specials tab first. `PredictionsSubNav.tsx:4-8` — reorder so **Specials is leftmost**
  (Specials → Group → Knockout). Leave the `/predictions` route still rendering Group as the
  default landing (only the tab order changes; flag if the user later wants Specials as the
  default screen too — group predictions are the recurring daily action). (~10 min)
- **U9.7** Specials dropdown won't scroll (real bug). `components/ui/select.tsx:35-63` — the
  Radix `SelectContent` is `overflow-hidden` with **no max-height**, so the 48-team
  "top scoring team" list renders taller than the viewport with nothing to scroll. Add a capped
  height + scrollable viewport (`max-h-[min(20rem,var(--radix-select-content-available-height))]`
  + `overflow-y-auto`) and ensure `SelectScrollUpButton`/`DownButton` are present. One fix, every
  Radix select benefits. Reproduce on the SpecialsPage team picker on a phone-width viewport. (~30 min)

**Acceptance:** PIN inputs render 4 cells and don't overflow `max-w-sm`; backend rejects non-4-digit
PINs (test); original Robinsons raster renders on Login + Signup, no SVG reference left; "Create account"
is a visible secondary button on Login, "Forgot PIN?" still a small link; tapping anywhere on a league
card opens it (no separate View button); league detail shows a "← Leagues" back chip; Specials is the
leftmost predict sub-tab; the team-picker dropdown scrolls on a narrow viewport; all existing tests green.

---

## U10 — Forgot-PIN + first-run onboarding 🟢 Sonnet · ~3 h

Wires up the dead "Forgot PIN?" link, then adds the two first-run prompts the user asked for.

- **U10.1** Forgot-PIN frontend (backend already exists). The `/forgot-pin` link
  (`LoginPage.tsx:82-84`) currently dead-ends (no route → catch-all redirect). Build:
  (a) `/forgot-pin` request page → POST `/api/v1/auth/pin/reset-request` (`routers/auth.py:286-327`
  — confirm the exact request field: name vs email) → "check your email" confirmation; and
  (b) a reset-confirm page `/pin/reset/:token` → enter a new 4-digit `PinInput` → POST
  `/api/v1/auth/pin/reset` (`:330-355`, clears lockout) → success → redirect to `/login`. Add both
  routes to `App.tsx`. Handle invalid/expired-token + email-not-verified states. This **supersedes
  U2.3's "ask your league admin" copy** — remove/replace it. Tests for both pages. (~75 min)
- **U10.2** First-run notifications prompt. After the first successful login/signup, show a prominent
  modal: "🔔 Match alerts — strongly recommended" with **Enable** (calls the existing
  `hooks/usePushSubscription.ts` → triggers the OS permission prompt) + a smaller "Maybe later", and
  default the in-app notification *preferences* to all-on. Gate to once via a localStorage flag
  (e.g. `sss_notif_prompt_seen`, same pattern as `WelcomeCard`'s `sss_welcome_dismissed`).
  **iOS caveat (must handle):** push only works in the *installed* PWA — if `display-mode` is not
  `standalone`, show "Add to Home Screen first" guidance instead of the Enable button, and never claim
  push is "on" before the OS grants permission. (~50 min)
- **U10.3** Quick intro tour (*reverses round 2 Q-10*). A lightweight **custom** 3–4 slide
  press-through intro shown once on first run (localStorage `sss_tour_seen`), skippable: how scoring
  stacks (reuse `WelcomeCard` copy), predict before kickoff, knockout opens round-by-round, where the
  leaderboard/leagues live. **No tour library** (react-joyride/driver.js are fragile on mobile) — a
  simple modal carousel. (~45 min)

**Acceptance:** "Forgot PIN?" leads to a working request → email → reset-confirm flow against the
existing endpoints (no more dead link; admin-reset copy gone); a first-login notifications modal appears
once, enables push via the existing hook, defaults prefs on, and degrades to an install nudge when not
standalone; a once-only press-through intro tour shows on first run and is skippable; localStorage gates
prevent re-showing; tests green.

---

## U11 — Home screen rebalance 🟢 Sonnet · ~2.5 h

Trims the dashboard to the four things the user wants and surfaces the previous-match breakdown
(which already exists, just buried). Builds on U3.2's dashboard hierarchy work.

- **U11.1** Remove the 3 quick-link nav cards (Predictions/Knockout/Specials) from
  `DashboardPage.tsx` (`NAV_CARDS` `:366-369`, render `:474-478`) — pure duplication of the bottom
  bar. Replace with a **single contextual CTA**: pre-tournament, "Make your specials picks →"
  (`/predictions/specials`) — this keeps specials reachable from home per the user's ask. (~30 min)
- **U11.2** Replace the per-league full `LeagueCard`s (`:487-493`) with a **compact rank strip** — one
  tappable row per league showing the user's rank + points, linking to that league. Keep
  `CrossLeagueSummaryWidget` (`:457`, total points + avg rank). (~50 min)
- **U11.3** Promote + enrich the previous-match breakdown. Move `LatestResultCard` (`:501`) up to
  directly under `NextMatchCard` (`:463`), and enrich it from total-only to the **full breakdown**
  (Result ✓ +3 · Goal total ✓ +2 · Exact ✗ — → total) using the `points_breakdown`
  (`goals`/`result`/`exact`/`total`) already returned by `/players/{id}/predictions/recent`
  (`lib/types.ts:49-55`). **No backend change.** (~40 min)

Resulting home order: greeting → dismissible WelcomeCard → total points → Next Match (with "Predict now")
→ previous-match breakdown → compact league strip → pre-tournament specials CTA.

**Acceptance:** no Predictions/Knockout/Specials nav cards on home; a pre-tournament "specials picks" CTA
present; per-league info is a single compact rank strip (not full cards); the previous-match card sits
under Next Match and shows the 3-way points breakdown; total points still shown; tests green.

---

## U12 — Multi-use join code + invite UX 🟢 Sonnet · ~4 h

Replaces single-use invite tokens (the real cause of the "friends couldn't join" report — invites
deactivate on first claim at `routers/league_memberships.py:91-93`) with a reusable, human-typable
league join code, and sidesteps the iOS PWA deep-link problem entirely. Keep the existing single-use
`invites` table for any future per-person invite need; the join code becomes the everyday share path.

- **U12.1** Migration + generation. Add `join_code` to `leagues` (e.g. `String(8)`, unique, indexed);
  backfill existing leagues. Add `generate_join_code()` — 6 chars from an unambiguous alphabet
  (exclude `I/O/0/1`). Generate on league creation. (~40 min)
- **U12.2** Backend endpoints (all rate-limited; reuse the `claim_invite` membership logic):
  - `GET /leagues/by-code/{code}` → minimal `{name, member_count, max_members, privacy}` for the
    confirm step; 404 if not found.
  - `POST /leagues/join-by-code` `{code}` (authenticated, **multi-use** — does NOT deactivate the
    code): add membership if not already a member and not at `max_members`.
  - `POST /leagues/{slug}/join-code/rotate` (admin) → regenerate the code.
  Tests: multi-use (two players join one code), full-league rejection, already-member 409. (~80 min)
- **U12.3** "Join a league" screen. Code input → `by-code` lookup → **confirm card showing the league
  name** ("Join *Robbo's League*?") → Join. Entry points: a button on `MyLeaguesPage` (alongside
  Discover) + the empty-state CTA. (~50 min)
- **U12.4** Invite/share UX on `LeagueHomePage` — prominent **Invite** button using `navigator.share`
  (clipboard fallback) with a message + link `{origin}/join/{code}`. Extend the existing `/join/:token`
  route (`App.tsx:113`, `JoinPage`) to also accept a **join code** so the link is a working second door
  (new users sign up then auto-join by code; logged-in users one-tap join). (~50 min)
- **U12.5** `/welcome` get-app landing — platform-aware "Add to Home Screen" instructions; the generic
  link you share with friends who don't have the app yet. This + join-by-code is the agreed answer to
  the PWA deep-link question (no universal-links work). (~30 min)

**Acceptance:** one reusable join code per league (rotatable), backfilled for existing leagues; two
different players can join the same code; the code lookup shows the league name for confirmation before
joining; an Invite button opens the native share sheet with the link + code; `/join/<code>` works for
both new and logged-in users; a `/welcome` install landing exists; single-use `invites` still function;
tests green.

---

## U13 — Knockout/schedule skeleton + progression 🔴 Opus (extended thinking ON) · ~5 h

The foundational, judgment-heavy batch — seeds the data both the schedule and knockout picks read, and
resolves placeholders → real teams as the tournament progresses. Run on Opus.

> **Before coding:** grep `wc2026-architecture.md` for any existing knockout-seeding / bracket
> progression phase. If a numbered phase already owns this, fold this batch into it rather than
> duplicating. The 2026 format is 48 teams → 12 groups of 4 → **R32 (incl. 8 best third-placed)** → R16
> → QF → SF → 3rd place → Final. All 104 match dates/venues are published in advance; only the *teams*
> are TBD.

- **U13.1** Seed the 32 knockout matches (R32 ×16, R16 ×8, QF ×4, SF ×2, 3rd ×1, Final ×1) with real
  kickoff dates/venues + **positional placeholder source refs** (e.g. `home_source="winner_group_a"`,
  `away_source="runner_up_group_b"`; later rounds reference prior matches, e.g. `winner_match_73`).
  Confirm the `matches` table allows null team FKs and add placeholder/source columns if absent
  (migration). Result: full 104-match calendar (72 group + 32 KO). (~90 min)
- **U13.2** Schedule tab knockout view. `SchedulePage.tsx:244-252` — instead of the generic
  "No matches found" `EmptyState`, render the seeded knockout rounds with placeholder labels
  ("Winner Group A" / "Runner-up Group B"), grouped by round. (~45 min)
- **U13.3** Knockout picks per-round list. `KnockoutPredictionsPage.tsx` (`KNOCKOUT_STAGES` `:23-30`)
  — render the seeded rows as a per-round placeholder list (replace the `BracketTeaser` empty state
  `:583-595`; keep the teaser only if truly zero rows). Picks save against the seeded match ids. (~60 min)
- **U13.4** Progression logic (**the Opus bit**): resolve placeholders → real teams as group standings
  finalize (incl. the best-third-placed qualification table and its group-letter mapping into R32) and
  as knockout results settle. Pure, well-tested resolver. (~90 min)
- **U13.5** Optional read-only mini bracket on `BracketPage` from the same seeded data — the
  "see the whole tree" overview (picking still happens in the per-round list). (~30 min)

**Acceptance:** all 104 matches seeded incl. 32 knockout slots with dates + positional placeholders;
the schedule knockout view shows the round skeleton (no "No matches found"); knockout picks render as a
per-round placeholder list and save; placeholders resolve to real teams correctly as standings/results
settle (unit tests for the best-third-placed mapping and round-to-round advancement); optional read-only
bracket renders; `pytest` + Vitest green.

---

## U14 — Golden Boot player typeahead (real squad data) 🟢 Sonnet · ~6 h

Promoted from the round-4 Deferred list now that official WC2026 26-man squads have published.
Replaces the free-text Golden Boot input with a searchable combobox constrained to real squad
players, so predictions **and** admin awards match by player **id** instead of the current fragile
case-insensitive string compare.

> **Watch-outs before coding:**
> - **Naming collision:** the app already has `routers/players.py` + a `profiles`/players concept for
>   *league participants*. Name the footballer table/router **`squad` / `squad_players`** — do NOT
>   overload "players".
> - **No combobox exists.** Web deps are Radix dialog/label/select/slot only — no `cmdk`, no
>   `@radix-ui/react-popover`. U14.6 must add the shadcn Combobox stack (`cmdk` +
>   `@radix-ui/react-popover`) or build a lightweight custom typeahead on the existing input.
> - **RLS (carry R11):** a new PostgREST-exposed table must follow the R11 lockdown pattern (enable
>   RLS, revoke anon/authenticated writes) or the Supabase advisor flags `rls_disabled_in_public`. The
>   squad list is non-secret, so add an anon/authenticated SELECT policy. Use the R11 migration as the
>   template.
> - Depends on the existing `teams` table being populated (it is — all 48 known post-qualification). FK
>   squad players to it.

- **U14.1** Squad dataset + idempotent loader. Source the official 48 × 26 ≈ 1,250-player squads into a
  committed `apps/api/src/data/squads_2026.json` (full name, known-as, team, position, shirt number) and
  a re-runnable seed/loader (data migration or `seed_squads.py` run on deploy). Cover all 48 teams.
  **Data sourcing is the long pole** — if it can't be done cleanly in one sitting, split this into a prep
  data-task and keep U14.2–U14.6 as the batch. (~120 min)
- **U14.2** `squad_players` table + migration + RLS. uuid id, full_name, known_as, team_id FK→`teams`,
  position, shirt_number (nullable), is_active (default true). Name index for search. Enable RLS +
  revoke anon/authenticated writes + add an anon/authenticated SELECT policy, mirroring the R11
  migration. (~45 min)
- **U14.3** Search endpoint. New `routers/squad.py` — `GET /api/v1/squad/search?q=&limit=20`,
  case-insensitive prefix/substring match on full_name/known_as over `is_active` rows, ranked, returns
  id + name + team + flag + position. Rate-limited per the §8.3 pattern. (~45 min)
- **U14.4** Prediction stores player id. `special_predictions` — add `predicted_player_id` (nullable
  FK→squad_players); keep `predicted_player_name` denormalised for display. Update the golden_boot upsert
  (`routers/specials.py:177-182`) to accept + store the id and resolve the name from it. Migration. (~45 min)
- **U14.5** Award by id. Replace the case-insensitive string compare at `routers/specials.py:300` (and
  the `winner_player_name` award field) with a `winner_player_id` id-match; admin picks the winner from
  the same squad list. Verify re-scoring credits exactly the players who picked the winner. (~45 min)
- **U14.6** Frontend combobox. Add the shadcn Combobox stack (`cmdk` + `@radix-ui/react-popover` — none
  exists today) and replace the free-text input (`SpecialsPage.tsx:254-275`) with a debounced typeahead
  querying `/squad/search`, showing name + team flag + position, selecting → stores the id.
  Loading/empty/error states. Reuse the same combobox in the admin award UI (U14.5). Vitest. (~60 min)

**Acceptance:** seeded `squad_players` covers all 48 teams (~26 each — test asserts counts);
`/squad/search` returns ranked matches and is rate-limited; the Golden Boot prediction stores a
`predicted_player_id` and the free-text path is gone from the UI; admin awards by selecting the winning
player (id match, not string); re-scoring credits exactly the players who picked the winner (test); the
new table has RLS enabled + anon writes revoked + anon SELECT allowed (no `rls_disabled_in_public`
advisor finding); the SpecialsPage combobox searches and selects a real player with team + flag;
`pytest` + Vitest + a11y green.

---

## Deferred (own batch, later)

- **Golden Boot player typeahead** — now scoped as **U14** above (official squads have published). Until
  U14 ships, Golden Boot stays the free-text input (`SpecialsPage.tsx:254-275`).
- **Public/private league split in the Leagues tab** — considered and declined for now: when viewing
  leagues you're *in*, membership matters more than visibility, and the privacy badge already
  distinguishes them. Keep My Leagues + a polished Discover.

---

## Close-out (round 4)

Per batch: push `feat/premium-polish-4` → `/phase-closeout U<n>` (CI poll + ff-merge; manual fallback if
the `U` prefix isn't recognised) → lean `session-log.md` entry → strike the row in the round-4 table
above. Independent of rounds 2–3 — ff-merge each batch as it goes green. `/next-batch-prompt polish` will
surface **U14** as the next un-struck batch.

---

# Round 5 — batches (U15–U16) — added 2026-06-02

**U15 (invite/share polish)** shipped ahead of being written up here — an ad-hoc batch taken after
round 4's U14, recorded below as a struck row for ledger completeness (commits `87aa800` +
`95a8aa9`). **U16 (home points-hero)** is the active batch, from a 2026-06-02 home-screen design
pass with the user: round 4's U11 rebalanced the dashboard but kept the `CrossLeagueSummaryWidget`,
which leads with **average rank** and buries total points as a tail fragment of a sentence. U16
flips the lead metric: **total points is the hero**, and per-league **rank movement** ("this result
moved you ↑2") is surfaced inline. **Independent of prior rounds** — U16 gets its own fresh branch
(`feat/premium-polish-8`; pick the next free number if taken), ff-merge once green.
`/next-batch-prompt polish` reads this file's `## U<n>` acceptance inline, so no manual pasting
needed.

**Decisions locked in the pass (a couple revise U11):**
- **Points hero = pure number.** The dashboard header is the global `total_points` (the one true
  cross-league number — predictions are scored once and count in every league, MD-1), large, with
  the player name as a subline. No secondary rank/breakdown on the hero.
- **Cross-league average-rank widget = removed.** *Reverses U11.2's "Keep
  CrossLeagueSummaryWidget".* Average rank is a per-league concept flattened into one mushy number
  (and meaningless for single-league players); per-league rank lives on the league rows instead.
- **"Recent activity" = inline, not a separate feed.** Movement shows as (a) a rank-delta badge on
  each league row and (b) a one-line impact on the Latest Result card — never a standalone feed
  (empty between matches, duplicates the rows).
- **Tapping a league = navigate to its leaderboard** (current behaviour; no inline expand).

| Batch | Model | Effort | Items | Status |
|---|---|---|---|---|
| ~~U15~~ | ~~🟢 Sonnet~~ | ~~—~~ | ~~invite/share polish~~ | ✅ Shipped 2026-06-02 (87aa800, 95a8aa9) |
| ~~U16~~ | ~~🟢 Sonnet~~ | ~~~3 h~~ | ~~U16.1–U16.5~~ | ✅ Shipped 2026-06-02 (1efeb85, 98c3730) |

---

## ~~U15 — Invite/share polish~~ 🟢 Sonnet · ✅ shipped 2026-06-02

Shipped ahead of being written up here (ad-hoc, after round 4's U14); recorded for ledger
completeness — full detail in the commits + session-log.

- Rich invite share message + native share sheet (`navigator.share`) with clipboard fallback, plus
  a join-page lift. New `apps/web/src/lib/invite.ts`; edits to `JoinPage.tsx`,
  `LeagueAdminInvitesPage.tsx`, `LeagueHomePage.tsx`; tests `invite.test.ts` + `e2e/join.spec.ts`.
- **Commits:** `87aa800` (feat) + `95a8aa9` (e2e fix). **Close-out status:** CI/merge not captured
  at write-up time — confirm before relying on it as merged.

---

## U16 — Home points-hero + inline rank movement 🟢 Sonnet · ~3 h

Flips the dashboard's lead metric to total points and surfaces per-league rank movement inline,
reusing data the home page already fetches. Builds on U11 (dashboard order) and U11.3 (Latest
Result full breakdown — keep it, add the impact line beneath).

> **Watch-outs before coding:**
> - **Snapshot timestamp ties.** `LeaderboardSnapshot.snapshot_at` can tie across rows written in
>   the same scoring transaction — order each player's snapshots by `snapshot_at DESC` **with a
>   deterministic secondary key** (a monotonic snapshot id/sequence if one exists, otherwise the
>   triggering match's `kickoff_utc`), never `snapshot_at` alone, or the "latest two" — and hence
>   the delta — is non-deterministic.
> - **`per_league` already carries `rank`, `member_count`, `name`, `slug`** (see
>   `routers/me.py` `cross-league-summary`). The compact rows can read rank from there and **drop
>   their own `/leagues/{slug}/leaderboard` fetch** — which also sidesteps the C-2 duplicate-rows
>   bug on the dashboard. Verify the summary's rank source is snapshot-based and dedup-safe.
> - **Keep `avg_rank` in the response** (back-compat) even though the UI stops rendering it; a
>   later cleanup can drop it if no other consumer exists. Don't break the response shape.

- **U16.1** Points hero. Remove `CrossLeagueSummaryWidget` (`DashboardPage.tsx:27-76` def, `:368`
  render) and the plain `<h1>` greeting (`:360-363`). Add a `PointsHero` at the very top of the
  page: large `total_points` (mono, `text-4xl`+, primary) with a "POINTS" eyebrow and a smaller
  "Welcome back, {displayName}" subline. Pure number — no avg-rank, no breakdown. Reads
  `total_points` from the existing cross-league-summary query. (~30 min)

- **U16.2** Hero zero / pre-tournament state. Before any result is scored (`total_points === 0`),
  don't render a deflating bare "0" — keep the hero but swap the subline to a gentle nudge (e.g.
  "Your tally starts when the first results land · WC kicks off 11 Jun"). The tournament starts
  ~2026-06-11, so this is the launch-day state for every player. (~15 min)

- **U16.3** Backend — rank delta on the summary. Extend each `per_league` entry of
  `GET /api/v1/me/cross-league-summary` (`routers/me.py:42-132`) with `rank_delta: int | null` and
  `triggered_by_match_id: str | null`. For each (player, league): take the two most recent
  `LeaderboardSnapshot` rows (ordered per the tie-safe rule in the watch-out); `rank_delta =
  prior.rank − latest.rank` (positive = moved up); `triggered_by_match_id =
  latest.triggered_by_match_id`. `null` when fewer than 2 snapshots. Update the `CrossLeagueSummary`
  response model and the frontend `lib/types.ts` shape. Pytest: two snapshots → correct signed
  delta; single snapshot → null; equal ranks → 0; deterministic under tied `snapshot_at`. (~75 min)

- **U16.4** League rows from one call + delta badge. Repoint `CompactLeagueRow`
  (`DashboardPage.tsx:151-192`) to read `rank` / `member_count` / `rank_delta` from the
  cross-league-summary `per_league` array instead of issuing a per-league
  `/api/v1/leagues/{slug}/leaderboard` query each (N+1 → 1). Render a compact delta badge next to
  the rank: `↑2` (success), `↓1` (danger/muted), `▬` or hidden for 0/null. Tap still routes to
  `/leagues/{slug}/leaderboard`. (~45 min)

- **U16.5** Impact line on Latest Result. In `LatestResultCard` (`DashboardPage.tsx:198-276`),
  under the existing points breakdown, render a one-line movement summary when the card's
  `match_id` equals a `per_league` entry's `triggered_by_match_id`: e.g. "↑2 in The Steele Sheet ·
  ↑1 in Office League". Build the league→delta list from the per_league array filtered to that
  match; omit the line entirely when nothing traces to this result (no snapshot, deltas all 0, or
  match mismatch). This is the "score → consequence" narrative, attached to its cause. (~30 min)

**Acceptance:**
- No `CrossLeagueSummaryWidget` and no average-rank number anywhere on the dashboard.
- Dashboard top is the points hero: global `total_points`, pure number + "POINTS" + name; the
  zero / pre-tournament state is a gentle nudge, not a bare "0".
- `cross-league-summary` `per_league` entries return `rank_delta` + `triggered_by_match_id`; delta
  is signed correctly (up = positive), `null` below 2 snapshots, deterministic under tied
  `snapshot_at`; `avg_rank` still present (back-compat); pytest green.
- League rows render from the single summary call (no per-league leaderboard fetches remain on the
  dashboard) and show a ↑/↓/▬ delta badge; tapping a row opens that league's leaderboard.
- Latest Result shows the per-league movement impact line when the deltas trace to that match, and
  omits it otherwise.
- Home page issues one request for hero + rows + impact (the N+1 fetch is gone).
- Vitest covers the hero zero state, the delta-badge rendering, and the impact-line match/omit
  logic; all existing Vitest + a11y tests green.

---

## Close-out (round 5)

Push the U16 branch (`feat/premium-polish-8`, or the next free number) → `/phase-closeout U16` (CI
poll + ff-merge; manual fallback if the `U` prefix isn't recognised) → lean `session-log.md` entry
→ strike the U16 row in the round-5 table above. Independent of rounds 2–4 — ff-merge once green.
