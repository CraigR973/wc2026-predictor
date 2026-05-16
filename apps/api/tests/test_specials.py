"""Tests for special predictions endpoints."""

import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import get_current_player, require_admin
from src.database import get_db
from src.main import app
from src.models.prediction import SpecialPrediction, SpecialPredictionType
from src.models.profile import PlayerRole, Profile


@pytest.fixture(autouse=True)
def _no_notify_specials() -> None:
    with patch("src.routers.specials.notify_special_results_awarded", new_callable=AsyncMock):
        yield

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _make_player(role: PlayerRole = PlayerRole.player) -> Profile:
    p = MagicMock(spec=Profile)
    p.id = uuid.uuid4()
    p.display_name = "TestPlayer"
    p.role = role
    p.deleted_at = None
    return p


def _make_admin() -> Profile:
    return _make_player(role=PlayerRole.admin)


def _make_match(locked: bool = False) -> MagicMock:
    m = MagicMock()
    m.id = uuid.uuid4()
    m.kickoff_utc = _now() + (timedelta(hours=-1) if locked else timedelta(hours=1))
    m.deleted_at = None
    return m


def _make_special(
    player_id: uuid.UUID,
    ptype: SpecialPredictionType,
    team_id: uuid.UUID | None = None,
    player_name: str | None = None,
    points: int | None = None,
) -> SpecialPrediction:
    p = MagicMock(spec=SpecialPrediction)
    p.id = uuid.uuid4()
    p.player_id = player_id
    p.prediction_type = ptype
    p.predicted_team_id = team_id
    p.predicted_player_name = player_name
    p.submitted_at = _now()
    p.points_awarded = points
    p.updated_at = _now()
    return p


def _scalar_one(value: object) -> MagicMock:
    r = MagicMock()
    r.scalar_one_or_none.return_value = value
    return r


def _scalars(items: list) -> MagicMock:
    r = MagicMock()
    r.scalars.return_value.all.return_value = items
    return r


def _rows(pairs: list) -> MagicMock:
    r = MagicMock()
    r.all.return_value = pairs
    return r


def _stub_db(execute_results: list) -> AsyncMock:
    mock_db = AsyncMock(spec=AsyncSession)
    mock_db.execute = AsyncMock(side_effect=execute_results)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock(side_effect=lambda obj: None)
    mock_db.add = MagicMock()
    return mock_db


@asynccontextmanager
async def _override(mock_db: AsyncMock, player: Profile) -> AsyncGenerator[None, None]:
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_player] = lambda: player
    app.dependency_overrides[require_admin] = lambda: player
    try:
        yield
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# GET /api/v1/specials
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_my_specials_empty() -> None:
    """Returns all 3 types with nulls when no predictions submitted yet."""
    player = _make_player()
    opening = _make_match(locked=False)
    db = _stub_db([_scalar_one(opening), _scalars([])])

    async with _override(db, player):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/specials", headers={"Authorization": "Bearer x"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["is_locked"] is False
    assert data["lock_at"] is not None
    assert len(data["predictions"]) == 3
    assert all(p["submitted_at"] is None for p in data["predictions"])


@pytest.mark.asyncio
async def test_get_my_specials_with_existing() -> None:
    """Returns submitted predictions correctly."""
    player = _make_player()
    team_id = uuid.uuid4()
    opening = _make_match(locked=False)
    pred = _make_special(player.id, SpecialPredictionType.tournament_winner, team_id=team_id)
    db = _stub_db([_scalar_one(opening), _scalars([pred])])

    async with _override(db, player):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/specials", headers={"Authorization": "Bearer x"})

    assert resp.status_code == 200
    data = resp.json()
    tw = next(p for p in data["predictions"] if p["prediction_type"] == "tournament_winner")
    assert tw["predicted_team_id"] == str(team_id)
    assert tw["submitted_at"] is not None


@pytest.mark.asyncio
async def test_get_my_specials_locked() -> None:
    """is_locked is True when past opening match kickoff."""
    player = _make_player()
    opening = _make_match(locked=True)
    db = _stub_db([_scalar_one(opening), _scalars([])])

    async with _override(db, player):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/specials", headers={"Authorization": "Bearer x"})

    assert resp.status_code == 200
    assert resp.json()["is_locked"] is True


# ---------------------------------------------------------------------------
# PUT /api/v1/specials/{type}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_put_special_tournament_winner_creates() -> None:
    """Creates a new tournament_winner special prediction."""
    player = _make_player()
    team_id = uuid.uuid4()
    opening = _make_match(locked=False)
    pred = _make_special(player.id, SpecialPredictionType.tournament_winner, team_id=team_id)
    db = _stub_db([_scalar_one(opening), _scalar_one(None)])
    db.refresh = AsyncMock(side_effect=lambda obj: _patch_special(obj, pred))

    async with _override(db, player):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.put(
                "/api/v1/specials/tournament_winner",
                json={"predicted_team_id": str(team_id)},
                headers={"Authorization": "Bearer x"},
            )

    assert resp.status_code == 200
    assert resp.json()["predicted_team_id"] == str(team_id)
    db.add.assert_called_once()


@pytest.mark.asyncio
async def test_put_special_golden_boot_creates() -> None:
    """Creates a new golden_boot special prediction (free text)."""
    player = _make_player()
    opening = _make_match(locked=False)
    pred = _make_special(player.id, SpecialPredictionType.golden_boot, player_name="Kylian Mbappé")
    db = _stub_db([_scalar_one(opening), _scalar_one(None)])
    db.refresh = AsyncMock(side_effect=lambda obj: _patch_special(obj, pred))

    async with _override(db, player):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.put(
                "/api/v1/specials/golden_boot",
                json={"predicted_player_name": "Kylian Mbappé"},
                headers={"Authorization": "Bearer x"},
            )

    assert resp.status_code == 200
    assert resp.json()["predicted_player_name"] == "Kylian Mbappé"


@pytest.mark.asyncio
async def test_put_special_locked_returns_409() -> None:
    """Returns 409 when tournament has started."""
    player = _make_player()
    opening = _make_match(locked=True)
    team_id = uuid.uuid4()
    db = _stub_db([_scalar_one(opening)])

    async with _override(db, player):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.put(
                "/api/v1/specials/tournament_winner",
                json={"predicted_team_id": str(team_id)},
                headers={"Authorization": "Bearer x"},
            )

    assert resp.status_code == 409
    assert resp.json()["detail"] == "PREDICTION_LOCKED"


@pytest.mark.asyncio
async def test_put_special_golden_boot_missing_name_returns_422() -> None:
    """Returns 422 if predicted_player_name missing for golden_boot."""
    player = _make_player()
    opening = _make_match(locked=False)
    db = _stub_db([_scalar_one(opening)])

    async with _override(db, player):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.put(
                "/api/v1/specials/golden_boot",
                json={},
                headers={"Authorization": "Bearer x"},
            )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_put_special_team_type_missing_team_returns_422() -> None:
    """Returns 422 if predicted_team_id missing for tournament_winner."""
    player = _make_player()
    opening = _make_match(locked=False)
    db = _stub_db([_scalar_one(opening)])

    async with _override(db, player):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.put(
                "/api/v1/specials/tournament_winner",
                json={},
                headers={"Authorization": "Bearer x"},
            )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_put_special_updates_existing() -> None:
    """Updates an existing prediction."""
    player = _make_player()
    team_id = uuid.uuid4()
    new_team_id = uuid.uuid4()
    opening = _make_match(locked=False)
    existing = _make_special(player.id, SpecialPredictionType.tournament_winner, team_id=team_id)
    updated = _make_special(player.id, SpecialPredictionType.tournament_winner, team_id=new_team_id)
    db = _stub_db([_scalar_one(opening), _scalar_one(existing)])
    db.refresh = AsyncMock(side_effect=lambda obj: _patch_special(obj, updated))

    async with _override(db, player):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.put(
                "/api/v1/specials/tournament_winner",
                json={"predicted_team_id": str(new_team_id)},
                headers={"Authorization": "Bearer x"},
            )

    assert resp.status_code == 200
    assert resp.json()["predicted_team_id"] == str(new_team_id)
    db.add.assert_not_called()


# ---------------------------------------------------------------------------
# GET /api/v1/specials/all
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_all_specials_pre_lock_returns_403() -> None:
    """Returns 403 before tournament starts."""
    player = _make_player()
    opening = _make_match(locked=False)
    db = _stub_db([_scalar_one(opening)])

    async with _override(db, player):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/specials/all", headers={"Authorization": "Bearer x"})

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_all_specials_post_lock() -> None:
    """Returns all players' predictions after tournament starts."""
    player = _make_player()
    other_id = uuid.uuid4()
    other_profile = MagicMock(spec=Profile)
    other_profile.id = other_id
    other_profile.display_name = "OtherPlayer"
    other_profile.deleted_at = None

    opening = _make_match(locked=True)
    pred = _make_special(other_id, SpecialPredictionType.tournament_winner, team_id=uuid.uuid4())
    db = _stub_db([_scalar_one(opening), _rows([(pred, other_profile)])])

    async with _override(db, player):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/specials/all", headers={"Authorization": "Bearer x"})

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["player_name"] == "OtherPlayer"
    assert len(data[0]["predictions"]) == 1


# ---------------------------------------------------------------------------
# POST /api/v1/admin/specials/award
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_award_specials_tournament_winner() -> None:
    """Awards 20 pts to correct tournament winner predictions."""
    admin = _make_admin()
    team_id = uuid.uuid4()
    wrong_team_id = uuid.uuid4()

    correct_pred = _make_special(
        uuid.uuid4(), SpecialPredictionType.tournament_winner, team_id=team_id
    )
    correct_pred.points_awarded = None
    wrong_pred = _make_special(
        uuid.uuid4(), SpecialPredictionType.tournament_winner, team_id=wrong_team_id
    )
    wrong_pred.points_awarded = None

    db = _stub_db([_scalars([correct_pred, wrong_pred])])

    async with _override(db, admin):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/admin/specials/award",
                json={
                    "prediction_type": "tournament_winner",
                    "winner_team_id": str(team_id),
                },
                headers={"Authorization": "Bearer x"},
            )

    assert resp.status_code == 200
    data = resp.json()
    assert data["prediction_type"] == "tournament_winner"
    assert data["awarded_count"] == 1
    assert data["points_each"] == 20
    assert correct_pred.points_awarded == 20
    assert wrong_pred.points_awarded == 0


@pytest.mark.asyncio
async def test_award_specials_golden_boot_case_insensitive() -> None:
    """Awards 15 pts for golden boot, case-insensitive match."""
    admin = _make_admin()
    correct_pred = _make_special(
        uuid.uuid4(), SpecialPredictionType.golden_boot, player_name="kylian mbappé"
    )
    correct_pred.points_awarded = None
    wrong_pred = _make_special(
        uuid.uuid4(), SpecialPredictionType.golden_boot, player_name="Erling Haaland"
    )
    wrong_pred.points_awarded = None

    db = _stub_db([_scalars([correct_pred, wrong_pred])])

    async with _override(db, admin):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/admin/specials/award",
                json={
                    "prediction_type": "golden_boot",
                    "winner_player_name": "Kylian Mbappé",
                },
                headers={"Authorization": "Bearer x"},
            )

    assert resp.status_code == 200
    data = resp.json()
    assert data["awarded_count"] == 1
    assert data["points_each"] == 15
    assert correct_pred.points_awarded == 15
    assert wrong_pred.points_awarded == 0


@pytest.mark.asyncio
async def test_award_specials_golden_boot_missing_name_returns_422() -> None:
    """Returns 422 if winner_player_name missing for golden_boot award."""
    admin = _make_admin()
    db = _stub_db([])

    async with _override(db, admin):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/admin/specials/award",
                json={"prediction_type": "golden_boot"},
                headers={"Authorization": "Bearer x"},
            )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_award_specials_top_scoring_team() -> None:
    """Awards 10 pts for top_scoring_team."""
    admin = _make_admin()
    team_id = uuid.uuid4()
    pred = _make_special(uuid.uuid4(), SpecialPredictionType.top_scoring_team, team_id=team_id)
    pred.points_awarded = None

    db = _stub_db([_scalars([pred])])

    async with _override(db, admin):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/admin/specials/award",
                json={
                    "prediction_type": "top_scoring_team",
                    "winner_team_id": str(team_id),
                },
                headers={"Authorization": "Bearer x"},
            )

    assert resp.status_code == 200
    data = resp.json()
    assert data["points_each"] == 10
    assert data["awarded_count"] == 1
    assert pred.points_awarded == 10


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _patch_special(obj: object, template: SpecialPrediction) -> None:
    for attr in (
        "id",
        "player_id",
        "prediction_type",
        "predicted_team_id",
        "predicted_player_name",
        "submitted_at",
        "points_awarded",
        "updated_at",
    ):
        setattr(obj, attr, getattr(template, attr))
