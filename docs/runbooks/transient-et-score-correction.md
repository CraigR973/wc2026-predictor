# Runbook: Correct a Knockout Whose 90-min Score Was Stored as the ET Aggregate

Use this when a **completed knockout that went to extra time / penalties shows the
wrong 90-minute scoreline** — specifically the extra-time *aggregate* instead of
the score at the end of normal time — so scoreline points were graded wrongly for
**every** player on that match (draw-predictors scored 0, win-predictors got
phantom points).

> Different symptom from [`knockout-rescore.md`](knockout-rescore.md), which covers
> a correct scoreline that awarded **0 advancement points**. This runbook is for a
> wrong **scoreline**. Both re-fire the same `matches_score_results` trigger.

---

## Root cause

In the minutes right after an extra-time knockout ends, football-data.org can
serve an internally-inconsistent payload: `duration:"REGULAR"`,
`regularTime:{null,null}`, but `extraTime` goals populated and `fullTime` = the
**aggregate** (regulation + ET). The finished-write derives the 90-minute grading
score from `regularTime`, falls back to `fullTime` when it is null, and so stores
the aggregate as if it were the regulation result. The feed self-corrects minutes
later, but `result_source='auto'` made the write idempotent, so auto-sync never
re-healed it.

**Prod incident:** Belgium–Senegal R32 (2026-07-01, fd `537422`) — true 90-min
result a **2-2 draw**, Belgium won 3-2 in extra time; stored as a `3-2` regulation
win. Mikey S. had 5, should have had 8. ~49 of 65 predictions mis-graded.

Two code fixes now prevent recurrence (both shipped 2026-07-02):
- **Parser** (`7830d61`) — derive ET/pens from the *presence* of `extraTime` /
  `penalties` goals, not the `duration` string; 90-min = `regularTime` else
  `fullTime − extraTime − penalties`.
- **Self-heal window** (`1b8c08d`, migration 039) — an auto result stays revisable
  for 30 min after finalization, so a self-correcting feed heals automatically.

This runbook is the manual fallback for the residual case: the feed corrected
**after** the 30-min self-heal window had closed, so the result is frozen wrong.
See memory `project_football_data_transient_et_payload`.

---

## Step 1 — Take a backup

```bash
curl -X POST "https://<prod-api-domain>/api/v1/admin/backup" \
  -H "Authorization: Bearer <admin-jwt-token>"
```

---

## Step 2 — Get the true result from football-data (ground truth)

Never trust the stored row — fetch the feed and derive the 90-minute score
yourself. `<FD_ID>` is `matches.football_data_match_id`.

```bash
curl -s -H "X-Auth-Token: <FOOTBALL_DATA_API_KEY>" \
  "https://api.football-data.org/v4/matches/<FD_ID>" \
  | python3 -c "import sys,json; s=json.load(sys.stdin)['score']; print(s)"
```

Compute the **90-minute** score (what predictions grade on):

- If `regularTime` is populated → that is the 90-min score.
- Else → `90-min = fullTime − extraTime − penalties` (subtract each present sub-score).

Also note the advancer: `score.winner` (`HOME_TEAM` / `AWAY_TEAM`) → the team that
progressed. For Belgium–Senegal: `fullTime 3-2 − extraTime 1-0 = 2-2`; winner
`HOME_TEAM` = Belgium.

> The football-data key is only in Railway prod env, not the repo `.env`. Pull it
> with `railway variables -p <proj> -s <svc> -e production --json` (`unset
> RAILWAY_API_TOKEN` first — the deploy-scoped token is Unauthorized for
> `variables`). See memory `reference_prod_urls`.

---

## Step 3 — Correct the row (single UPDATE, re-fires scoring)

Because migration **037** widened `matches_score_results` to fire on
`actual_home_score` / `actual_away_score` / `penalty_winner_id` changes, one UPDATE
re-scores predictions, re-grades knockout advancement, and rebuilds the per-league
leaderboard snapshots — all inside the trigger's own transaction. No NULL-flicker
needed (the score itself changes). Example values are Belgium–Senegal's; substitute
your match's derived 90-min score, ET scoreline, and advancer team id.

```sql
UPDATE matches
SET actual_home_score      = 2,      -- true 90-min score (NOT the aggregate)
    actual_away_score      = 2,
    extra_time             = true,
    penalties              = false,  -- true only for a shootout
    penalty_winner_id      = '<ADVANCER_TEAM_ID>',  -- so a level 90-min still advances them
    extra_time_home_score  = 3,      -- end-of-ET scoreline for display (90-min + ET goals)
    extra_time_away_score  = 2
WHERE id = '<MATCH_ID>';
```

`result_entered_at` is left untouched (its BEFORE trigger only fires on NULL→non-null).
Setting `penalty_winner_id` is **required** when the corrected 90-min is a draw —
the trigger grades advancement off it, so omitting it would zero everyone's
advancement points.

> This is a **silent** correction — no push notifications fire (only auto-sync's
> `notify_result_detected` pushes; a direct UPDATE does not). Players just see the
> corrected leaderboard.

---

## Step 4 — Verify

```sql
-- Match row now holds the 90-min score + ET metadata:
SELECT actual_home_score, actual_away_score, extra_time, penalties,
       penalty_winner_id, extra_time_home_score, extra_time_away_score,
       result_entered_at
FROM matches WHERE id = '<MATCH_ID>';

-- Scoreline points re-graded against the true 90-min result:
SELECT points_awarded, count(*) FROM predictions
WHERE match_id = '<MATCH_ID>' AND deleted_at IS NULL
GROUP BY 1 ORDER BY 1;

-- Advancement points unchanged (advancer pickers still hold the round value):
SELECT points_awarded, count(*) FROM knockout_predictions
WHERE match_id = '<MATCH_ID>' GROUP BY 1 ORDER BY 1;
```

Then confirm the leaderboard reflects the corrected totals (the trigger wrote a
fresh snapshot generation per active league membership):

```bash
curl "https://<prod-api-domain>/api/v1/leaderboard" \
  -H "Authorization: Bearer <admin-jwt-token>" | jq '.[0:5]'
```

---

## Step 5 — Sweep for other affected matches (optional)

Any completed knockout can be checked against the feed. A stored `extra_time =
false` on a match football-data reports with `extraTime`/`penalties` goals is the
tell. Cross-check each completed knockout's stored score against its feed
`regularTime` (or `fullTime − extraTime − penalties`); a mismatch is a match to
correct. In the 2026-07-01 incident only Belgium–Senegal was affected — the other
seven completed knockouts matched the feed.

---

## Notes

- Regression test: `test_finished_extra_time_with_lying_duration_derives_regulation_score`
  in `apps/api/tests/test_result_sync.py` replays the exact transient payload.
- Self-heal coverage: `test_auto_result_corrected_within_window` (and the
  frozen/unchanged/manual siblings) in the same file lock in the 30-min window.
- If the match went to a shootout, set `penalties = true` and populate
  `penalty_home_score` / `penalty_away_score` from `score.penalties`.
