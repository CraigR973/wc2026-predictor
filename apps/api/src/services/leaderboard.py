"""Leaderboard snapshot helper for non-trigger paths.

The Postgres ``matches_score_results`` trigger handles snapshot inserts
for the happy path (a match result is entered or overridden). A handful
of other paths also change point totals without updating a match's
``actual_*_score`` columns:

* :func:`src.routers.specials.award_specials` — awarding the three
  special predictions (tournament winner, golden boot, top scoring team)
  bulk-writes ``special_predictions.points_awarded``. Without a snapshot
  refresh here the leaderboard is forever stale once the final is
  scored.
* :func:`src.routers.admin.cancel_match` — cancelling a match zeroes
  ``points_awarded`` on the related ``predictions`` /
  ``knockout_predictions`` rows. The trigger doesn't fire (the score
  columns aren't changed), so we recompute the snapshot ourselves.

This helper mirrors the per-league fan-out from
``migrations/versions/012_per_league_snapshots.py`` so the trigger path
and the non-trigger paths produce identical snapshot rows. Keep the two
SQL bodies in sync if scoring sources or league semantics ever change.
"""

from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def recompute_leaderboard_snapshot(
    session: AsyncSession,
    triggered_by_match_id: uuid.UUID | None,
) -> None:
    """Insert one fresh ``leaderboard_snapshots`` row per active league membership.

    Reads the current sums of ``predictions.points_awarded``,
    ``knockout_predictions.points_awarded``, and
    ``special_predictions.points_awarded`` per profile — the same shape
    the trigger uses — and ranks players by ``total_points`` desc within
    each league.

    Pending session writes are flushed first so the helper sees the
    caller's in-memory mutations (e.g. ``award_specials`` mutating
    ``points_awarded`` on its loaded rows) before computing sums.

    Callers are expected to commit afterwards; this helper does not
    commit on its own.
    """
    await session.flush()
    await session.execute(
        text("""
            INSERT INTO leaderboard_snapshots (
                id, player_id, league_id, total_points, match_points,
                knockout_winner_points, special_points, rank,
                snapshot_at, triggered_by_match_id
            )
            SELECT
                gen_random_uuid(),
                lm.player_id,
                lm.league_id,
                player_totals.total_points,
                player_totals.match_points,
                player_totals.knockout_winner_points,
                player_totals.special_points,
                -- RANK (not DENSE_RANK): tied players get the same rank and the
                -- next rank skips (e.g. two players tied 2nd → next is 4th).
                -- This matches standard sports-table convention where a gap after
                -- a tie is expected.  Switch to DENSE_RANK if gap-free ranks are wanted.
                RANK() OVER (
                    PARTITION BY lm.league_id
                    ORDER BY player_totals.total_points DESC
                ),
                now(),
                :triggered_by_match_id
            FROM league_memberships lm
            JOIN (
                SELECT
                    pr.id AS player_id,
                    COALESCE((
                        SELECT SUM(points_awarded)::int FROM predictions
                        WHERE player_id = pr.id AND deleted_at IS NULL
                    ), 0) AS match_points,
                    COALESCE((
                        SELECT SUM(points_awarded)::int FROM knockout_predictions
                        WHERE player_id = pr.id
                    ), 0) AS knockout_winner_points,
                    COALESCE((
                        SELECT SUM(points_awarded)::int FROM special_predictions
                        WHERE player_id = pr.id
                    ), 0) AS special_points,
                    COALESCE((
                        SELECT SUM(points_awarded)::int FROM predictions
                        WHERE player_id = pr.id AND deleted_at IS NULL
                    ), 0)
                    + COALESCE((
                        SELECT SUM(points_awarded)::int FROM knockout_predictions
                        WHERE player_id = pr.id
                    ), 0)
                    + COALESCE((
                        SELECT SUM(points_awarded)::int FROM special_predictions
                        WHERE player_id = pr.id
                    ), 0) AS total_points
                FROM profiles pr
                WHERE pr.deleted_at IS NULL
            ) AS player_totals ON player_totals.player_id = lm.player_id
            WHERE lm.deleted_at IS NULL
        """),
        {"triggered_by_match_id": triggered_by_match_id},
    )
