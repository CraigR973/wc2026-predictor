"""Player profile endpoints."""

import uuid
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import CurrentPlayer
from src.database import get_db
from src.models.league_membership import LeagueMembership
from src.models.match import Match
from src.models.prediction import Prediction
from src.models.profile import Profile
from src.models.team import Team
from src.routers.leagues import LeagueMemberDep

router = APIRouter(prefix="/api/v1/players", tags=["players"])
league_router = APIRouter(prefix="/api/v1/leagues", tags=["players"])


class PlayerProfileResponse(BaseModel):
    id: str
    display_name: str
    role: str
    timezone: str
    is_deleted: bool
    created_at: datetime


@league_router.get("/{slug}/players", response_model=list[PlayerProfileResponse])
async def list_league_players(
    ctx: LeagueMemberDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PlayerProfileResponse]:
    """Active members of one league, in join order.

    Replaces the v1 global player list. ``role`` is the per-league membership
    role and ``display_name`` honours any per-league override (MD-11).
    """
    _player, league = ctx
    rows = (
        await db.execute(
            select(Profile, LeagueMembership)
            .join(LeagueMembership, LeagueMembership.player_id == Profile.id)
            .where(
                LeagueMembership.league_id == league.id,
                LeagueMembership.deleted_at.is_(None),
                Profile.deleted_at.is_(None),
            )
            .order_by(LeagueMembership.joined_at)
        )
    ).all()
    return [
        PlayerProfileResponse(
            id=str(profile.id),
            display_name=membership.display_name_override or profile.display_name,
            role=membership.role.value,
            timezone=profile.timezone,
            is_deleted=profile.deleted_at is not None,
            created_at=profile.created_at,
        )
        for profile, membership in rows
    ]


@router.get("/{player_id}", response_model=PlayerProfileResponse)
async def get_player(
    player_id: uuid.UUID,
    _player: CurrentPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PlayerProfileResponse:
    result = await db.execute(select(Profile).where(Profile.id == player_id))
    player = result.scalar_one_or_none()
    if player is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    return _to_response(player)


def _to_response(p: Profile) -> PlayerProfileResponse:
    return PlayerProfileResponse(
        id=str(p.id),
        display_name=p.display_name,
        role=p.role.value,
        timezone=p.timezone,
        is_deleted=p.deleted_at is not None,
        created_at=p.created_at,
    )


class RecentPredictionItem(BaseModel):
    match_id: str
    stage: str
    kickoff_utc: str
    home_team_name: str | None
    away_team_name: str | None
    home_team_flag: str | None
    away_team_flag: str | None
    actual_home: int | None
    actual_away: int | None
    predicted_home: int | None
    predicted_away: int | None
    points_awarded: int | None
    points_breakdown: dict[str, Any] | None = None


@router.get("/{player_id}/predictions/recent", response_model=list[RecentPredictionItem])
async def get_recent_predictions(
    player_id: uuid.UUID,
    _player: CurrentPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=5, ge=1, le=20),
) -> list[RecentPredictionItem]:
    """Recent settled group predictions for a player, newest first."""
    result = await db.execute(
        select(Profile).where(Profile.id == player_id, Profile.deleted_at.is_(None))
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

    pred_stmt = (
        select(Prediction, Match)
        .join(Match, Match.id == Prediction.match_id)
        .where(
            Prediction.player_id == player_id,
            Prediction.deleted_at.is_(None),
            Prediction.points_awarded.is_not(None),
            Match.deleted_at.is_(None),
        )
        .order_by(Match.kickoff_utc.desc())
        .limit(limit)
    )
    pred_rows = (await db.execute(pred_stmt)).all()

    # Collect team IDs for a single batch fetch
    team_ids: set[uuid.UUID] = set()
    for _, match in pred_rows:
        if match.home_team_id is not None:
            team_ids.add(match.home_team_id)
        if match.away_team_id is not None:
            team_ids.add(match.away_team_id)

    teams: dict[str, Team] = {}
    if team_ids:
        team_result = await db.execute(select(Team).where(Team.id.in_(team_ids)))
        teams = {str(t.id): t for t in team_result.scalars().all()}

    return [
        RecentPredictionItem(
            match_id=str(match.id),
            stage=match.stage.value,
            kickoff_utc=match.kickoff_utc.isoformat() + "Z",
            home_team_name=teams[str(match.home_team_id)].name
            if match.home_team_id and str(match.home_team_id) in teams
            else match.home_team_placeholder,
            away_team_name=teams[str(match.away_team_id)].name
            if match.away_team_id and str(match.away_team_id) in teams
            else match.away_team_placeholder,
            home_team_flag=teams[str(match.home_team_id)].flag_emoji
            if match.home_team_id and str(match.home_team_id) in teams
            else None,
            away_team_flag=teams[str(match.away_team_id)].flag_emoji
            if match.away_team_id and str(match.away_team_id) in teams
            else None,
            actual_home=match.actual_home_score,
            actual_away=match.actual_away_score,
            predicted_home=pred.predicted_home,
            predicted_away=pred.predicted_away,
            points_awarded=pred.points_awarded,
            points_breakdown=pred.points_breakdown,
        )
        for pred, match in pred_rows
    ]
