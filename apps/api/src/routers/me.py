"""Cross-league endpoints scoped to the authenticated player (``/api/v1/me``)."""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import CurrentPlayer
from src.database import get_db
from src.models.league import League
from src.models.league_membership import LeagueMembership
from src.models.prediction import LeaderboardSnapshot
from src.rate_limit import limiter, per_player_key

log: structlog.stdlib.BoundLogger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/me", tags=["me"])

# Average rank is only meaningful across leagues with enough members to rank
# against (MD-7): a 1- or 2-person league is rank 1 by default and would game
# the average, so leagues below this size are excluded from the mean.
_MIN_MEMBERS_FOR_AVG = 3


class PerLeagueRank(BaseModel):
    slug: str
    name: str
    rank: int | None
    member_count: int


class CrossLeagueSummaryResponse(BaseModel):
    avg_rank: float | None
    total_points: int
    leagues_count: int
    per_league: list[PerLeagueRank]


@router.get("/cross-league-summary", response_model=CrossLeagueSummaryResponse)
@limiter.limit("120/minute", key_func=per_player_key)
async def cross_league_summary(
    request: Request,
    player: CurrentPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CrossLeagueSummaryResponse:
    """Average rank across the caller's leagues, with a per-league breakdown.

    Three fixed queries (no N+1 over leagues): the caller's memberships, the
    member count per league, and the caller's latest snapshot per league. Rank
    is read from the stored per-league snapshot rank (MD-13); the average only
    spans leagues with >= ``_MIN_MEMBERS_FOR_AVG`` members.
    """
    membership_rows = (
        await db.execute(
            select(League.id, League.slug, League.name)
            .join(LeagueMembership, LeagueMembership.league_id == League.id)
            .where(
                LeagueMembership.player_id == player.id,
                LeagueMembership.deleted_at.is_(None),
                League.deleted_at.is_(None),
            )
            .order_by(League.name)
        )
    ).all()

    if not membership_rows:
        return CrossLeagueSummaryResponse(
            avg_rank=None, total_points=0, leagues_count=0, per_league=[]
        )

    league_ids = [row.id for row in membership_rows]

    count_rows = (
        await db.execute(
            select(LeagueMembership.league_id, func.count().label("member_count"))
            .where(
                LeagueMembership.league_id.in_(league_ids),
                LeagueMembership.deleted_at.is_(None),
            )
            .group_by(LeagueMembership.league_id)
        )
    ).all()
    member_counts = {row.league_id: row.member_count for row in count_rows}

    # Caller's latest snapshot per league — one row each via DISTINCT ON, with
    # the same (snapshot_at DESC, id DESC) tie-break the leaderboard uses.
    snapshot_rows = (
        await db.execute(
            select(
                LeaderboardSnapshot.league_id,
                LeaderboardSnapshot.rank,
                LeaderboardSnapshot.total_points,
            )
            .where(
                LeaderboardSnapshot.player_id == player.id,
                LeaderboardSnapshot.league_id.in_(league_ids),
            )
            .distinct(LeaderboardSnapshot.league_id)
            .order_by(
                LeaderboardSnapshot.league_id,
                LeaderboardSnapshot.snapshot_at.desc(),
                LeaderboardSnapshot.id.desc(),
            )
        )
    ).all()
    ranks = {row.league_id: row.rank for row in snapshot_rows}
    # total_points is global per player (predictions are global), so any
    # league's snapshot carries the same value; 0 before any result lands.
    total_points = max((row.total_points for row in snapshot_rows), default=0)

    per_league: list[PerLeagueRank] = []
    ranks_for_avg: list[int] = []
    for row in membership_rows:
        member_count = member_counts.get(row.id, 0)
        rank = ranks.get(row.id)
        per_league.append(
            PerLeagueRank(slug=row.slug, name=row.name, rank=rank, member_count=member_count)
        )
        if rank is not None and member_count >= _MIN_MEMBERS_FOR_AVG:
            ranks_for_avg.append(rank)

    avg_rank = round(sum(ranks_for_avg) / len(ranks_for_avg), 2) if ranks_for_avg else None

    return CrossLeagueSummaryResponse(
        avg_rank=avg_rank,
        total_points=total_points,
        leagues_count=len(membership_rows),
        per_league=per_league,
    )
