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
| U2 | 🟢 Sonnet | ~3 h | U2.1–U2.6 | Pending |
| U3 | 🟢 Sonnet | ~4.5 h | U3.1–U3.11 | Pending |
| U4 | 🟢 Sonnet | ~3 h | U4.1–U4.6 | Pending |
| U5 | 🔴 Opus (extended thinking) | ~3 h | U5.1–U5.5 | Pending |

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

**Acceptance:**
- Bracket page empty state shows the greyscale R32 silhouette, countdown, and predict-CTA
- Knockout picks page empty state mirrors the bracket teaser visually
- Groups page pre-tournament shows a "First match" preview row per group, not a wall of zeros
- Group detail standings show 7 columns by default on mobile; toggle expands to all 10
- "(CZE)" suffix removed
- Rank history chart shows connected lines per player + dot markers on top
- Schedule match cards no longer carry the per-card countdown; the page is visibly more compact
- Stage filter label is `3rd place`, not `3rd`
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
