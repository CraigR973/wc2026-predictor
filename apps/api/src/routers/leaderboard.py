"""Leaderboard endpoints — per-league overall, history, and per-round.

Data is served per-league under ``/api/v1/leagues/{slug}/leaderboard*``;
the league is resolved (and membership enforced) by the
``require_league_member`` dependency.
"""

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from src.database import get_db
from src.models.league_membership import LeagueMembership
from src.models.match import Match
from src.models.prediction import LeaderboardSnapshot, Prediction
from src.models.profile import Profile
from src.models.team import TournamentStage
from src.rate_limit import limiter, per_player_key
from src.routers.leagues import LeagueMemberDep

log: structlog.stdlib.BoundLogger = structlog.get_logger(__name__)

league_router = APIRouter(prefix="/api/v1/leagues", tags=["leaderboard"])


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
# Query helpers (per-league)
# ---------------------------------------------------------------------------


async def _leaderboard_entries(
    db: AsyncSession, league_id: uuid.UUID, *, include_inactive: bool
) -> list[LeaderboardEntryOut]:
    """Latest snapshot per player within one league.

    Postgres ``DISTINCT ON`` picks exactly one snapshot per player. Multiple
    recomputes inside one transaction (e.g. trigger + specials helper) share
    ``transaction_timestamp()``, so ``snapshot_at`` ties are real; the
    secondary ``id DESC`` sort breaks them deterministically. ``league_id``
    is already filtered, so ``player_id`` alone keys the DISTINCT ON.
    """
    latest_per_player = (
        select(LeaderboardSnapshot)
        .where(LeaderboardSnapshot.league_id == league_id)
        .distinct(LeaderboardSnapshot.player_id)
        .order_by(
            LeaderboardSnapshot.player_id,
            LeaderboardSnapshot.snapshot_at.desc(),
            LeaderboardSnapshot.id.desc(),
        )
        .subquery()
    )
    latest_snap = aliased(LeaderboardSnapshot, latest_per_player)

    stmt = (
        select(Profile, latest_snap)
        .join(latest_snap, latest_snap.player_id == Profile.id)
        .where(Profile.deleted_at.is_(None))
    )
    if not include_inactive:
        stmt = stmt.where(Profile.is_active.is_(True))
    stmt = stmt.order_by(latest_snap.rank.asc(), Profile.display_name.asc())

    rows = (await db.execute(stmt)).all()
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


async def _leaderboard_history(
    db: AsyncSession, league_id: uuid.UUID, *, include_inactive: bool
) -> list[HistoryEntryOut]:
    stmt = (
        select(Profile, LeaderboardSnapshot)
        .join(LeaderboardSnapshot, LeaderboardSnapshot.player_id == Profile.id)
        .where(Profile.deleted_at.is_(None))
        .where(LeaderboardSnapshot.league_id == league_id)
        .order_by(LeaderboardSnapshot.snapshot_at.asc(), Profile.display_name.asc())
    )
    if not include_inactive:
        stmt = stmt.where(Profile.is_active.is_(True))

    rows = (await db.execute(stmt)).all()

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


async def _round_leaderboard(
    db: AsyncSession,
    league_id: uuid.UUID,
    stage: TournamentStage,
    *,
    include_inactive: bool,
) -> list[RoundEntryOut]:
    """Points earned in one tournament stage, scoped to league members.

    Predictions are global, but the leaderboard only ranks this league's
    members — so the player set is constrained to active memberships.
    """
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
        select(Profile, func.coalesce(points_subq.c.points, 0).label("points"))
        .join(
            LeagueMembership,
            (LeagueMembership.player_id == Profile.id)
            & (LeagueMembership.league_id == league_id)
            & (LeagueMembership.deleted_at.is_(None)),
        )
        .outerjoin(points_subq, points_subq.c.player_id == Profile.id)
        .where(Profile.deleted_at.is_(None))
    )
    if not include_inactive:
        stmt = stmt.where(Profile.is_active.is_(True))

    rows = (await db.execute(stmt)).all()
    sorted_rows = sorted(rows, key=lambda r: (-r.points, r.Profile.display_name))

    return [
        RoundEntryOut(
            rank=rank_idx,
            player_id=str(row.Profile.id),
            player_name=row.Profile.display_name,
            points=row.points,
        )
        for rank_idx, row in enumerate(sorted_rows, start=1)
    ]


# ---------------------------------------------------------------------------
# GET /api/v1/leagues/{slug}/leaderboard
# ---------------------------------------------------------------------------


@league_router.get("/{slug}/leaderboard", response_model=list[LeaderboardEntryOut])
@limiter.limit("120/minute", key_func=per_player_key)
async def get_league_leaderboard(
    request: Request,
    ctx: LeagueMemberDep,
    db: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: bool = Query(default=False),
) -> list[LeaderboardEntryOut]:
    _player, league = ctx
    return await _leaderboard_entries(db, league.id, include_inactive=include_inactive)


@league_router.get("/{slug}/leaderboard/history", response_model=list[HistoryEntryOut])
async def get_league_leaderboard_history(
    ctx: LeagueMemberDep,
    db: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: bool = Query(default=False),
) -> list[HistoryEntryOut]:
    _player, league = ctx
    return await _leaderboard_history(db, league.id, include_inactive=include_inactive)


@league_router.get("/{slug}/leaderboard/round/{stage}", response_model=list[RoundEntryOut])
async def get_league_round_leaderboard(
    stage: TournamentStage,
    ctx: LeagueMemberDep,
    db: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: bool = Query(default=False),
) -> list[RoundEntryOut]:
    _player, league = ctx
    return await _round_leaderboard(db, league.id, stage, include_inactive=include_inactive)

