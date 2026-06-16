# Phase batching plan (6.1+)

Sessions that group same-model adjacent phases amortize the cold system prompt.
Use this table to pick the next batch at close-out. Update as phases land.

| Batch | Model | Phases | Rationale |
|---|---|---|---|
| ~~1~~ | ~~🟢 Sonnet~~ | ~~6.1, 6.2, 6.3, 6.4~~ | ✅ Shipped 2026-05-12 |
| ~~2~~ | ~~🔴 Opus~~ | ~~7.1~~ | ✅ Shipped 2026-05-14 |
| ~~3~~ | ~~🟢 Sonnet~~ | ~~7.2, 7.4~~ | ✅ Shipped 2026-05-15 |
| ~~4~~ | ~~🔴 Opus~~ | ~~7.3~~ | ✅ Shipped 2026-05-15 |
| ~~5~~ | ~~🟢 Sonnet~~ | ~~8.1, 8.2~~ | ✅ Shipped 2026-05-15 |
| ~~6~~ | ~~🟢 Sonnet~~ | ~~9.1, 9.2, 9.3~~ | ✅ Shipped 2026-05-15 |
| ~~7~~ | ~~🔴 Opus~~ | ~~9.4~~ | ✅ Shipped 2026-05-15 |
| ~~8~~ | ~~🟢 Sonnet~~ | ~~10.1, 10.2, 10.3, 10.4~~ | ✅ Shipped 2026-05-16 |
| ~~9~~ | ~~🟢 Sonnet~~ | ~~11.1, 11.3, 11.4, 11.5~~ | ✅ Shipped 2026-05-16 |
| ~~10~~ | ~~🔴 Opus~~ | ~~11.2~~ | ✅ Shipped 2026-05-16 |
| ~~11~~ | ~~🟢 Sonnet~~ | ~~11.6, 11.7~~ | ✅ Shipped 2026-05-16 |
| ~~12~~ | ~~🔴 Opus~~ | ~~11.8~~ | ✅ Shipped 2026-05-17 |
| ~~13~~ | ~~🟢 Sonnet~~ | ~~12.1, 12.2~~ | ✅ Shipped 2026-06-02 |

Mark batches complete by striking through the row or removing it.

---

## Multi-league (v1)

Per `docs/multi-league-architecture.md` § 8. Each row = one session. Order is sequential — M1 must land before M2, etc.

| Batch | Model | Phases | Rationale |
|---|---|---|---|
| ~~M1~~ | ~~🔴 Opus~~ | ~~M1~~ | ✅ Shipped 2026-05-27 |
| ~~M2~~ | ~~🔴 Opus~~ | ~~M2~~ | ✅ Shipped 2026-05-27 |
| ~~M3~~ | ~~🟢 Sonnet~~ | ~~M3~~ | ✅ Shipped 2026-05-27 |
| ~~M4~~ | ~~🟢 Sonnet~~ | ~~M4~~ | ✅ Shipped 2026-05-28 |
| ~~M5~~ | ~~🔴 Opus~~ | ~~M5~~ | ✅ Shipped 2026-05-28 |
| ~~M6~~ | ~~🟢 Sonnet~~ | ~~M6~~ | ✅ Shipped 2026-05-28 |
| ~~M7~~ | ~~🟢 Sonnet~~ | ~~M7~~ | ✅ Shipped 2026-05-28 |
| ~~M8~~ | ~~🟢 Sonnet~~ | ~~M8~~ | ✅ Shipped 2026-05-28 |
| ~~M9~~ | ~~🟢 Sonnet~~ | ~~M9~~ | ✅ Shipped 2026-05-29 |
| ~~M10~~ | ~~🟢 Sonnet~~ | ~~M10~~ | ✅ Shipped 2026-05-30 |

Mark batches complete by striking through the row or removing it.

---

## Polish / UX snags

Ad-hoc UI polish and snag-fix sessions. Not tied to architecture phases — logged here for audit trail.

| Batch | Model | Description | Commits | Status |
|---|---|---|---|---|
| ~~U45~~ | ~~🟢 Sonnet~~ | ~~About-first onboarding, pre-tournament guardrail, SpecialsForm embedded, FirstRunController redirect~~ | ~~9fdf29c, 53729f5, 5befaa2, 8deb150, 344350f~~ | ✅ Shipped 2026-06-07 |
| ~~U46/U47~~ | ~~🟢 Sonnet~~ | ~~Hub cards, home polish, mobile snags, LeagueActionsMenu pills, leaderboard names, scoring guide~~ | ~~17ff63b, 59df545, 4b8c2fc~~ | ✅ Shipped 2026-06-07 |
| ~~U48~~ | ~~🟢 Sonnet~~ | ~~Multi-league messaging, invite copy, pre-tournament tasks non-clickable, avatar lightbox, back button, compact league cards~~ | ~~f3657e1, 0eece3c, f0f7177, 44659c7, 65c5cce, b630b5f~~ | ✅ Shipped 2026-06-08 |
| ~~U49~~ | ~~🟢 Sonnet~~ | ~~queryClient.clear() on auth change, per-user sss_tour_seen key, compact league card single-line rank, dummy account timezone fix~~ | ~~2b66b4d, 1a1e193~~ | ✅ Shipped 2026-06-08 |
| ~~U50~~ | ~~🟢 Sonnet~~ | ~~Prod launch hotfix: football-data ID auto-backfill shipped, Railway prod backend redeployed to `1702dc0`, prod team/match football-data IDs backfilled to zero nulls~~ | ~~186366b, 5db1394, 1702dc0~~ | ✅ Shipped 2026-06-08 |
| ~~U51~~ | ~~🟢 Sonnet~~ | ~~Join code hotfix: rotate UI race (stale code shown after rotation), iOS autocorrect on code input, auth join-by-code rate limit too tight (10→30/hour)~~ | ~~8cddb26~~ | ✅ Shipped 2026-06-08 |
| ~~U52~~ | ~~🟢 Sonnet~~ | ~~Post-launch hotfixes: remove login lockout (too aggressive), member_joined enum missing → join-by-code ghost notification, superadmin rotate any league's join code, Discover leagues broken (paginated response treated as array + missing privacy field), tiebreaker column padding, avatar not showing on leaderboard (withLeagueRoster missing avatar_url, LeagueDetail.members type missing field, imgError state not reset on src change, missing cache invalidation after upload)~~ | ~~1936ce6, 94ef295, f8d823f, 9a2ec36, be61023, 2cb4bed, 7965396, 084e703, 60e4ccd~~ | ✅ Shipped 2026-06-09 |
| ~~OPS-1~~ | ~~🟢 Sonnet~~ | ~~Ops: Lewis S PIN reset (wrong prod DB — Supabase MCP was on staging); CORS fix — Vercel /api/* proxy rewrite so corporate SSL-inspection proxies can't block Railway calls; corrected VITE_API_URL (empty string broke old guard → set to Vercel origin); Supabase MCP .mcp.json pointed to prod~~ | ~~e8f2f21, c873923~~ | ✅ 2026-06-09 |
| ~~U53~~ | ~~🟢 Sonnet~~ | ~~First-run launchpad (replaces /about redirect), pre-tournament checklist surfaced above scoring ref, notification prompt gated behind first-run, kickoff countdown, "Turn on match alerts" checklist item synced with prompt state, top bar brand mark mobile/iPhone positioning fixes~~ | ~~d7bb1d3, f14583b, 36d6265, 3edf307, ff4f201, 632d2d1, eb7ac01, 0f6d30a, 1929605, ef3bb56, 4263d7d, a9b1edd, f92cb99, ecf8d0b~~ | ✅ Shipped 2026-06-10 |
| ~~U54~~ | ~~🟢 Sonnet~~ | ~~Live hub hotfix: hide fabricated 0–0 score + provisional points when actual scores are null (live match, feed has no in-play score); label own prediction "Your pick:" instead of "You"~~ | ~~0ac4714, f5fc87c~~ | ✅ Shipped 2026-06-10 |
| ~~OPS-2~~ | ~~🔴 Opus~~ | ~~Proactive prod monitor (healthcheck/remediate/CI-orchestration scripts + ~15-min cron) and @claude auto-fix PR pipeline (Pro OAuth-token auth + dual-Pro failover, PR_PAT draft-PR so CI runs, issues-opened gated to OWNER, monitor issues authored as Actions bot), dead-man's-switch ping, prod-monitor runbook~~ | ~~69c45c4, cabec61, b229b51, eb3657d, f63ac4b, 6dd0d8e, c8f49ce~~ | ✅ Shipped 2026-06-11 |
| ~~U55~~ | ~~🟢 Sonnet~~ | ~~Pre-tournament push blast + home banner (blocks after kickoff; HomeTodoBlock specials_count 0-6 + opening_match_predicted), T-15 deadline warning now unpredicted-only, 9pm UK evening nudge for matches kicking off 22:00–10:00 UK, phone-first match-day runbook~~ | ~~38e4a6c, aa69ed3, 02c4d1f, 51b2e55~~ | ✅ Shipped 2026-06-11 |
| ~~U56~~ | ~~🟢 Sonnet~~ | ~~Global cross-league leaderboard (/leaderboard/global — virtual ranking re-ranked in Python, no schema change) + global specials comparison (gated behind lock), TournamentRevealModal (once via localStorage), kickoff + specials_revealed notifications, migration 032 (enum ADD VALUE needs autocommit_block), removed per-league all-picks table~~ | ~~a9dde06, 6475a46, 5d6f6eb, e85a464, 5f273f7, c8c50c1, f852ad8~~ | ✅ Shipped 2026-06-11 |
| ~~U57~~ | ~~🟢 Sonnet~~ | ~~Dashboard/live-hub: poll matches every 60s so live hub auto-appears, removed PreTournamentChecklist (tournament started), tightened rollup rows (drop flags, cap at 4 + overflow hint)~~ | ~~ef65f83, 6b6f11e, 9332163, a8479b8~~ | ✅ Shipped 2026-06-11 |
| ~~U58~~ | ~~🟢 Sonnet~~ | ~~CI test hardening: test_r13_hardening route assertion made robust to path-less FastAPI routes (_IncludedRouter has no .path) — fixes pytest red caused by dependency drift on unpinned fastapi/starlette; deeper fix (version pinning) deferred~~ | ~~81ee05c, 7e5277b~~ | ✅ Shipped 2026-06-16 |
