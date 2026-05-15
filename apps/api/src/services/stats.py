"""Player statistics computation service."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.match import Match
from src.models.prediction import KnockoutPrediction, Prediction
from src.models.profile import Profile


@dataclass
class _PredRow:
    """Minimal prediction data needed for stats computation."""

    player_id: UUID
    points_awarded: int
    points_breakdown: dict[str, Any] | None
    submitted_at: datetime | None
    stage: str
    kickoff_utc: datetime | None


@dataclass
class PlayerStatsData:
    player_id: str
    player_name: str
    total_predictions_settled: int
    accuracy_pct: float
    exact_rate_pct: float
    avg_pts_per_prediction: float
    total_points: int
    best_round: str | None
    best_round_points: int | None
    worst_round: str | None
    worst_round_points: int | None
    current_streak: int
    avg_prediction_timing_mins: float | None


def _compute_stats(
    player_id: UUID,
    player_name: str,
    group_rows: list[_PredRow],
    ko_rows: list[_PredRow],
) -> PlayerStatsData:
    # Accuracy / exact — group predictions only (they have score breakdowns)
    scored_group = [
        r for r in group_rows if r.points_breakdown and not r.points_breakdown.get("no_prediction")
    ]
    n_scored = len(scored_group)
    correct_outcome = sum(
        1 for r in scored_group if (r.points_breakdown or {}).get("result", 0) > 0
    )
    exact_score = sum(1 for r in scored_group if (r.points_breakdown or {}).get("exact", 0) > 0)
    accuracy_pct = (correct_outcome / n_scored * 100) if n_scored else 0.0
    exact_rate_pct = (exact_score / n_scored * 100) if n_scored else 0.0

    # Total points and avg across all settled predictions
    all_rows = group_rows + ko_rows
    total_settled = len(all_rows)
    total_points = sum(r.points_awarded for r in all_rows)
    avg_pts = (total_points / total_settled) if total_settled else 0.0

    # Best / worst round by stage
    round_points: dict[str, int] = defaultdict(int)
    for r in all_rows:
        round_points[r.stage] += r.points_awarded

    best_round: str | None = None
    best_round_points: int | None = None
    worst_round: str | None = None
    worst_round_points: int | None = None
    if round_points:
        best_stage = max(round_points, key=lambda s: round_points[s])
        worst_stage = min(round_points, key=lambda s: round_points[s])
        best_round = best_stage
        best_round_points = round_points[best_stage]
        worst_round = worst_stage
        worst_round_points = round_points[worst_stage]

    # Current streak — consecutive predictions with points > 0, most-recent first
    all_sorted = sorted(all_rows, key=lambda r: r.kickoff_utc or datetime.min, reverse=True)
    current_streak = 0
    for row in all_sorted:
        if row.points_awarded > 0:
            current_streak += 1
        else:
            break

    # Prediction timing — avg minutes before kickoff
    timing_mins: list[float] = []
    for r in all_rows:
        if r.submitted_at is not None and r.kickoff_utc is not None:
            delta = (r.kickoff_utc - r.submitted_at).total_seconds() / 60
            if delta >= 0:
                timing_mins.append(delta)
    avg_timing: float | None = sum(timing_mins) / len(timing_mins) if timing_mins else None

    return PlayerStatsData(
        player_id=str(player_id),
        player_name=player_name,
        total_predictions_settled=total_settled,
        accuracy_pct=round(accuracy_pct, 1),
        exact_rate_pct=round(exact_rate_pct, 1),
        avg_pts_per_prediction=round(avg_pts, 2),
        total_points=total_points,
        best_round=best_round,
        best_round_points=best_round_points,
        worst_round=worst_round,
        worst_round_points=worst_round_points,
        current_streak=current_streak,
        avg_prediction_timing_mins=round(avg_timing, 1) if avg_timing is not None else None,
    )


async def _fetch_group_rows(
    db: AsyncSession,
    player_id: UUID | None = None,
) -> list[_PredRow]:
    stmt = (
        select(Prediction, Match)
        .join(Match, Match.id == Prediction.match_id)
        .where(
            Prediction.deleted_at.is_(None),
            Prediction.points_awarded.is_not(None),
            Match.deleted_at.is_(None),
        )
        .order_by(Match.kickoff_utc.asc())
    )
    if player_id is not None:
        stmt = stmt.where(Prediction.player_id == player_id)

    result = await db.execute(stmt)
    rows = result.all()
    return [
        _PredRow(
            player_id=pred.player_id,
            points_awarded=pred.points_awarded or 0,
            points_breakdown=pred.points_breakdown,
            submitted_at=pred.submitted_at,
            stage=match.stage.value,
            kickoff_utc=match.kickoff_utc,
        )
        for pred, match in rows
    ]


async def _fetch_ko_rows(
    db: AsyncSession,
    player_id: UUID | None = None,
) -> list[_PredRow]:
    stmt = (
        select(KnockoutPrediction, Match)
        .join(Match, Match.id == KnockoutPrediction.match_id)
        .where(
            KnockoutPrediction.points_awarded.is_not(None),
            Match.deleted_at.is_(None),
        )
        .order_by(Match.kickoff_utc.asc())
    )
    if player_id is not None:
        stmt = stmt.where(KnockoutPrediction.player_id == player_id)

    result = await db.execute(stmt)
    rows = result.all()
    return [
        _PredRow(
            player_id=pred.player_id,
            points_awarded=pred.points_awarded or 0,
            points_breakdown=None,
            submitted_at=pred.submitted_at,
            stage=match.stage.value,
            kickoff_utc=match.kickoff_utc,
        )
        for pred, match in rows
    ]


async def get_player_stats(
    player_id: UUID,
    player_name: str,
    db: AsyncSession,
) -> PlayerStatsData:
    group_rows = await _fetch_group_rows(db, player_id)
    ko_rows = await _fetch_ko_rows(db, player_id)
    return _compute_stats(player_id, player_name, group_rows, ko_rows)


async def get_league_stats(db: AsyncSession) -> list[PlayerStatsData]:
    players_result = await db.execute(
        select(Profile)
        .where(Profile.deleted_at.is_(None), Profile.is_active.is_(True))
        .order_by(Profile.display_name)
    )
    players = players_result.scalars().all()

    if not players:
        return []

    all_group = await _fetch_group_rows(db)
    all_ko = await _fetch_ko_rows(db)

    group_by_player: dict[UUID, list[_PredRow]] = defaultdict(list)
    for row in all_group:
        group_by_player[row.player_id].append(row)

    ko_by_player: dict[UUID, list[_PredRow]] = defaultdict(list)
    for row in all_ko:
        ko_by_player[row.player_id].append(row)

    return [
        _compute_stats(
            p.id,
            p.display_name,
            group_by_player.get(p.id, []),
            ko_by_player.get(p.id, []),
        )
        for p in players
    ]
