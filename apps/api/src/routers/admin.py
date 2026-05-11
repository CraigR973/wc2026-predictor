"""Admin endpoints: invite management, player management, standings override, result entry."""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import AdminPlayer, generate_opaque_token, hash_pin
from src.database import get_db
from src.models.group import Group
from src.models.invite import Invite
from src.models.match import Match, MatchStatus, ResultSource
from src.models.notification import ActionType, ActorType, AuditLog
from src.models.profile import Profile

log: structlog.stdlib.BoundLogger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CreateInviteRequest(BaseModel):
    display_name_hint: str | None = None
    expires_in_days: int | None = 7


class InviteResponse(BaseModel):
    id: str
    token: str
    display_name_hint: str | None
    created_by: str
    claimed_by: str | None
    claimed_at: datetime | None
    expires_at: datetime | None
    is_active: bool
    created_at: datetime


class ResetPinResponse(BaseModel):
    temp_pin: str


class OverrideStandingsRequest(BaseModel):
    positions: list[str]  # ordered list of team codes, position 1 first


class AdminPlayerResponse(BaseModel):
    id: str
    display_name: str
    role: str
    timezone: str
    is_deleted: bool
    created_at: datetime


class ResultRequest(BaseModel):
    actual_home_score: int = Field(ge=0)
    actual_away_score: int = Field(ge=0)
    extra_time: bool = False
    penalties: bool = False
    penalty_winner_id: str | None = None  # UUID string for the winning team


class ResultResponse(BaseModel):
    match_id: str
    actual_home_score: int
    actual_away_score: int
    extra_time: bool
    penalties: bool
    penalty_winner_id: str | None
    result_source: str
    result_entered_at: datetime | None
    result_entered_by: str | None
    status: str


_VALID_RESULT_STATUSES = {MatchStatus.locked, MatchStatus.live, MatchStatus.completed}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/players", response_model=list[AdminPlayerResponse])
async def list_all_players(
    admin: AdminPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
    include_deleted: bool = False,
) -> list[AdminPlayerResponse]:
    query = select(Profile)
    if not include_deleted:
        query = query.where(Profile.deleted_at.is_(None))
    query = query.order_by(Profile.created_at)
    result = await db.execute(query)
    players = result.scalars().all()
    return [
        AdminPlayerResponse(
            id=str(p.id),
            display_name=p.display_name,
            role=p.role.value,
            timezone=p.timezone,
            is_deleted=p.deleted_at is not None,
            created_at=p.created_at,
        )
        for p in players
    ]


@router.post("/invites", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    body: CreateInviteRequest,
    admin: AdminPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InviteResponse:
    expires_at = None
    if body.expires_in_days is not None:
        expires_at = _now() + timedelta(days=body.expires_in_days)

    invite = Invite(
        token=generate_opaque_token(),
        display_name_hint=body.display_name_hint,
        created_by=admin.id,
        expires_at=expires_at,
        is_active=True,
        created_at=_now(),
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    log.info("invite created", invite_id=str(invite.id), admin_id=str(admin.id))
    return _to_response(invite)


@router.get("/invites", response_model=list[InviteResponse])
async def list_invites(
    admin: AdminPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[InviteResponse]:
    result = await db.execute(select(Invite).order_by(Invite.created_at.desc()))
    invites = result.scalars().all()
    return [_to_response(i) for i in invites]


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invite(
    invite_id: uuid.UUID,
    admin: AdminPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    result = await db.execute(select(Invite).where(Invite.id == invite_id))
    invite = result.scalar_one_or_none()
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    invite.is_active = False
    await db.commit()
    log.info("invite revoked", invite_id=str(invite_id), admin_id=str(admin.id))


@router.post(
    "/players/{player_id}/reset-pin",
    response_model=ResetPinResponse,
    status_code=status.HTTP_200_OK,
)
async def reset_player_pin(
    player_id: uuid.UUID,
    admin: AdminPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResetPinResponse:
    result = await db.execute(
        select(Profile).where(Profile.id == player_id, Profile.deleted_at.is_(None))
    )
    player = result.scalar_one_or_none()
    if player is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

    temp_pin = f"{secrets.randbelow(1000000):06d}"
    player.pin_hash = hash_pin(temp_pin)
    await db.commit()

    log.info("pin reset by admin", player_id=str(player_id), admin_id=str(admin.id))
    return ResetPinResponse(temp_pin=temp_pin)


@router.post("/groups/{name}/override-standings", status_code=status.HTTP_204_NO_CONTENT)
async def override_standings(
    name: str,
    body: OverrideStandingsRequest,
    admin: AdminPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    result = await db.execute(select(Group).where(Group.name == name.upper()))
    group = result.scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    group.standings_override = body.positions
    await db.commit()
    log.info("standings override set", group=name.upper(), positions=body.positions)


@router.delete("/players/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_player(
    player_id: uuid.UUID,
    admin: AdminPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    result = await db.execute(
        select(Profile).where(Profile.id == player_id, Profile.deleted_at.is_(None))
    )
    player = result.scalar_one_or_none()
    if player is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

    player.deleted_at = _now()
    await db.commit()
    log.info("player soft-deleted", player_id=str(player_id), admin_id=str(admin.id))


# ---------------------------------------------------------------------------
# Results endpoints (5.1)
# ---------------------------------------------------------------------------


@router.post(
    "/results/{match_id}",
    response_model=ResultResponse,
    status_code=status.HTTP_200_OK,
)
async def enter_result(
    match_id: uuid.UUID,
    body: ResultRequest,
    admin: AdminPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResultResponse:
    """Manual result entry — used when auto-fetch has not populated the result."""
    result = await db.execute(select(Match).where(Match.id == match_id, Match.deleted_at.is_(None)))
    match = result.scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    if match.status not in _VALID_RESULT_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot enter result for a match with status '{match.status}'",
        )

    if match.result_source is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Match already has a result. Use PUT /admin/results/{match_id} to override.",
        )

    penalty_winner_id = uuid.UUID(body.penalty_winner_id) if body.penalty_winner_id else None

    before: dict[str, object] = {
        "actual_home_score": match.actual_home_score,
        "actual_away_score": match.actual_away_score,
        "result_source": None,
    }

    match.actual_home_score = body.actual_home_score
    match.actual_away_score = body.actual_away_score
    match.extra_time = body.extra_time
    match.penalties = body.penalties
    match.penalty_winner_id = penalty_winner_id
    match.result_source = ResultSource.manual
    match.result_entered_by = admin.id
    match.status = MatchStatus.completed
    # result_entered_at is stamped atomically by the BEFORE trigger

    db.add(
        AuditLog(
            actor_id=admin.id,
            actor_type=ActorType.admin,
            action_type=ActionType.result_manual_entered,
            target_table="matches",
            target_id=match_id,
            changes={
                "before": before,
                "after": {
                    "actual_home_score": body.actual_home_score,
                    "actual_away_score": body.actual_away_score,
                    "result_source": ResultSource.manual.value,
                },
            },
        )
    )

    await db.commit()
    await db.refresh(match)

    log.info("result entered manually", match_id=str(match_id), admin_id=str(admin.id))
    return _to_result_response(match)


@router.put(
    "/results/{match_id}",
    response_model=ResultResponse,
    status_code=status.HTTP_200_OK,
)
async def override_result(
    match_id: uuid.UUID,
    body: ResultRequest,
    admin: AdminPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResultResponse:
    """Override an existing result and trigger a full points recalculation."""
    result = await db.execute(select(Match).where(Match.id == match_id, Match.deleted_at.is_(None)))
    match = result.scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    if match.status not in _VALID_RESULT_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot override result for a match with status '{match.status}'",
        )

    if match.result_source is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Match has no prior result. Use POST /admin/results/{match_id} to enter one.",
        )

    before: dict[str, object] = {
        "actual_home_score": match.actual_home_score,
        "actual_away_score": match.actual_away_score,
        "result_source": match.result_source.value,
    }

    penalty_winner_id = uuid.UUID(body.penalty_winner_id) if body.penalty_winner_id else None

    # Step 1: null out scores so the trigger's WHEN condition (NULL → not-NULL) fires in step 2.
    match.actual_home_score = None
    match.actual_away_score = None
    await db.flush()

    # Step 2: set new scores — BEFORE trigger stamps result_entered_at, AFTER trigger rescores.
    match.actual_home_score = body.actual_home_score
    match.actual_away_score = body.actual_away_score
    match.extra_time = body.extra_time
    match.penalties = body.penalties
    match.penalty_winner_id = penalty_winner_id
    match.result_source = ResultSource.override
    match.result_entered_by = admin.id
    match.status = MatchStatus.completed

    db.add(
        AuditLog(
            actor_id=admin.id,
            actor_type=ActorType.admin,
            action_type=ActionType.result_overridden,
            target_table="matches",
            target_id=match_id,
            changes={
                "before": before,
                "after": {
                    "actual_home_score": body.actual_home_score,
                    "actual_away_score": body.actual_away_score,
                    "result_source": ResultSource.override.value,
                },
            },
        )
    )

    await db.commit()
    await db.refresh(match)

    log.info("result overridden", match_id=str(match_id), admin_id=str(admin.id))
    return _to_result_response(match)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _to_response(invite: Invite) -> InviteResponse:
    return InviteResponse(
        id=str(invite.id),
        token=invite.token,
        display_name_hint=invite.display_name_hint,
        created_by=str(invite.created_by),
        claimed_by=str(invite.claimed_by) if invite.claimed_by else None,
        claimed_at=invite.claimed_at,
        expires_at=invite.expires_at,
        is_active=invite.is_active,
        created_at=invite.created_at,
    )


def _to_result_response(match: Match) -> ResultResponse:
    return ResultResponse(
        match_id=str(match.id),
        actual_home_score=match.actual_home_score if match.actual_home_score is not None else 0,
        actual_away_score=match.actual_away_score if match.actual_away_score is not None else 0,
        extra_time=match.extra_time,
        penalties=match.penalties,
        penalty_winner_id=str(match.penalty_winner_id) if match.penalty_winner_id else None,
        result_source=match.result_source.value if match.result_source else "manual",
        result_entered_at=match.result_entered_at,
        result_entered_by=str(match.result_entered_by) if match.result_entered_by else None,
        status=match.status.value,
    )
