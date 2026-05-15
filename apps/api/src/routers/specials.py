"""Special predictions endpoints (tournament winner, golden boot, top scoring team)."""

import uuid
from datetime import UTC, datetime
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import asc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import AdminPlayer, CurrentPlayer
from src.database import get_db
from src.models.match import Match
from src.models.notification import ActionType, ActorType, AuditLog
from src.models.prediction import SpecialPrediction, SpecialPredictionType
from src.models.profile import Profile
from src.models.team import TournamentStage

log: structlog.stdlib.BoundLogger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/specials", tags=["specials"])
admin_router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

SPECIAL_POINTS: dict[SpecialPredictionType, int] = {
    SpecialPredictionType.tournament_winner: 20,
    SpecialPredictionType.golden_boot: 15,
    SpecialPredictionType.top_scoring_team: 10,
}


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class SpecialPredictionItem(BaseModel):
    id: str
    prediction_type: str
    predicted_team_id: str | None
    predicted_player_name: str | None
    submitted_at: str | None
    points_awarded: int | None


class MySpecialsResponse(BaseModel):
    is_locked: bool
    lock_at: str | None
    predictions: list[SpecialPredictionItem]


class PutSpecialRequest(BaseModel):
    predicted_team_id: uuid.UUID | None = None
    predicted_player_name: str | None = None


class PlayerSpecialsItem(BaseModel):
    player_id: str
    player_name: str
    predictions: list[SpecialPredictionItem]


class AwardSpecialsRequest(BaseModel):
    prediction_type: SpecialPredictionType
    winner_team_id: uuid.UUID | None = None
    winner_player_name: str | None = None


class AwardSpecialsResponse(BaseModel):
    prediction_type: str
    awarded_count: int
    points_each: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_opening_match(db: AsyncSession) -> Match | None:
    result = await db.execute(
        select(Match)
        .where(Match.stage == TournamentStage.group, Match.deleted_at.is_(None))
        .order_by(asc(Match.kickoff_utc))
        .limit(1)
    )
    return result.scalar_one_or_none()


def _is_locked(opening_match: Match | None) -> bool:
    if opening_match is None:
        return False
    return _now() >= opening_match.kickoff_utc


def _to_item(pred: SpecialPrediction) -> SpecialPredictionItem:
    return SpecialPredictionItem(
        id=str(pred.id),
        prediction_type=pred.prediction_type,
        predicted_team_id=str(pred.predicted_team_id) if pred.predicted_team_id else None,
        predicted_player_name=pred.predicted_player_name,
        submitted_at=pred.submitted_at.isoformat() + "Z" if pred.submitted_at else None,
        points_awarded=pred.points_awarded,
    )


# ---------------------------------------------------------------------------
# GET /api/v1/specials
# ---------------------------------------------------------------------------


@router.get("", response_model=MySpecialsResponse)
async def get_my_specials(
    player: CurrentPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MySpecialsResponse:
    opening_match = await _get_opening_match(db)

    result = await db.execute(
        select(SpecialPrediction).where(SpecialPrediction.player_id == player.id)
    )
    preds: dict[SpecialPredictionType, SpecialPrediction] = {
        p.prediction_type: p for p in result.scalars().all()
    }

    items: list[SpecialPredictionItem] = []
    for ptype in SpecialPredictionType:
        pred = preds.get(ptype)
        if pred is not None:
            items.append(_to_item(pred))
        else:
            items.append(
                SpecialPredictionItem(
                    id="",
                    prediction_type=ptype,
                    predicted_team_id=None,
                    predicted_player_name=None,
                    submitted_at=None,
                    points_awarded=None,
                )
            )

    return MySpecialsResponse(
        is_locked=_is_locked(opening_match),
        lock_at=(
            opening_match.kickoff_utc.isoformat() + "Z" if opening_match is not None else None
        ),
        predictions=items,
    )


# ---------------------------------------------------------------------------
# PUT /api/v1/specials/{type}
# ---------------------------------------------------------------------------


@router.put("/{prediction_type}", response_model=SpecialPredictionItem)
async def upsert_special(
    prediction_type: SpecialPredictionType,
    body: PutSpecialRequest,
    player: CurrentPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SpecialPredictionItem:
    opening_match = await _get_opening_match(db)
    if _is_locked(opening_match):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="PREDICTION_LOCKED")

    # Validate payload for prediction type
    if prediction_type == SpecialPredictionType.golden_boot:
        if not body.predicted_player_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="predicted_player_name is required for golden_boot",
            )
    else:
        if body.predicted_team_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="predicted_team_id is required for this prediction type",
            )

    result = await db.execute(
        select(SpecialPrediction).where(
            SpecialPrediction.player_id == player.id,
            SpecialPrediction.prediction_type == prediction_type,
        )
    )
    pred = result.scalar_one_or_none()

    now = _now()
    if pred is None:
        pred = SpecialPrediction(
            id=uuid.uuid4(),
            player_id=player.id,
            prediction_type=prediction_type,
            predicted_team_id=body.predicted_team_id,
            predicted_player_name=body.predicted_player_name,
            submitted_at=now,
        )
        db.add(pred)
    else:
        pred.predicted_team_id = body.predicted_team_id
        pred.predicted_player_name = body.predicted_player_name

    await db.commit()
    await db.refresh(pred)
    return _to_item(pred)


# ---------------------------------------------------------------------------
# GET /api/v1/specials/all
# ---------------------------------------------------------------------------


@router.get("/all", response_model=list[PlayerSpecialsItem])
async def get_all_specials(
    player: CurrentPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PlayerSpecialsItem]:
    opening_match = await _get_opening_match(db)
    if not _is_locked(opening_match):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Special predictions are hidden until the tournament starts",
        )

    result = await db.execute(
        select(SpecialPrediction, Profile)
        .join(Profile, SpecialPrediction.player_id == Profile.id)
        .where(Profile.deleted_at.is_(None))
        .order_by(Profile.display_name)
    )
    rows = result.all()

    by_player: dict[str, PlayerSpecialsItem] = {}
    for pred, prof in rows:
        pid = str(prof.id)
        if pid not in by_player:
            by_player[pid] = PlayerSpecialsItem(
                player_id=pid,
                player_name=prof.display_name,
                predictions=[],
            )
        by_player[pid].predictions.append(_to_item(pred))

    return list(by_player.values())


# ---------------------------------------------------------------------------
# POST /api/v1/admin/specials/award
# ---------------------------------------------------------------------------


@admin_router.post("/specials/award", response_model=AwardSpecialsResponse)
async def award_specials(
    body: AwardSpecialsRequest,
    admin: AdminPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AwardSpecialsResponse:
    ptype = body.prediction_type
    points = SPECIAL_POINTS[ptype]

    # Validate award payload
    if ptype == SpecialPredictionType.golden_boot:
        if not body.winner_player_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="winner_player_name is required for golden_boot",
            )
    else:
        if body.winner_team_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="winner_team_id is required for this prediction type",
            )

    # Fetch all predictions of this type
    result = await db.execute(
        select(SpecialPrediction).where(SpecialPrediction.prediction_type == ptype)
    )
    all_preds = result.scalars().all()

    awarded_count = 0
    for pred in all_preds:
        if ptype == SpecialPredictionType.golden_boot:
            correct = (
                pred.predicted_player_name is not None
                and body.winner_player_name is not None
                and pred.predicted_player_name.strip().lower()
                == body.winner_player_name.strip().lower()
            )
        else:
            correct = pred.predicted_team_id == body.winner_team_id

        pred.points_awarded = points if correct else 0
        if correct:
            awarded_count += 1

    db.add(
        AuditLog(
            id=uuid.uuid4(),
            actor_id=admin.id,
            actor_type=ActorType.admin,
            action_type=ActionType.special_awarded,
            target_table="special_predictions",
            target_id=None,
            changes={
                "prediction_type": ptype,
                "winner_team_id": str(body.winner_team_id) if body.winner_team_id else None,
                "winner_player_name": body.winner_player_name,
                "awarded_count": awarded_count,
                "points_each": points,
            },
        )
    )

    await db.commit()
    log.info(
        "specials awarded",
        prediction_type=ptype,
        awarded_count=awarded_count,
        points_each=points,
        admin_id=str(admin.id),
    )
    return AwardSpecialsResponse(
        prediction_type=ptype,
        awarded_count=awarded_count,
        points_each=points,
    )
