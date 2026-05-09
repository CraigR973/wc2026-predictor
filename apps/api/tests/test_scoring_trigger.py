"""Phase 1.6 — match-result trigger tests.

Each test runs inside the ``db_conn`` fixture's transaction (auto-rolled
back on exit) so we can freely INSERT profiles / matches / predictions
without polluting other tests. The trigger fires in the same
transaction, so every assertion happens atomically with the originating
``UPDATE matches``.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def _exec(conn: AsyncConnection, sql: str, **params: Any) -> Any:
    return await conn.execute(text(sql), params)


async def _scalar(conn: AsyncConnection, sql: str, **params: Any) -> Any:
    result = await conn.execute(text(sql), params)
    return result.scalar_one()


async def _fetchall(conn: AsyncConnection, sql: str, **params: Any) -> list[Any]:
    result = await conn.execute(text(sql), params)
    return list(result.mappings().all())


async def _insert_group(conn: AsyncConnection, name: str) -> uuid.UUID:
    return await _scalar(
        conn,
        "INSERT INTO groups (id, name) VALUES (gen_random_uuid(), :n) RETURNING id",
        n=name,
    )


async def _insert_team(
    conn: AsyncConnection, group_id: uuid.UUID, name: str, code: str, flag: str = "🏳"
) -> uuid.UUID:
    return await _scalar(
        conn,
        """
        INSERT INTO teams (id, name, code, flag_emoji, group_id, is_host)
        VALUES (gen_random_uuid(), :n, :c, :f, :g, FALSE)
        RETURNING id
        """,
        n=name,
        c=code,
        f=flag,
        g=group_id,
    )


async def _insert_profile(
    conn: AsyncConnection,
    display_name: str,
    *,
    role: str = "player",
    deleted: bool = False,
) -> uuid.UUID:
    return await _scalar(
        conn,
        """
        INSERT INTO profiles (id, display_name, pin_hash, role, deleted_at)
        VALUES (
            gen_random_uuid(), :n,
            '$2b$12$0000000000000000000000000000000000000000000000000000',
            CAST(:r AS player_role),
            CASE WHEN :d THEN now() ELSE NULL END
        )
        RETURNING id
        """,
        n=display_name,
        r=role,
        d=deleted,
    )


async def _insert_match(
    conn: AsyncConnection,
    *,
    stage: str,
    match_number: int,
    home_team_id: uuid.UUID,
    away_team_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> uuid.UUID:
    return await _scalar(
        conn,
        """
        INSERT INTO matches (
            id, stage, group_id, match_number, home_team_id, away_team_id,
            kickoff_utc, status
        )
        VALUES (
            gen_random_uuid(), CAST(:st AS tournament_stage), :gid, :mn,
            :h, :a, :k, 'scheduled'
        )
        RETURNING id
        """,
        st=stage,
        gid=group_id,
        mn=match_number,
        h=home_team_id,
        a=away_team_id,
        k=datetime(2026, 6, 11, 18, 0, 0),
    )


async def _insert_prediction(
    conn: AsyncConnection,
    *,
    player_id: uuid.UUID,
    match_id: uuid.UUID,
    home: int | None,
    away: int | None,
) -> uuid.UUID:
    return await _scalar(
        conn,
        """
        INSERT INTO predictions (
            id, player_id, match_id, predicted_home, predicted_away
        )
        VALUES (gen_random_uuid(), :p, :m, :h, :a)
        RETURNING id
        """,
        p=player_id,
        m=match_id,
        h=home,
        a=away,
    )


async def _insert_knockout_prediction(
    conn: AsyncConnection,
    *,
    player_id: uuid.UUID,
    match_id: uuid.UUID,
    predicted_winner_id: uuid.UUID | None,
) -> uuid.UUID:
    return await _scalar(
        conn,
        """
        INSERT INTO knockout_predictions (
            id, player_id, match_id, predicted_winner_id
        )
        VALUES (gen_random_uuid(), :p, :m, :w)
        RETURNING id
        """,
        p=player_id,
        m=match_id,
        w=predicted_winner_id,
    )


async def _enter_result(
    conn: AsyncConnection,
    match_id: uuid.UUID,
    home: int,
    away: int,
    *,
    penalty_winner_id: uuid.UUID | None = None,
) -> None:
    await _exec(
        conn,
        """
        UPDATE matches
        SET actual_home_score = :h,
            actual_away_score = :a,
            penalty_winner_id = :pw,
            status = 'completed'
        WHERE id = :id
        """,
        id=match_id,
        h=home,
        a=away,
        pw=penalty_winner_id,
    )


# ---------------------------------------------------------------------------
# Group-stage match — predictions + leaderboard snapshot
# ---------------------------------------------------------------------------


async def test_group_match_updates_score_predictions(
    db_conn: AsyncConnection,
) -> None:
    g = await _insert_group(db_conn, "A")
    home = await _insert_team(db_conn, g, "Home A", "HMA")
    away = await _insert_team(db_conn, g, "Away A", "AWA")
    alice = await _insert_profile(db_conn, "alice")
    bob = await _insert_profile(db_conn, "bob")
    match = await _insert_match(
        db_conn,
        stage="group",
        match_number=1,
        home_team_id=home,
        away_team_id=away,
        group_id=g,
    )
    # alice predicts the exact score → 10pts.
    # bob predicts opposite winner same total → 2pts.
    await _insert_prediction(db_conn, player_id=alice, match_id=match, home=2, away=1)
    await _insert_prediction(db_conn, player_id=bob, match_id=match, home=1, away=2)

    await _enter_result(db_conn, match, 2, 1)

    rows = await _fetchall(
        db_conn,
        """
        SELECT pr.predicted_home, pr.predicted_away,
               pr.points_awarded, pr.points_breakdown::text AS breakdown,
               pf.display_name
        FROM predictions pr JOIN profiles pf ON pf.id = pr.player_id
        WHERE pr.match_id = :m
        ORDER BY pf.display_name
        """,
        m=match,
    )
    by_name = {r["display_name"]: r for r in rows}
    assert by_name["alice"]["points_awarded"] == 10
    alice_breakdown = json.loads(by_name["alice"]["breakdown"])
    assert alice_breakdown == {
        "goals": 2,
        "result": 3,
        "exact": 5,
        "total": 10,
        "no_prediction": False,
    }
    assert by_name["bob"]["points_awarded"] == 2
    bob_breakdown = json.loads(by_name["bob"]["breakdown"])
    assert bob_breakdown == {
        "goals": 2,
        "result": 0,
        "exact": 0,
        "total": 2,
        "no_prediction": False,
    }


async def test_group_match_inserts_leaderboard_snapshot_per_active_player(
    db_conn: AsyncConnection,
) -> None:
    g = await _insert_group(db_conn, "A")
    home = await _insert_team(db_conn, g, "Home A", "HMA")
    away = await _insert_team(db_conn, g, "Away A", "AWA")
    alice = await _insert_profile(db_conn, "alice")
    bob = await _insert_profile(db_conn, "bob")
    deleted = await _insert_profile(db_conn, "ghost", deleted=True)
    match = await _insert_match(
        db_conn,
        stage="group",
        match_number=1,
        home_team_id=home,
        away_team_id=away,
        group_id=g,
    )
    await _insert_prediction(db_conn, player_id=alice, match_id=match, home=2, away=1)
    await _insert_prediction(db_conn, player_id=bob, match_id=match, home=0, away=0)

    await _enter_result(db_conn, match, 2, 1)

    snaps = await _fetchall(
        db_conn,
        """
        SELECT s.player_id, s.total_points, s.match_points,
               s.knockout_winner_points, s.special_points, s.rank,
               s.triggered_by_match_id, p.display_name
        FROM leaderboard_snapshots s JOIN profiles p ON p.id = s.player_id
        WHERE s.triggered_by_match_id = :m
        ORDER BY s.rank, p.display_name
        """,
        m=match,
    )
    names = [r["display_name"] for r in snaps]
    assert "ghost" not in names, "soft-deleted player must not appear"
    assert set(names) == {"alice", "bob"}
    assert snaps[0]["display_name"] == "alice"
    assert snaps[0]["total_points"] == 10
    assert snaps[0]["match_points"] == 10
    assert snaps[0]["rank"] == 1
    assert snaps[1]["display_name"] == "bob"
    assert snaps[1]["total_points"] == 0
    assert snaps[1]["rank"] == 2
    assert all(r["triggered_by_match_id"] == match for r in snaps)
    assert all(r["knockout_winner_points"] == 0 for r in snaps)
    assert all(r["special_points"] == 0 for r in snaps)
    _ = deleted  # silence unused-warning in some IDEs


async def test_result_entered_at_stamped_atomically(
    db_conn: AsyncConnection,
) -> None:
    g = await _insert_group(db_conn, "A")
    home = await _insert_team(db_conn, g, "Home A", "HMA")
    away = await _insert_team(db_conn, g, "Away A", "AWA")
    match = await _insert_match(
        db_conn,
        stage="group",
        match_number=1,
        home_team_id=home,
        away_team_id=away,
        group_id=g,
    )
    before = await _scalar(
        db_conn,
        "SELECT result_entered_at FROM matches WHERE id = :m",
        m=match,
    )
    assert before is None

    await _enter_result(db_conn, match, 1, 0)

    after = await _scalar(
        db_conn,
        "SELECT result_entered_at FROM matches WHERE id = :m",
        m=match,
    )
    assert after is not None


async def test_trigger_does_not_refire_on_unrelated_update(
    db_conn: AsyncConnection,
) -> None:
    """Updating a non-score column after a result is entered must not fire the
    cascade again — otherwise we'd double-stamp leaderboard snapshots."""
    g = await _insert_group(db_conn, "A")
    home = await _insert_team(db_conn, g, "Home A", "HMA")
    away = await _insert_team(db_conn, g, "Away A", "AWA")
    alice = await _insert_profile(db_conn, "alice")
    match = await _insert_match(
        db_conn,
        stage="group",
        match_number=1,
        home_team_id=home,
        away_team_id=away,
        group_id=g,
    )
    await _insert_prediction(db_conn, player_id=alice, match_id=match, home=1, away=0)

    await _enter_result(db_conn, match, 1, 0)

    snap_count_first = await _scalar(
        db_conn,
        "SELECT COUNT(*) FROM leaderboard_snapshots WHERE triggered_by_match_id = :m",
        m=match,
    )
    assert snap_count_first == 1

    # Touch a non-score column.
    await _exec(
        db_conn,
        "UPDATE matches SET venue = 'Wembley' WHERE id = :m",
        m=match,
    )
    snap_count_second = await _scalar(
        db_conn,
        "SELECT COUNT(*) FROM leaderboard_snapshots WHERE triggered_by_match_id = :m",
        m=match,
    )
    assert snap_count_second == 1


# ---------------------------------------------------------------------------
# Knockout-stage match — knockout_predictions + winner via penalties
# ---------------------------------------------------------------------------


async def test_knockout_match_awards_round_points_to_correct_winner_pickers(
    db_conn: AsyncConnection,
) -> None:
    g = await _insert_group(db_conn, "A")
    home = await _insert_team(db_conn, g, "Home A", "HMA")
    away = await _insert_team(db_conn, g, "Away A", "AWA")
    alice = await _insert_profile(db_conn, "alice")
    bob = await _insert_profile(db_conn, "bob")
    match = await _insert_match(
        db_conn,
        stage="r16",  # 10pts per correct pick
        match_number=73,
        home_team_id=home,
        away_team_id=away,
    )
    await _insert_knockout_prediction(
        db_conn, player_id=alice, match_id=match, predicted_winner_id=home
    )
    await _insert_knockout_prediction(
        db_conn, player_id=bob, match_id=match, predicted_winner_id=away
    )
    # Score predictions too — they should still be scored.
    await _insert_prediction(db_conn, player_id=alice, match_id=match, home=2, away=1)
    await _insert_prediction(db_conn, player_id=bob, match_id=match, home=0, away=2)

    await _enter_result(db_conn, match, 2, 1)  # home wins

    kp_rows = await _fetchall(
        db_conn,
        """
        SELECT kp.points_awarded, p.display_name
        FROM knockout_predictions kp JOIN profiles p ON p.id = kp.player_id
        WHERE kp.match_id = :m
        ORDER BY p.display_name
        """,
        m=match,
    )
    by_name = {r["display_name"]: r for r in kp_rows}
    assert by_name["alice"]["points_awarded"] == 10  # picked the winner
    assert by_name["bob"]["points_awarded"] == 0  # picked the loser

    # Score predictions also scored — alice exact 10 + knockout 10 = 20.
    snaps = await _fetchall(
        db_conn,
        """
        SELECT total_points, match_points, knockout_winner_points,
               (SELECT display_name FROM profiles WHERE id = s.player_id) AS name
        FROM leaderboard_snapshots s WHERE triggered_by_match_id = :m
        """,
        m=match,
    )
    by_name_snap = {s["name"]: s for s in snaps}
    assert by_name_snap["alice"]["match_points"] == 10
    assert by_name_snap["alice"]["knockout_winner_points"] == 10
    assert by_name_snap["alice"]["total_points"] == 20
    # bob: predicted 0-2 vs actual 2-1 → goals 2 vs 3 (no), result mismatch
    # (signs differ), exact (no) → 0 match points + 0 knockout = 0 total.
    assert by_name_snap["bob"]["match_points"] == 0
    assert by_name_snap["bob"]["knockout_winner_points"] == 0


@pytest.mark.parametrize(
    "stage, expected_pts",
    [
        ("r32", 5),
        ("r16", 10),
        ("qf", 15),
        ("sf", 20),
        ("third_place", 10),
        ("final", 25),
    ],
)
async def test_knockout_round_points_per_stage(
    db_conn: AsyncConnection, stage: str, expected_pts: int
) -> None:
    g = await _insert_group(db_conn, "A")
    home = await _insert_team(db_conn, g, "Home A", "HMA")
    away = await _insert_team(db_conn, g, "Away A", "AWA")
    alice = await _insert_profile(db_conn, "alice")
    match = await _insert_match(
        db_conn,
        stage=stage,
        match_number=200,
        home_team_id=home,
        away_team_id=away,
    )
    await _insert_knockout_prediction(
        db_conn, player_id=alice, match_id=match, predicted_winner_id=home
    )

    await _enter_result(db_conn, match, 1, 0)

    pts = await _scalar(
        db_conn,
        "SELECT points_awarded FROM knockout_predictions WHERE match_id = :m",
        m=match,
    )
    assert pts == expected_pts


async def test_knockout_draw_winner_is_penalty_winner(
    db_conn: AsyncConnection,
) -> None:
    """A 90-min knockout draw: penalty_winner_id determines the winner picker."""
    g = await _insert_group(db_conn, "A")
    home = await _insert_team(db_conn, g, "Home A", "HMA")
    away = await _insert_team(db_conn, g, "Away A", "AWA")
    alice = await _insert_profile(db_conn, "alice")
    bob = await _insert_profile(db_conn, "bob")
    match = await _insert_match(
        db_conn,
        stage="qf",  # 15pts per correct pick
        match_number=99,
        home_team_id=home,
        away_team_id=away,
    )
    await _insert_knockout_prediction(
        db_conn, player_id=alice, match_id=match, predicted_winner_id=home
    )
    await _insert_knockout_prediction(
        db_conn, player_id=bob, match_id=match, predicted_winner_id=away
    )

    # 1-1 at 90, away wins on pens.
    await _enter_result(db_conn, match, 1, 1, penalty_winner_id=away)

    rows = await _fetchall(
        db_conn,
        """
        SELECT kp.points_awarded, pf.display_name
        FROM knockout_predictions kp JOIN profiles pf ON pf.id = kp.player_id
        WHERE kp.match_id = :m
        """,
        m=match,
    )
    by_name = {r["display_name"]: r for r in rows}
    assert by_name["alice"]["points_awarded"] == 0
    assert by_name["bob"]["points_awarded"] == 15


async def test_group_match_does_not_touch_knockout_predictions(
    db_conn: AsyncConnection,
) -> None:
    """Defensive: the trigger must skip the knockout branch for group matches.

    knockout_predictions for a group match shouldn't exist in normal use,
    but if one is present (e.g. orphaned data) the trigger must leave its
    points_awarded as NULL.
    """
    g = await _insert_group(db_conn, "A")
    home = await _insert_team(db_conn, g, "Home A", "HMA")
    away = await _insert_team(db_conn, g, "Away A", "AWA")
    alice = await _insert_profile(db_conn, "alice")
    match = await _insert_match(
        db_conn,
        stage="group",
        match_number=1,
        home_team_id=home,
        away_team_id=away,
        group_id=g,
    )
    kp = await _insert_knockout_prediction(
        db_conn, player_id=alice, match_id=match, predicted_winner_id=home
    )

    await _enter_result(db_conn, match, 1, 0)

    pts = await _scalar(
        db_conn,
        "SELECT points_awarded FROM knockout_predictions WHERE id = :id",
        id=kp,
    )
    assert pts is None


# ---------------------------------------------------------------------------
# Leaderboard correctness
# ---------------------------------------------------------------------------


async def test_leaderboard_rank_with_tie(db_conn: AsyncConnection) -> None:
    """Tied players share the same rank (RANK() semantics)."""
    g = await _insert_group(db_conn, "A")
    home = await _insert_team(db_conn, g, "Home A", "HMA")
    away = await _insert_team(db_conn, g, "Away A", "AWA")
    alice = await _insert_profile(db_conn, "alice")
    bob = await _insert_profile(db_conn, "bob")
    carol = await _insert_profile(db_conn, "carol")
    match = await _insert_match(
        db_conn,
        stage="group",
        match_number=1,
        home_team_id=home,
        away_team_id=away,
        group_id=g,
    )
    # alice & bob both predict 1-0 (exact = 10pts), carol predicts 0-2 (0pts —
    # totals differ AND opposite winner).
    await _insert_prediction(db_conn, player_id=alice, match_id=match, home=1, away=0)
    await _insert_prediction(db_conn, player_id=bob, match_id=match, home=1, away=0)
    await _insert_prediction(db_conn, player_id=carol, match_id=match, home=0, away=2)

    await _enter_result(db_conn, match, 1, 0)

    rows = await _fetchall(
        db_conn,
        """
        SELECT s.rank, s.total_points, p.display_name
        FROM leaderboard_snapshots s JOIN profiles p ON p.id = s.player_id
        WHERE s.triggered_by_match_id = :m
        ORDER BY s.rank, p.display_name
        """,
        m=match,
    )
    assert rows[0]["display_name"] == "alice"
    assert rows[0]["rank"] == 1
    assert rows[0]["total_points"] == 10
    assert rows[1]["display_name"] == "bob"
    assert rows[1]["rank"] == 1  # tie
    assert rows[1]["total_points"] == 10
    assert rows[2]["display_name"] == "carol"
    assert rows[2]["rank"] == 3  # rank skips after tie
    assert rows[2]["total_points"] == 0


async def test_player_with_null_prediction_gets_zero(
    db_conn: AsyncConnection,
) -> None:
    """A row with NULL predicted_home/away gets the no_prediction breakdown."""
    g = await _insert_group(db_conn, "A")
    home = await _insert_team(db_conn, g, "Home A", "HMA")
    away = await _insert_team(db_conn, g, "Away A", "AWA")
    alice = await _insert_profile(db_conn, "alice")
    match = await _insert_match(
        db_conn,
        stage="group",
        match_number=1,
        home_team_id=home,
        away_team_id=away,
        group_id=g,
    )
    await _insert_prediction(db_conn, player_id=alice, match_id=match, home=None, away=None)

    await _enter_result(db_conn, match, 1, 0)

    row = await _fetchall(
        db_conn,
        """
        SELECT points_awarded, points_breakdown::text AS breakdown
        FROM predictions WHERE match_id = :m AND player_id = :p
        """,
        m=match,
        p=alice,
    )
    assert row[0]["points_awarded"] == 0
    breakdown = json.loads(row[0]["breakdown"])
    assert breakdown["no_prediction"] is True
    assert breakdown["total"] == 0


async def test_atomicity_all_writes_visible_after_update(
    db_conn: AsyncConnection,
) -> None:
    """Within the originating transaction, all trigger writes are visible
    immediately after the UPDATE returns. Concurrent observers either see
    the full committed state or the prior state — never a partial mix."""
    g = await _insert_group(db_conn, "A")
    home = await _insert_team(db_conn, g, "Home A", "HMA")
    away = await _insert_team(db_conn, g, "Away A", "AWA")
    alice = await _insert_profile(db_conn, "alice")
    match = await _insert_match(
        db_conn,
        stage="group",
        match_number=1,
        home_team_id=home,
        away_team_id=away,
        group_id=g,
    )
    await _insert_prediction(db_conn, player_id=alice, match_id=match, home=1, away=0)

    counts = await _fetchall(
        db_conn,
        """
        SELECT
            (SELECT COUNT(*) FROM predictions
                WHERE match_id = :m AND points_awarded IS NOT NULL) AS scored,
            (SELECT COUNT(*) FROM leaderboard_snapshots
                WHERE triggered_by_match_id = :m) AS snaps,
            (SELECT result_entered_at FROM matches WHERE id = :m) AS rea
        """,
        m=match,
    )
    assert counts[0]["scored"] == 0
    assert counts[0]["snaps"] == 0
    assert counts[0]["rea"] is None

    await _enter_result(db_conn, match, 1, 0)

    counts2 = await _fetchall(
        db_conn,
        """
        SELECT
            (SELECT COUNT(*) FROM predictions
                WHERE match_id = :m AND points_awarded IS NOT NULL) AS scored,
            (SELECT COUNT(*) FROM leaderboard_snapshots
                WHERE triggered_by_match_id = :m) AS snaps,
            (SELECT result_entered_at FROM matches WHERE id = :m) AS rea
        """,
        m=match,
    )
    # All three writes happened in the same transaction as the UPDATE.
    assert counts2[0]["scored"] == 1
    assert counts2[0]["snaps"] == 1
    assert counts2[0]["rea"] is not None
