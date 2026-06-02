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
from src.deps import shared_league_player_ids
from src.models.match import Match
from src.models.notification import ActionType, ActorType, AuditLog
from src.models.prediction import SpecialPrediction, SpecialPredictionType
from src.models.profile import Profile
from src.models.squad import SquadPlayer
from src.models.team import TournamentStage
from src.services.leaderboard import recompute_leaderboard_snapshot
from src.services.notification_triggers import notify_special_results_awarded

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
    predicted_player_id: str | None
    submitted_at: str | None
    points_awarded: int | None


class MySpecialsResponse(BaseModel):
    is_locked: bool
    lock_at: str | None
    predictions: list[SpecialPredictionItem]


class PutSpecialRequest(BaseModel):
    predicted_team_id: uuid.UUID | None = None
    # Golden Boot: provide either the squad player id (preferred) or a raw name
    predicted_player_id: uuid.UUID | None = None
    predicted_player_name: str | None = None


class PlayerSpecialsItem(BaseModel):
    player_id: str
    player_name: str
    predictions: list[SpecialPredictionItem]


class AwardSpecialsRequest(BaseModel):
    prediction_type: SpecialPredictionType
    winner_team_id: uuid.UUID | None = None
    # Golden Boot award: use squad player id
    winner_player_id: uuid.UUID | None = None


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
        predicted_player_id=str(pred.predicted_player_id) if pred.predicted_player_id else None,
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
                    predicted_player_id=None,
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
        if body.predicted_player_id is None and not body.predicted_player_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="predicted_player_id is required for golden_boot",
            )
    else:
        if body.predicted_team_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="predicted_team_id is required for this prediction type",
            )

    # Resolve player name from squad when an id is supplied (U14.4)
    resolved_player_name = body.predicted_player_name
    if prediction_type == SpecialPredictionType.golden_boot and body.predicted_player_id:
        sp_result = await db.execute(
            select(SquadPlayer).where(SquadPlayer.id == body.predicted_player_id)
        )
        squad_player = sp_result.scalar_one_or_none()
        if squad_player is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="predicted_player_id not found in squad",
            )
        resolved_player_name = squad_player.full_name

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
            predicted_player_id=body.predicted_player_id,
            predicted_player_name=resolved_player_name,
            submitted_at=now,
        )
        db.add(pred)
    else:
        pred.predicted_team_id = body.predicted_team_id
        pred.predicted_player_id = body.predicted_player_id
        pred.predicted_player_name = resolved_player_name

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

    shared = await shared_league_player_ids(player.id, db)
    by_player: dict[str, PlayerSpecialsItem] = {}
    for pred, prof in rows:
        if prof.id not in shared:
            continue
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
        if body.winner_player_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="winner_player_id is required for golden_boot",
            )
        # Verify the winner player exists
        sp_result = await db.execute(
            select(SquadPlayer).where(SquadPlayer.id == body.winner_player_id)
        )
        winner_player = sp_result.scalar_one_or_none()
        if winner_player is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="winner_player_id not found in squad",
            )
    else:
        if body.winner_team_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="winner_team_id is required for this prediction type",
            )

    # Fetch all predictions of this type, storing winner_player_id on each
    result = await db.execute(
        select(SpecialPrediction).where(SpecialPrediction.prediction_type == ptype)
    )
    all_preds = result.scalars().all()

    awarded_count = 0
    for pred in all_preds:
        if ptype == SpecialPredictionType.golden_boot:
            # Id-based match (U14.5): compare predicted_player_id
            correct = (
                pred.predicted_player_id is not None
                and pred.predicted_player_id == body.winner_player_id
            )
            # Stamp the winning player id on every prediction row for auditability
            pred.winner_player_id = body.winner_player_id
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
                "winner_player_id": str(body.winner_player_id) if body.winner_player_id else None,
                "awarded_count": awarded_count,
                "points_each": points,
            },
        )
    )

    # The match-result trigger doesn't fire here (no match score changed), so
    # we recompute the leaderboard snapshot in-Python before committing.
    # Without this, the final standings stay stuck on the last match snapshot.
    await recompute_leaderboard_snapshot(db, triggered_by_match_id=None)

    await db.commit()
    await notify_special_results_awarded(db, ptype.value)
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
