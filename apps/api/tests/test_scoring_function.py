"""Phase 1.5 — calculate_match_points Postgres function tests.

Exercises the SQL scoring function against a live Postgres database with
all migrations applied. These tests skip when ``DATABASE_URL`` is not set
(see ``conftest.py``).
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def _calc(
    conn: AsyncConnection,
    predicted_home: int | None,
    predicted_away: int | None,
    actual_home: int | None,
    actual_away: int | None,
    stage: str,
) -> dict[str, Any]:
    """Call calculate_match_points and return the JSON breakdown as a dict.

    The function is invoked inside the connection's existing transaction —
    asserting the acceptance criterion that the function works within a
    transaction.
    """
    result = await conn.execute(
        text(
            "SELECT calculate_match_points(:ph, :pa, :ah, :aw, CAST(:st AS tournament_stage))::text"
        ),
        {
            "ph": predicted_home,
            "pa": predicted_away,
            "ah": actual_home,
            "aw": actual_away,
            "st": stage,
        },
    )
    raw = result.scalar_one()
    parsed: dict[str, Any] = json.loads(raw)
    return parsed


def _expected(goals: int, result: int, exact: int, no_prediction: bool = False) -> dict[str, Any]:
    return {
        "goals": goals,
        "result": result,
        "exact": exact,
        "total": goals + result + exact,
        "no_prediction": no_prediction,
    }


KNOCKOUT_STAGES = ["r32", "r16", "qf", "sf", "third_place", "final"]


# ---------------------------------------------------------------------------
# NULL prediction handling
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "ph, pa",
    [
        (None, None),
        (None, 0),
        (1, None),
        (None, 2),
    ],
)
async def test_null_prediction_returns_no_prediction_flag(
    db_conn: AsyncConnection, ph: int | None, pa: int | None
) -> None:
    out = await _calc(db_conn, ph, pa, 1, 0, "group")
    assert out == _expected(0, 0, 0, no_prediction=True)


async def test_null_prediction_with_null_actual(db_conn: AsyncConnection) -> None:
    out = await _calc(db_conn, None, None, None, None, "group")
    assert out == _expected(0, 0, 0, no_prediction=True)


async def test_null_actual_with_real_prediction(db_conn: AsyncConnection) -> None:
    """Actual not yet entered: zero points, but no_prediction stays false."""
    out = await _calc(db_conn, 2, 1, None, None, "group")
    assert out == _expected(0, 0, 0, no_prediction=False)


# ---------------------------------------------------------------------------
# Group stage
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "ph, pa, ah, aw, expected",
    [
        # Exact scoreline — max 10 (goals + result + exact)
        (1, 0, 1, 0, _expected(2, 3, 5)),
        (0, 0, 0, 0, _expected(2, 3, 5)),  # 0-0 exact draw
        (3, 3, 3, 3, _expected(2, 3, 5)),  # exact draw, both score
        (7, 2, 7, 2, _expected(2, 3, 5)),  # large exact
        (0, 1, 0, 1, _expected(2, 3, 5)),  # exact away win
        # Goals + result correct, not exact
        (3, 0, 2, 1, _expected(2, 3, 0)),  # both home win, total=3
        (0, 3, 1, 2, _expected(2, 3, 0)),  # both away win, total=3
        # Result correct, goals wrong
        (2, 1, 3, 1, _expected(0, 3, 0)),  # both home win, totals differ
        (0, 2, 0, 4, _expected(0, 3, 0)),  # both away win, totals differ
        (1, 1, 3, 3, _expected(0, 3, 0)),  # both draw, totals differ
        (1, 1, 2, 2, _expected(0, 3, 0)),  # both draw, totals differ (2 vs 4)
        # Goals correct, result wrong (same total goals different result)
        (2, 1, 1, 2, _expected(2, 0, 0)),  # 3 goals total, opposite winner
        (3, 0, 0, 3, _expected(2, 0, 0)),  # 3 goals total, opposite winner
        (1, 0, 0, 1, _expected(2, 0, 0)),  # 1 goal total, opposite winner
        (2, 0, 1, 1, _expected(2, 0, 0)),  # 2 goals: home win vs draw
        (1, 1, 2, 0, _expected(2, 0, 0)),  # 2 goals: draw vs home win
        # Nothing matches
        (0, 0, 1, 0, _expected(0, 0, 0)),  # draw vs home win, different goals
        (2, 2, 1, 0, _expected(0, 0, 0)),  # draw vs home win, different goals
        (1, 0, 0, 2, _expected(0, 0, 0)),  # opposite result, different goals
    ],
)
async def test_group_stage_scoring(
    db_conn: AsyncConnection,
    ph: int,
    pa: int,
    ah: int,
    aw: int,
    expected: dict[str, Any],
) -> None:
    out = await _calc(db_conn, ph, pa, ah, aw, "group")
    assert out == expected


async def test_group_stage_total_capped_at_10(db_conn: AsyncConnection) -> None:
    """Exact match should always sum to exactly 10pts in the group stage."""
    out = await _calc(db_conn, 2, 1, 2, 1, "group")
    assert out["total"] == 10


# ---------------------------------------------------------------------------
# Knockout — score predictions
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("stage", KNOCKOUT_STAGES)
async def test_knockout_exact_scoreline_full_points(db_conn: AsyncConnection, stage: str) -> None:
    """An exact non-draw scoreline scores the full 10pts in any knockout stage."""
    out = await _calc(db_conn, 2, 1, 2, 1, stage)
    assert out == _expected(2, 3, 5)


@pytest.mark.parametrize("stage", KNOCKOUT_STAGES)
async def test_knockout_exact_draw_no_result_points(db_conn: AsyncConnection, stage: str) -> None:
    """Exact 1-1 in a knockout: goals + exact, but no result points (no draws)."""
    out = await _calc(db_conn, 1, 1, 1, 1, stage)
    assert out == _expected(2, 0, 5)
    assert out["total"] == 7


async def test_knockout_predicted_draw_actual_home_win(
    db_conn: AsyncConnection,
) -> None:
    """Predicting a draw should never earn result points in knockouts."""
    out = await _calc(db_conn, 1, 1, 2, 1, "r16")
    # goals: pred 2 vs actual 3 -> 0; result: draw vs home win -> 0; exact: 0
    assert out == _expected(0, 0, 0)


async def test_knockout_actual_draw_predicted_home_win(
    db_conn: AsyncConnection,
) -> None:
    """If the 90-min score is a draw, no one earns result points (knockout)."""
    out = await _calc(db_conn, 2, 1, 1, 1, "qf")
    # goals: 3 vs 2 -> 0; result: home vs draw mismatch -> 0; exact: 0
    assert out == _expected(0, 0, 0)


async def test_knockout_actual_draw_predicted_away_win(
    db_conn: AsyncConnection,
) -> None:
    out = await _calc(db_conn, 0, 1, 1, 1, "sf")
    # goals: 1 vs 2 -> 0; result mismatch -> 0; exact: 0
    assert out == _expected(0, 0, 0)


async def test_knockout_zero_zero_actual_draw_zero_zero_predicted(
    db_conn: AsyncConnection,
) -> None:
    """0-0 actual at 90 (knockout decided on pens). Exact 0-0 prediction:
    goals + exact, but draws don't earn result points in knockouts."""
    out = await _calc(db_conn, 0, 0, 0, 0, "final")
    assert out == _expected(2, 0, 5)


async def test_knockout_goals_and_result_correct_not_exact(
    db_conn: AsyncConnection,
) -> None:
    out = await _calc(db_conn, 3, 0, 2, 1, "r16")
    # goals 3==3 -> 2; result both home win -> 3; exact: 0 -> 5pts
    assert out == _expected(2, 3, 0)


async def test_knockout_same_total_opposite_winner(
    db_conn: AsyncConnection,
) -> None:
    """Same total goals but opposite winner: goals only (no result points)."""
    out = await _calc(db_conn, 2, 1, 1, 2, "qf")
    assert out == _expected(2, 0, 0)


async def test_knockout_third_place_treated_as_knockout(
    db_conn: AsyncConnection,
) -> None:
    """The third-place play-off must follow knockout rules (no draw points)."""
    out = await _calc(db_conn, 1, 1, 1, 1, "third_place")
    assert out == _expected(2, 0, 5)


async def test_knockout_final_treated_as_knockout(
    db_conn: AsyncConnection,
) -> None:
    out = await _calc(db_conn, 0, 0, 0, 0, "final")
    assert out == _expected(2, 0, 5)


async def test_group_vs_knockout_diverge_only_on_draws(
    db_conn: AsyncConnection,
) -> None:
    """Group and knockout return identical breakdowns except for draws.

    1-1 vs 1-1: group gets 10, knockout gets 7 (no result points).
    2-1 vs 2-1 (a non-draw): both stages return 10.
    """
    group_draw = await _calc(db_conn, 1, 1, 1, 1, "group")
    knockout_draw = await _calc(db_conn, 1, 1, 1, 1, "r16")
    assert group_draw["result"] == 3
    assert knockout_draw["result"] == 0
    assert group_draw["total"] == 10
    assert knockout_draw["total"] == 7

    group_win = await _calc(db_conn, 2, 1, 2, 1, "group")
    knockout_win = await _calc(db_conn, 2, 1, 2, 1, "r16")
    assert group_win == knockout_win


async def test_total_is_sum_of_components(db_conn: AsyncConnection) -> None:
    """The 'total' field must always equal goals+result+exact."""
    cases: list[tuple[int, int, int, int, str]] = [
        (1, 0, 1, 0, "group"),
        (1, 1, 1, 1, "r16"),
        (3, 0, 2, 1, "group"),
        (0, 0, 0, 0, "final"),
        (5, 1, 2, 4, "group"),
    ]
    for ph, pa, ah, aw, stage in cases:
        out = await _calc(db_conn, ph, pa, ah, aw, stage)
        assert out["total"] == out["goals"] + out["result"] + out["exact"]
