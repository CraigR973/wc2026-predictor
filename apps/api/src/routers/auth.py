"""Auth endpoints: signup, login, refresh, logout, verify-email, PIN reset, me, pin change."""

import uuid
from datetime import UTC, datetime
from typing import Annotated

import bcrypt as _bcrypt
import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import (
    LOCKOUT_DURATION,
    MAX_FAILED_ATTEMPTS,
    REFRESH_TTL,
    CurrentPlayer,
    create_access_token,
    create_email_verify_token,
    create_pin_reset_token,
    create_refresh_token,
    decode_email_verify_token,
    decode_pin_reset_token,
    decode_refresh_token,
    hash_pin,
    hash_token,
    verify_pin,
)
from src.config import settings
from src.database import get_db
from src.models.invite import Invite
from src.models.league_membership import LeagueMemberRole, LeagueMembership
from src.models.prediction import NotificationPreferences
from src.models.profile import PlayerRole, Profile
from src.models.refresh_token import RefreshToken
from src.rate_limit import limiter, login_key, per_player_key, refresh_token_key
from src.services.email import send_pin_reset_email, send_verification_email
from src.services.notification_triggers import notify_invite_accepted

log: structlog.stdlib.BoundLogger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# Pre-computed dummy hash for constant-time login response when player not found.
_DUMMY_HASH: str = _bcrypt.hashpw(b"dummy-timing-guard", _bcrypt.gensalt()).decode()


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class SignupRequest(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    pin: str = Field(pattern=r"^\d{4,8}$")
    timezone: str = "UTC"


class LoginRequest(BaseModel):
    email: str
    pin: str = Field(pattern=r"^\d{4,8}$")


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


class JoinRequest(BaseModel):
    token: str
    display_name: str = Field(min_length=2, max_length=30, pattern=r"^[\w\s'\-]+$")
    pin: str = Field(pattern=r"^\d{4,8}$")
    timezone: str = "UTC"


class ChangePinRequest(BaseModel):
    current_pin: str = Field(pattern=r"^\d{4,8}$")
    new_pin: str = Field(pattern=r"^\d{4,8}$")


class VerifyEmailRequest(BaseModel):
    token: str


class PinResetRequestBody(BaseModel):
    email: str


class PinResetConfirm(BaseModel):
    token: str
    new_pin: str = Field(pattern=r"^\d{4,8}$")


MAX_PLAYERS = 15

_PIN_RESET_GENERIC = {
    "message": "If that email is registered and verified, you'll receive a reset link shortly."
}


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
# Endpoints — signup / email verification / PIN reset
# ---------------------------------------------------------------------------


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def signup(
    request: Request,
    body: SignupRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    result = await db.execute(
        select(Profile).where(
            func.lower(Profile.email) == body.email.lower(),
            Profile.deleted_at.is_(None),
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    first = body.first_name.strip()
    last = body.last_name.strip()
    display_name = f"{first} {last[0].upper()}."
    player_email: str = body.email.lower()  # narrow to str for type safety

    new_player = Profile(
        id=uuid.uuid4(),
        display_name=display_name,
        email=player_email,
        first_name=first,
        last_name=last,
        pin_hash=hash_pin(body.pin),
        role=PlayerRole.player,
        timezone=body.timezone,
        failed_login_count=0,
        locked_until=None,
        deleted_at=None,
        email_verified_at=None,
    )
    db.add(new_player)
    await db.flush()

    prefs = NotificationPreferences(
        player_id=new_player.id,
        deadline_warning=True,
        match_locked=True,
        result_detected=True,
        leaderboard_shift=True,
        round_complete=True,
        match_postponed=True,
        special_results=True,
        global_mute=False,
    )
    db.add(prefs)
    await db.commit()
    await db.refresh(new_player)

    verify_token = create_email_verify_token(player_email)
    background_tasks.add_task(
        send_verification_email,
        player_email,
        verify_token,
        settings.frontend_origin,
    )

    access, refresh = await _issue_token_pair(new_player, db)
    log.info("player signed up", player_id=str(new_player.id))
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        player=PlayerInfo(
            id=str(new_player.id),
            display_name=new_player.display_name,
            role=new_player.role.value,
            timezone=new_player.timezone,
        ),
    )


@router.post("/verify-email", status_code=status.HTTP_204_NO_CONTENT)
async def verify_email(
    body: VerifyEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    payload = decode_email_verify_token(body.token)
    email: str = payload["sub"]

    result = await db.execute(
        select(Profile).where(
            func.lower(Profile.email) == email.lower(),
            Profile.deleted_at.is_(None),
        )
    )
    player = result.scalar_one_or_none()
    if player is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")

    if player.email_verified_at is None:
        player.email_verified_at = _now()
        await db.commit()
        log.info("email verified", player_id=str(player.id))


@router.post("/resend-verification", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("1/minute", key_func=per_player_key)
async def resend_verification(
    request: Request,
    player: CurrentPlayer,
    background_tasks: BackgroundTasks,
) -> None:
    if player.email and player.email_verified_at is None:
        verify_token = create_email_verify_token(player.email)
        background_tasks.add_task(
            send_verification_email,
            player.email,
            verify_token,
            settings.frontend_origin,
        )
        log.info("verification email resent", player_id=str(player.id))


@router.post("/pin/reset-request")
@limiter.limit("3/hour")
async def pin_reset_request(
    request: Request,
    body: PinResetRequestBody,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    result = await db.execute(
        select(Profile).where(
            func.lower(Profile.email) == body.email.lower(),
            Profile.deleted_at.is_(None),
        )
    )
    player = result.scalar_one_or_none()

    if player is None:
        return _PIN_RESET_GENERIC

    if player.email_verified_at is None:
        # Silently send a fresh verification email — same generic response to the caller.
        if player.email:
            verify_token = create_email_verify_token(player.email)
            background_tasks.add_task(
                send_verification_email,
                player.email,
                verify_token,
                settings.frontend_origin,
            )
        return _PIN_RESET_GENERIC

    # player was looked up by email so player.email is guaranteed non-None here
    assert player.email is not None
    reset_token = create_pin_reset_token(player.id)
    background_tasks.add_task(
        send_pin_reset_email,
        player.email,
        reset_token,
        settings.frontend_origin,
    )
    log.info("pin reset email queued", player_id=str(player.id))
    return _PIN_RESET_GENERIC


@router.post("/pin/reset", status_code=status.HTTP_204_NO_CONTENT)
async def pin_reset(
    body: PinResetConfirm,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    payload = decode_pin_reset_token(body.token)
    player_id = uuid.UUID(payload["sub"])

    result = await db.execute(
        select(Profile).where(Profile.id == player_id, Profile.deleted_at.is_(None))
    )
    player = result.scalar_one_or_none()
    if player is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")

    player.pin_hash = hash_pin(body.new_pin)
    player.failed_login_count = 0
    player.locked_until = None

    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.player_id == player_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )
    await db.commit()
    log.info("pin reset complete — all tokens revoked", player_id=str(player_id))


# ---------------------------------------------------------------------------
# Endpoints — login / refresh / logout
# ---------------------------------------------------------------------------


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/15 minutes", key_func=login_key)
async def login(
    request: Request,
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    result = await db.execute(
        select(Profile).where(
            func.lower(Profile.email) == body.email.lower(),
            Profile.deleted_at.is_(None),
        )
    )

    player = result.scalar_one_or_none()

    if player is None:
        verify_pin(body.pin, _DUMMY_HASH)
        log.info("login failed — player not found")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if player.locked_until and player.locked_until > _now():
        log.warning(
            "login blocked — account locked",
            player_id=str(player.id),
            reason="account_locked_attempt",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
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

    player.failed_login_count = 0
    player.locked_until = None
    await db.commit()
    await db.refresh(player)

    device_hint = request.headers.get("User-Agent", "")[:100]
    access, refresh = await _issue_token_pair(player, db, device_hint)

    log.info(
        "login successful",
        player_id=str(player.id),
        role=player.role.value,
    )
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
@limiter.limit("60/hour", key_func=refresh_token_key)
async def refresh(
    request: Request,
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

    token_record.revoked_at = _now()
    await db.commit()

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
        pass


# ---------------------------------------------------------------------------
# Endpoints — join (invite-based), me, pin change
# ---------------------------------------------------------------------------


@router.post("/join", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
async def join(
    request: Request,
    body: JoinRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    invite_result = await db.execute(select(Invite).where(Invite.token == body.token))
    invite = invite_result.scalar_one_or_none()

    if invite is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invite token")
    if not invite.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invite has been revoked"
        )
    if invite.claimed_by is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite already used")
    if invite.expires_at is not None and invite.expires_at < _now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite has expired")

    name_result = await db.execute(
        select(Profile).where(
            Profile.display_name == body.display_name,
            Profile.deleted_at.is_(None),
        )
    )
    if name_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Display name already taken"
        )

    count_result = await db.execute(
        select(func.count()).select_from(Profile).where(Profile.deleted_at.is_(None))
    )
    if (count_result.scalar() or 0) >= MAX_PLAYERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="League is full (max 15 players)"
        )

    new_player = Profile(
        id=uuid.uuid4(),
        display_name=body.display_name,
        pin_hash=hash_pin(body.pin),
        role=PlayerRole.player,
        timezone=body.timezone,
        failed_login_count=0,
        locked_until=None,
        deleted_at=None,
    )
    db.add(new_player)
    await db.flush()

    prefs = NotificationPreferences(
        player_id=new_player.id,
        deadline_warning=True,
        match_locked=True,
        result_detected=True,
        leaderboard_shift=True,
        round_complete=True,
        match_postponed=True,
        special_results=True,
        global_mute=False,
    )
    db.add(prefs)

    db.add(
        LeagueMembership(
            league_id=invite.league_id,
            player_id=new_player.id,
            role=LeagueMemberRole.player,
        )
    )

    invite.claimed_by = new_player.id
    invite.claimed_at = _now()
    invite.is_active = False

    await db.commit()
    await db.refresh(new_player)

    await notify_invite_accepted(db, new_player.display_name)
    await db.commit()

    access, refresh_tok = await _issue_token_pair(new_player, db)
    log.info("player joined", player_id=str(new_player.id))
    return TokenResponse(
        access_token=access,
        refresh_token=refresh_tok,
        player=PlayerInfo(
            id=str(new_player.id),
            display_name=new_player.display_name,
            role=new_player.role.value,
            timezone=new_player.timezone,
        ),
    )


@router.get("/invite/{token}")
async def preview_invite(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str | None]:
    """Public — returns display_name_hint so the join page can pre-fill the name."""
    result = await db.execute(select(Invite).where(Invite.token == token))
    invite = result.scalar_one_or_none()

    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite token")
    if not invite.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invite has been revoked"
        )
    if invite.claimed_by is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite already used")
    if invite.expires_at is not None and invite.expires_at < _now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite has expired")

    return {"display_name_hint": invite.display_name_hint}


@router.get("/me", response_model=PlayerInfo)
async def me(player: CurrentPlayer) -> PlayerInfo:
    return PlayerInfo(
        id=str(player.id),
        display_name=player.display_name,
        role=player.role.value,
        timezone=player.timezone,
    )


@router.put("/me/pin", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/hour", key_func=per_player_key)
async def change_pin(
    request: Request,
    body: ChangePinRequest,
    player: CurrentPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    if not verify_pin(body.current_pin, player.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Current PIN is incorrect"
        )
    player.pin_hash = hash_pin(body.new_pin)
    await db.commit()
    log.info("pin changed", player_id=str(player.id))
