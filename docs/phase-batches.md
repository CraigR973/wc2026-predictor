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
| 6 | 🟢 Sonnet | 9.1, 9.2, 9.3 | Stats API + profile page + H2H API |
| 7 | 🔴 Opus | 9.4 | H2H UI — heavy state management |
| 8 | 🟢 Sonnet | 10.1, 10.2, 10.3, 10.4 | PWA + Web Push end-to-end |
| 9 | 🟢 Sonnet | 11.1, 11.3, 11.4, 11.5 | Dashboard + optimistic UI + backup + runbooks |
| 10 | 🔴 Opus | 11.2 | Offline service worker |
| 11 | 🟢 Sonnet | 11.6, 11.7 | A11y sweep + E2E tests |
| 12 | 🔴 Opus | 11.8 | Visual polish — design loop |

Mark batches complete by striking through the row or removing it.
