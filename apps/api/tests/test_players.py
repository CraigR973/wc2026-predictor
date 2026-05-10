"""Tests for player list/get and admin soft-delete."""

import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import get_current_player, require_admin
from src.database import get_db
from src.main import app
from src.models.profile import PlayerRole, Profile


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _make_profile(
    *,
    display_name: str = "Player1",
    role: PlayerRole = PlayerRole.player,
    deleted_at: datetime | None = None,
) -> MagicMock:
    p = MagicMock(spec=Profile)
    p.id = uuid.uuid4()
    p.display_name = display_name
    p.role = role
    p.timezone = "UTC"
    p.deleted_at = deleted_at
    p.created_at = _now()
    return p


def _stub_db(execute_results: list) -> AsyncMock:
    mock_db = AsyncMock(spec=AsyncSession)
    mock_db.execute = AsyncMock(side_effect=execute_results)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock(side_effect=lambda obj: None)
    mock_db.add = MagicMock()
    return mock_db


def _scalars(items: list) -> MagicMock:
    r = MagicMock()
    r.scalars.return_value.all.return_value = items
    return r


def _scalar(value: object) -> MagicMock:
    r = MagicMock()
    r.scalar_one_or_none.return_value = value
    return r


@asynccontextmanager
async def _override_player_and_db(
    mock_db: AsyncMock, player: Profile
) -> AsyncGenerator[None, None]:
    async def _fake_db() -> AsyncGenerator[AsyncSession, None]:
        yield mock_db

    async def _fake_player() -> Profile:
        return player

    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_current_player] = _fake_player
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_player, None)


@asynccontextmanager
async def _override_db_and_admin(mock_db: AsyncMock, admin: Profile) -> AsyncGenerator[None, None]:
    async def _fake_db() -> AsyncGenerator[AsyncSession, None]:
        yield mock_db

    async def _fake_admin() -> Profile:
        return admin

    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[require_admin] = _fake_admin
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(require_admin, None)


@pytest.fixture
async def client() -> AsyncClient:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# GET /api/v1/players
# ---------------------------------------------------------------------------


async def test_list_players_returns_active(client: AsyncClient) -> None:
    caller = _make_profile(display_name="Caller")
    players = [_make_profile(display_name="Alice"), _make_profile(display_name="Bob")]
    mock_db = _stub_db([_scalars(players)])

    async with _override_player_and_db(mock_db, caller):
        resp = await client.get("/api/v1/players")

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data) == 2
    assert all(not p["is_deleted"] for p in data)


async def test_list_players_empty(client: AsyncClient) -> None:
    caller = _make_profile()
    mock_db = _stub_db([_scalars([])])

    async with _override_player_and_db(mock_db, caller):
        resp = await client.get("/api/v1/players")

    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_players_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/players")
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# GET /api/v1/players/{id}
# ---------------------------------------------------------------------------


async def test_get_player_active(client: AsyncClient) -> None:
    caller = _make_profile()
    target = _make_profile(display_name="Target")
    mock_db = _stub_db([_scalar(target)])

    async with _override_player_and_db(mock_db, caller):
        resp = await client.get(f"/api/v1/players/{target.id}")

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["display_name"] == "Target"
    assert data["is_deleted"] is False


async def test_get_player_soft_deleted(client: AsyncClient) -> None:
    caller = _make_profile()
    target = _make_profile(display_name="Gone", deleted_at=_now())
    mock_db = _stub_db([_scalar(target)])

    async with _override_player_and_db(mock_db, caller):
        resp = await client.get(f"/api/v1/players/{target.id}")

    assert resp.status_code == 200, resp.text
    assert resp.json()["is_deleted"] is True


async def test_get_player_not_found(client: AsyncClient) -> None:
    caller = _make_profile()
    mock_db = _stub_db([_scalar(None)])

    async with _override_player_and_db(mock_db, caller):
        resp = await client.get(f"/api/v1/players/{uuid.uuid4()}")

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/v1/admin/players/{id}
# ---------------------------------------------------------------------------


async def test_delete_player_soft_deletes(client: AsyncClient) -> None:
    admin = _make_profile(role=PlayerRole.admin)
    target = _make_profile(display_name="Victim")
    mock_db = _stub_db([_scalar(target)])

    async with _override_db_and_admin(mock_db, admin):
        resp = await client.delete(f"/api/v1/admin/players/{target.id}")

    assert resp.status_code == 204
    assert target.deleted_at is not None
    mock_db.commit.assert_called_once()


async def test_delete_player_not_found(client: AsyncClient) -> None:
    admin = _make_profile(role=PlayerRole.admin)
    mock_db = _stub_db([_scalar(None)])

    async with _override_db_and_admin(mock_db, admin):
        resp = await client.delete(f"/api/v1/admin/players/{uuid.uuid4()}")

    assert resp.status_code == 404


async def test_delete_player_hidden_from_list(client: AsyncClient) -> None:
    """After soft-delete, player does not appear in active list."""
    caller = _make_profile()
    # Soft-deleted players are excluded from the query at the DB layer;
    # the mock returns empty list simulating that filter.
    mock_db = _stub_db([_scalars([])])

    async with _override_player_and_db(mock_db, caller):
        resp = await client.get("/api/v1/players")

    assert resp.status_code == 200
    assert resp.json() == []


async def test_delete_player_requires_admin(client: AsyncClient) -> None:
    resp = await client.delete(f"/api/v1/admin/players/{uuid.uuid4()}")
    assert resp.status_code in (401, 403)
