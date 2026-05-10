"""Player profile endpoints."""

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import CurrentPlayer
from src.database import get_db
from src.models.profile import Profile

router = APIRouter(prefix="/api/v1/players", tags=["players"])


class PlayerProfileResponse(BaseModel):
    id: str
    display_name: str
    role: str
    timezone: str
    is_deleted: bool
    created_at: datetime


@router.get("", response_model=list[PlayerProfileResponse])
async def list_players(
    _player: CurrentPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PlayerProfileResponse]:
    result = await db.execute(
        select(Profile).where(Profile.deleted_at.is_(None)).order_by(Profile.created_at)
    )
    players = result.scalars().all()
    return [_to_response(p) for p in players]


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
