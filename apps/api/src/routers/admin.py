"""Admin endpoints: invite management, player management, standings override."""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import AdminPlayer, generate_opaque_token, hash_pin
from src.database import get_db
from src.models.group import Group
from src.models.invite import Invite
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
