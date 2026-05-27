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

Mark batches complete by striking through the row or removing it.

---

## Multi-league (v1)

Per `docs/multi-league-architecture.md` § 8. Each row = one session. Order is sequential — M1 must land before M2, etc.

| Batch | Model | Phases | Rationale |
|---|---|---|---|
| ~~M1~~ | ~~🔴 Opus~~ | ~~M1~~ | ✅ Shipped 2026-05-27 |
| M2 | 🔴 Opus | M2 | Per-league snapshot scoping + scoring trigger rewrite — preserves C-2 dedupe, fans out to per-(player, league) rows |
| M3 | 🟢 Sonnet | M3 | League management API (CRUD + privacy matrix + last-admin protection) |
| M4 | 🟢 Sonnet | M4 | Auth refactor — email signup, email-based login, optional verification, self-service PIN reset (Resend integration) |
| M5 | 🔴 Opus | M5 | Per-league API scoping + cross-league summary endpoint + dedupedLeaderboard signature update |
| M6 | 🟢 Sonnet | M6 | Frontend — signup, /welcome, /leagues/*, LeagueContext, TopBar switcher, login screen reshape |
| M7 | 🟢 Sonnet | M7 | Frontend — move per-league screens under /leagues/{slug}/*, dashboard hero, superadmin all-leagues page |
| M8 | 🟢 Sonnet | M8 | Cleanup + polish — NOT NULL constraints, deprecated endpoints removed, Playwright multi-league e2e, runbook updates, 24-48h soak |

Mark batches complete by striking through the row or removing it.
