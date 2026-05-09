"""Auth endpoints: login, refresh, logout."""

import uuid
from datetime import UTC, datetime
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import (
    LOCKOUT_DURATION,
    MAX_FAILED_ATTEMPTS,
    REFRESH_TTL,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_token,
    verify_pin,
)
from src.database import get_db
from src.models.profile import Profile
from src.models.refresh_token import RefreshToken

log: structlog.stdlib.BoundLogger = structlog.get_logger(__name__)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    display_name: str
    pin: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    player: "PlayerInfo"


class PlayerInfo(BaseModel):
    id: str
    display_name: str
    role: str
    timezone: str


class RefreshRequest(BaseModel):
    refresh_token: str


class AccessTokenResponse(BaseModel):
    access_token: str
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _issue_token_pair(
    player: Profile,
    db: AsyncSession,
    device_hint: str | None = None,
) -> tuple[str, str]:
    """Create a new refresh token record and return (access_token, refresh_token).

    Scheme: refresh token is a JWT (contains jti=record_id). We store sha256(jwt) in the DB.
    On refresh: hash the incoming JWT → look up by (id=jti, hash=hash, not revoked).
    JWT signature ensures authenticity; the hash gives O(1) DB lookup without exposing the token.
    """
    record_id = uuid.uuid4()
    # Build the JWT first so we can hash it for storage
    refresh_jwt = create_refresh_token(player.id, record_id)

    token_record = RefreshToken(
        id=record_id,
        player_id=player.id,
        token_hash=hash_token(refresh_jwt),
        device_hint=device_hint,
        expires_at=_now() + REFRESH_TTL,
    )
    db.add(token_record)
    await db.commit()

    access = create_access_token(player.id, player.role)
    return access, refresh_jwt


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    result = await db.execute(
        select(Profile).where(
            Profile.display_name == body.display_name,
            Profile.deleted_at.is_(None),
        )
    )
    player = result.scalar_one_or_none()

    if player is None:
        # Constant-time response to avoid enumeration
        log.info("login failed — player not found", display_name=body.display_name)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Lockout check
    if player.locked_until and player.locked_until > _now():
        log.warning("login blocked — account locked", player_id=str(player.id))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account temporarily locked — try again later",
        )

    if not verify_pin(body.pin, player.pin_hash):
        player.failed_login_count += 1
        if player.failed_login_count >= MAX_FAILED_ATTEMPTS:
            player.locked_until = _now() + LOCKOUT_DURATION
            log.warning(
                "account locked after failed attempts",
                player_id=str(player.id),
                count=player.failed_login_count,
            )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Successful login — reset lockout state
    player.failed_login_count = 0
    player.locked_until = None
    await db.commit()
    await db.refresh(player)

    device_hint = request.headers.get("User-Agent", "")[:100]
    access, refresh = await _issue_token_pair(player, db, device_hint)

    log.info("login successful", player_id=str(player.id), role=player.role.value)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        player=PlayerInfo(
            id=str(player.id),
            display_name=player.display_name,
            role=player.role.value,
            timezone=player.timezone,
        ),
    )


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AccessTokenResponse:
    payload = decode_refresh_token(body.refresh_token)
    jti = uuid.UUID(payload["jti"])
    player_id = uuid.UUID(payload["sub"])

    token_hash = hash_token(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.id == jti,
            RefreshToken.player_id == player_id,
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
    )
    token_record = result.scalar_one_or_none()
    if token_record is None or token_record.expires_at < _now():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    # Revoke the old record (rotation)
    token_record.revoked_at = _now()
    await db.commit()

    # Fetch player
    player_result = await db.execute(
        select(Profile).where(Profile.id == player_id, Profile.deleted_at.is_(None))
    )
    player = player_result.scalar_one_or_none()
    if player is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Player not found")

    device_hint = token_record.device_hint
    access, new_refresh = await _issue_token_pair(player, db, device_hint)

    log.info("tokens refreshed", player_id=str(player_id))
    return AccessTokenResponse(access_token=access, refresh_token=new_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: LogoutRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    try:
        payload = decode_refresh_token(body.refresh_token)
        jti = uuid.UUID(payload["jti"])
        token_hash = hash_token(body.refresh_token)
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.id == jti,
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
            )
        )
        token_record = result.scalar_one_or_none()
        if token_record:
            token_record.revoked_at = _now()
            await db.commit()
            log.info("logout — token revoked", jti=str(jti))
    except Exception:
        # Logout is always successful to the client
        pass
