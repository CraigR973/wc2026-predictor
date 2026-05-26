"""Leaderboard endpoints — overall, history, and per-round."""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from src.auth import CurrentPlayer
from src.database import get_db
from src.models.match import Match
from src.models.prediction import LeaderboardSnapshot, Prediction
from src.models.profile import Profile
from src.models.team import TournamentStage
from src.rate_limit import limiter, per_player_key

log: structlog.stdlib.BoundLogger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class LeaderboardEntryOut(BaseModel):
    rank: int
    player_id: str
    player_name: str
    total_points: int
    match_points: int
    knockout_winner_points: int
    special_points: int
    is_active: bool


class SnapshotPoint(BaseModel):
    snapshot_at: str
    total_points: int
    rank: int


class HistoryEntryOut(BaseModel):
    player_id: str
    player_name: str
    snapshots: list[SnapshotPoint]


class RoundEntryOut(BaseModel):
    rank: int
    player_id: str
    player_name: str
    points: int


# ---------------------------------------------------------------------------
# GET /api/v1/leaderboard
# ---------------------------------------------------------------------------


@router.get("", response_model=list[LeaderboardEntryOut])
@limiter.limit("120/minute", key_func=per_player_key)
async def get_leaderboard(
    request: Request,
    _player: CurrentPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: bool = Query(default=False),
) -> list[LeaderboardEntryOut]:
    """Current leaderboard from the latest snapshot per player.

    Uses Postgres ``DISTINCT ON`` to pick exactly one snapshot per player.
    Multiple recomputes inside one transaction (e.g. trigger + specials
    helper) share ``transaction_timestamp()``, so ``snapshot_at`` ties
    are real; the secondary ``id DESC`` sort breaks them deterministically.
    """

    latest_per_player = (
        select(LeaderboardSnapshot)
        .distinct(LeaderboardSnapshot.player_id)
        .order_by(
            LeaderboardSnapshot.player_id,
            LeaderboardSnapshot.snapshot_at.desc(),
            LeaderboardSnapshot.id.desc(),
        )
        .subquery()
    )
    LatestSnap = aliased(LeaderboardSnapshot, latest_per_player)

    stmt = (
        select(Profile, LatestSnap)
        .join(LatestSnap, LatestSnap.player_id == Profile.id)
        .where(Profile.deleted_at.is_(None))
    )

    if not include_inactive:
        stmt = stmt.where(Profile.is_active.is_(True))

    stmt = stmt.order_by(LatestSnap.rank.asc(), Profile.display_name.asc())

    result = await db.execute(stmt)
    rows = result.all()

    return [
        LeaderboardEntryOut(
            rank=snapshot.rank,
            player_id=str(profile.id),
            player_name=profile.display_name,
            total_points=snapshot.total_points,
            match_points=snapshot.match_points,
            knockout_winner_points=snapshot.knockout_winner_points,
            special_points=snapshot.special_points,
            is_active=profile.is_active,
        )
        for profile, snapshot in rows
    ]


# ---------------------------------------------------------------------------
# GET /api/v1/leaderboard/history
# ---------------------------------------------------------------------------


@router.get("/history", response_model=list[HistoryEntryOut])
async def get_leaderboard_history(
    _player: CurrentPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: bool = Query(default=False),
) -> list[HistoryEntryOut]:
    """All leaderboard snapshots per player, ordered by snapshot time."""

    stmt = (
        select(Profile, LeaderboardSnapshot)
        .join(LeaderboardSnapshot, LeaderboardSnapshot.player_id == Profile.id)
        .where(Profile.deleted_at.is_(None))
        .order_by(LeaderboardSnapshot.snapshot_at.asc(), Profile.display_name.asc())
    )

    if not include_inactive:
        stmt = stmt.where(Profile.is_active.is_(True))

    result = await db.execute(stmt)
    rows = result.all()

    # Group by player
    players: dict[str, HistoryEntryOut] = {}
    for profile, snapshot in rows:
        pid = str(profile.id)
        if pid not in players:
            players[pid] = HistoryEntryOut(
                player_id=pid,
                player_name=profile.display_name,
                snapshots=[],
            )
        players[pid].snapshots.append(
            SnapshotPoint(
                snapshot_at=snapshot.snapshot_at.isoformat() + "Z",
                total_points=snapshot.total_points,
                rank=snapshot.rank,
            )
        )

    return list(players.values())


# ---------------------------------------------------------------------------
# GET /api/v1/leaderboard/round/{stage}
# ---------------------------------------------------------------------------


@router.get("/round/{stage}", response_model=list[RoundEntryOut])
async def get_round_leaderboard(
    stage: TournamentStage,
    _player: CurrentPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: bool = Query(default=False),
) -> list[RoundEntryOut]:
    """Points earned in a specific tournament stage only."""

    # Subquery: sum points per player for this stage only
    points_subq = (
        select(
            Prediction.player_id,
            func.coalesce(func.sum(Prediction.points_awarded), 0).label("points"),
        )
        .join(Match, Match.id == Prediction.match_id)
        .where(
            Match.stage == stage,
            Match.deleted_at.is_(None),
            Prediction.deleted_at.is_(None),
        )
        .group_by(Prediction.player_id)
        .subquery()
    )

    stmt = (
        select(
            Profile,
            func.coalesce(points_subq.c.points, 0).label("points"),
        )
        .outerjoin(points_subq, points_subq.c.player_id == Profile.id)
        .where(Profile.deleted_at.is_(None))
    )

    if not include_inactive:
        stmt = stmt.where(Profile.is_active.is_(True))

    result = await db.execute(stmt)
    rows = result.all()

    # Sort by points descending, name ascending for ties
    sorted_rows = sorted(rows, key=lambda r: (-r.points, r.Profile.display_name))

    entries: list[RoundEntryOut] = []
    for rank_idx, row in enumerate(sorted_rows, start=1):
        entries.append(
            RoundEntryOut(
                rank=rank_idx,
                player_id=str(row.Profile.id),
                player_name=row.Profile.display_name,
                points=row.points,
            )
        )
    return entries
