"""Prediction CRUD endpoints."""

import uuid
from datetime import UTC, datetime
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import CurrentPlayer
from src.database import get_db
from src.models.match import Match, MatchStatus
from src.models.prediction import Prediction
from src.models.profile import Profile

log: structlog.stdlib.BoundLogger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/predictions", tags=["predictions"])


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class PredictionRequest(BaseModel):
    predicted_home: int
    predicted_away: int


class PredictionResponse(BaseModel):
    id: str
    player_id: str
    match_id: str
    predicted_home: int | None
    predicted_away: int | None
    submitted_at: str | None
    update_count: int
    points_awarded: int | None
    updated_at: str


class MatchPredictionItem(BaseModel):
    player_id: str
    player_name: str
    predicted_home: int | None
    predicted_away: int | None
    points_awarded: int | None


class MatchPredictionsResponse(BaseModel):
    match_id: str
    predictions: list[MatchPredictionItem]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _to_response(pred: Prediction) -> PredictionResponse:
    return PredictionResponse(
        id=str(pred.id),
        player_id=str(pred.player_id),
        match_id=str(pred.match_id),
        predicted_home=pred.predicted_home,
        predicted_away=pred.predicted_away,
        submitted_at=pred.submitted_at.isoformat() + "Z" if pred.submitted_at else None,
        update_count=pred.update_count,
        points_awarded=pred.points_awarded,
        updated_at=pred.updated_at.isoformat() + "Z",
    )


async def _get_match_or_404(match_id: uuid.UUID, db: AsyncSession) -> Match:
    result = await db.execute(select(Match).where(Match.id == match_id, Match.deleted_at.is_(None)))
    match = result.scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    return match


# ---------------------------------------------------------------------------
# PUT /api/v1/predictions/{match_id}
# ---------------------------------------------------------------------------


@router.put("/{match_id}", response_model=PredictionResponse)
async def upsert_prediction(
    match_id: uuid.UUID,
    body: PredictionRequest,
    player: CurrentPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PredictionResponse:
    match = await _get_match_or_404(match_id, db)

    if match.status != MatchStatus.scheduled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="PREDICTION_LOCKED",
        )

    result = await db.execute(
        select(Prediction).where(
            Prediction.player_id == player.id,
            Prediction.match_id == match_id,
            Prediction.deleted_at.is_(None),
        )
    )
    pred = result.scalar_one_or_none()

    now = _now()
    if pred is None:
        pred = Prediction(
            id=uuid.uuid4(),
            player_id=player.id,
            match_id=match_id,
            predicted_home=body.predicted_home,
            predicted_away=body.predicted_away,
            submitted_at=now,
            update_count=0,
        )
        db.add(pred)
    else:
        pred.predicted_home = body.predicted_home
        pred.predicted_away = body.predicted_away
        pred.update_count = pred.update_count + 1

    await db.commit()
    await db.refresh(pred)
    return _to_response(pred)


# ---------------------------------------------------------------------------
# GET /api/v1/predictions/me
# ---------------------------------------------------------------------------


@router.get("/me", response_model=list[PredictionResponse])
async def my_predictions(
    player: CurrentPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PredictionResponse]:
    result = await db.execute(
        select(Prediction).where(
            Prediction.player_id == player.id,
            Prediction.deleted_at.is_(None),
        )
    )
    preds = result.scalars().all()
    return [_to_response(p) for p in preds]


# ---------------------------------------------------------------------------
# GET /api/v1/predictions/match/{match_id}
# ---------------------------------------------------------------------------


@router.get("/match/{match_id}", response_model=MatchPredictionsResponse)
async def match_predictions(
    match_id: uuid.UUID,
    player: CurrentPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MatchPredictionsResponse:
    match = await _get_match_or_404(match_id, db)

    if match.status == MatchStatus.scheduled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Predictions are hidden until the match is locked",
        )

    result = await db.execute(
        select(Prediction, Profile)
        .join(Profile, Prediction.player_id == Profile.id)
        .where(
            Prediction.match_id == match_id,
            Prediction.deleted_at.is_(None),
            Profile.deleted_at.is_(None),
        )
    )
    rows = result.all()

    items = [
        MatchPredictionItem(
            player_id=str(pred.player_id),
            player_name=prof.display_name,
            predicted_home=pred.predicted_home,
            predicted_away=pred.predicted_away,
            points_awarded=pred.points_awarded,
        )
        for pred, prof in rows
    ]
    return MatchPredictionsResponse(match_id=str(match_id), predictions=items)


# ---------------------------------------------------------------------------
# GET /api/v1/predictions/player/{player_id}
# ---------------------------------------------------------------------------


@router.get("/player/{player_id}", response_model=list[PredictionResponse])
async def player_predictions(
    player_id: uuid.UUID,
    _requester: CurrentPlayer,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PredictionResponse]:
    # Verify target player exists
    profile_result = await db.execute(
        select(Profile).where(Profile.id == player_id, Profile.deleted_at.is_(None))
    )
    if profile_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

    # Only return predictions for matches that are no longer scheduled (post-lock)
    pred_result = await db.execute(
        select(Prediction)
        .join(Match, Prediction.match_id == Match.id)
        .where(
            Prediction.player_id == player_id,
            Prediction.deleted_at.is_(None),
            Match.status != MatchStatus.scheduled,
            Match.deleted_at.is_(None),
        )
    )
    preds = pred_result.scalars().all()
    return [_to_response(p) for p in preds]
