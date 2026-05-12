"""Tests for Phase 6.1 leaderboard endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from src.auth import get_current_player
from src.database import get_db
from src.main import app
from src.models.prediction import LeaderboardSnapshot
from src.models.profile import Profile

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_player(
    *,
    display_name: str = "Alice",
    is_active: bool = True,
    deleted: bool = False,
) -> MagicMock:
    p = MagicMock(spec=Profile)
    p.id = uuid.uuid4()
    p.display_name = display_name
    p.is_active = is_active
    p.deleted_at = datetime(2026, 1, 1) if deleted else None
    return p


def _make_snapshot(
    player_id: uuid.UUID,
    *,
    total_points: int = 10,
    match_points: int = 10,
    knockout_winner_points: int = 0,
    special_points: int = 0,
    rank: int = 1,
    snapshot_at: datetime | None = None,
) -> MagicMock:
    s = MagicMock(spec=LeaderboardSnapshot)
    s.player_id = player_id
    s.total_points = total_points
    s.match_points = match_points
    s.knockout_winner_points = knockout_winner_points
    s.special_points = special_points
    s.rank = rank
    s.snapshot_at = snapshot_at or datetime(2026, 6, 11, 18, 0, 0)
    return s


def _make_requester() -> MagicMock:
    p = MagicMock(spec=Profile)
    p.id = uuid.uuid4()
    p.display_name = "Requester"
    p.is_active = True
    p.deleted_at = None
    return p


def _db_with(mock_db: AsyncMock):
    async def _override():
        yield mock_db

    return _override


# ---------------------------------------------------------------------------
# GET /api/v1/leaderboard
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_leaderboard_returns_entries_in_rank_order() -> None:
    alice = _make_player(display_name="Alice")
    bob = _make_player(display_name="Bob")
    snap_alice = _make_snapshot(alice.id, total_points=20, match_points=20, rank=1)
    snap_bob = _make_snapshot(bob.id, total_points=10, match_points=10, rank=2)

    mock_db = AsyncMock()
    result = MagicMock()
    result.all.return_value = [(alice, snap_alice), (bob, snap_bob)]
    mock_db.execute = AsyncMock(return_value=result)

    app.dependency_overrides[get_db] = _db_with(mock_db)
    app.dependency_overrides[get_current_player] = lambda: _make_requester()

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/leaderboard")
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_player, None)

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["rank"] == 1
    assert data[0]["player_name"] == "Alice"
    assert data[0]["total_points"] == 20
    assert data[0]["match_points"] == 20
    assert data[0]["knockout_winner_points"] == 0
    assert data[0]["special_points"] == 0
    assert data[1]["rank"] == 2
    assert data[1]["player_name"] == "Bob"
    assert data[1]["is_active"] is True


@pytest.mark.asyncio
async def test_leaderboard_active_only_by_default() -> None:
    """DB returns one active player (inactive filtered at DB level); response has 1 entry."""
    alice = _make_player(display_name="Alice")
    snap = _make_snapshot(alice.id, rank=1)

    mock_db = AsyncMock()
    result = MagicMock()
    result.all.return_value = [(alice, snap)]
    mock_db.execute = AsyncMock(return_value=result)

    app.dependency_overrides[get_db] = _db_with(mock_db)
    app.dependency_overrides[get_current_player] = lambda: _make_requester()

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/leaderboard")
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_player, None)

    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_leaderboard_include_inactive_shows_all() -> None:
    alice = _make_player(display_name="Alice", is_active=True)
    inactive = _make_player(display_name="Removed", is_active=False)
    snap_alice = _make_snapshot(alice.id, total_points=20, rank=1)
    snap_inactive = _make_snapshot(inactive.id, total_points=5, rank=2)

    mock_db = AsyncMock()
    result = MagicMock()
    result.all.return_value = [(alice, snap_alice), (inactive, snap_inactive)]
    mock_db.execute = AsyncMock(return_value=result)

    app.dependency_overrides[get_db] = _db_with(mock_db)
    app.dependency_overrides[get_current_player] = lambda: _make_requester()

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/leaderboard?include_inactive=true")
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_player, None)

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    inactive_entry = next(e for e in data if e["player_name"] == "Removed")
    assert inactive_entry["is_active"] is False


@pytest.mark.asyncio
async def test_leaderboard_requires_auth() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/leaderboard")
    # HTTPBearer returns 403 when no Authorization header is supplied
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# GET /api/v1/leaderboard/history
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_leaderboard_history_groups_by_player() -> None:
    alice = _make_player(display_name="Alice")
    bob = _make_player(display_name="Bob")

    t1 = datetime(2026, 6, 11, 18, 0, 0)
    t2 = datetime(2026, 6, 12, 18, 0, 0)

    snap_a1 = _make_snapshot(alice.id, total_points=10, rank=1, snapshot_at=t1)
    snap_b1 = _make_snapshot(bob.id, total_points=5, rank=2, snapshot_at=t1)
    snap_a2 = _make_snapshot(alice.id, total_points=20, rank=1, snapshot_at=t2)
    snap_b2 = _make_snapshot(bob.id, total_points=15, rank=2, snapshot_at=t2)

    mock_db = AsyncMock()
    result = MagicMock()
    result.all.return_value = [
        (alice, snap_a1),
        (bob, snap_b1),
        (alice, snap_a2),
        (bob, snap_b2),
    ]
    mock_db.execute = AsyncMock(return_value=result)

    app.dependency_overrides[get_db] = _db_with(mock_db)
    app.dependency_overrides[get_current_player] = lambda: _make_requester()

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/leaderboard/history")
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_player, None)

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2

    by_name = {e["player_name"]: e for e in data}
    assert len(by_name["Alice"]["snapshots"]) == 2
    assert by_name["Alice"]["snapshots"][0]["total_points"] == 10
    assert by_name["Alice"]["snapshots"][1]["total_points"] == 20
    assert len(by_name["Bob"]["snapshots"]) == 2
    assert by_name["Bob"]["snapshots"][0]["rank"] == 2


@pytest.mark.asyncio
async def test_leaderboard_history_empty_when_no_snapshots() -> None:
    mock_db = AsyncMock()
    result = MagicMock()
    result.all.return_value = []
    mock_db.execute = AsyncMock(return_value=result)

    app.dependency_overrides[get_db] = _db_with(mock_db)
    app.dependency_overrides[get_current_player] = lambda: _make_requester()

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/leaderboard/history")
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_player, None)

    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# GET /api/v1/leaderboard/round/{stage}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_round_leaderboard_returns_sorted_points() -> None:
    alice = _make_player(display_name="Alice")
    bob = _make_player(display_name="Bob")

    mock_db = AsyncMock()
    result = MagicMock()

    row_alice = MagicMock()
    row_alice.Profile = alice
    row_alice.points = 30

    row_bob = MagicMock()
    row_bob.Profile = bob
    row_bob.points = 10

    # DB returns unsorted; endpoint sorts by points desc
    result.all.return_value = [row_bob, row_alice]
    mock_db.execute = AsyncMock(return_value=result)

    app.dependency_overrides[get_db] = _db_with(mock_db)
    app.dependency_overrides[get_current_player] = lambda: _make_requester()

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/leaderboard/round/group")
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_player, None)

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["player_name"] == "Alice"
    assert data[0]["points"] == 30
    assert data[0]["rank"] == 1
    assert data[1]["player_name"] == "Bob"
    assert data[1]["points"] == 10
    assert data[1]["rank"] == 2


@pytest.mark.asyncio
async def test_round_leaderboard_invalid_stage_returns_422() -> None:
    app.dependency_overrides[get_current_player] = lambda: _make_requester()

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/leaderboard/round/nonsense")
    finally:
        app.dependency_overrides.pop(get_current_player, None)

    assert resp.status_code == 422
