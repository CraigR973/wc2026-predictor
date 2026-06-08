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
