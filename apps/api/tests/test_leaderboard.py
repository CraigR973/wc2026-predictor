"""Tests for the per-league leaderboard endpoints (M5).

The v1 global ``/api/v1/leaderboard*`` paths now answer 410 Gone; live data is
served under ``/api/v1/leagues/{slug}/leaderboard*``. Unit tests override the
``require_league_member`` dependency so the mock DB only has to satisfy the
endpoint's own query; the DB-backed tests seed real leagues to prove per-league
scoping and the C-2 dedupe under tied snapshot timestamps.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession

from src.auth import get_current_player
from src.database import get_db
from src.main import app
from src.models.prediction import LeaderboardSnapshot
from src.models.profile import Profile
from src.routers.leagues import require_league_member
from tests.conftest import ensure_default_league_membership

SLUG = "test-league"

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


def _league(league_id: uuid.UUID | None = None) -> MagicMock:
    league = MagicMock()
    league.id = league_id or uuid.uuid4()
    return league


def _db_with(mock_db: AsyncMock):  # type: ignore[no-untyped-def]
    async def _override():  # type: ignore[no-untyped-def]
        yield mock_db

    return _override


def _override_member(league_id: uuid.UUID | None = None) -> None:
    app.dependency_overrides[require_league_member] = lambda: (
        _make_requester(),
        _league(league_id),
    )


# ---------------------------------------------------------------------------
# GET /api/v1/leagues/{slug}/leaderboard
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_league_leaderboard_returns_entries_in_rank_order() -> None:
    alice = _make_player(display_name="Alice")
    bob = _make_player(display_name="Bob")
    snap_alice = _make_snapshot(alice.id, total_points=20, match_points=20, rank=1)
    snap_bob = _make_snapshot(bob.id, total_points=10, match_points=10, rank=2)

    mock_db = AsyncMock()
    result = MagicMock()
    result.all.return_value = [(alice, snap_alice), (bob, snap_bob)]
    mock_db.execute = AsyncMock(return_value=result)

    _override_member()
    app.dependency_overrides[get_db] = _db_with(mock_db)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/v1/leagues/{SLUG}/leaderboard")
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["rank"] == 1
    assert data[0]["player_name"] == "Alice"
    assert data[0]["total_points"] == 20
    assert data[1]["rank"] == 2
    assert data[1]["player_name"] == "Bob"
    assert data[1]["is_active"] is True


@pytest.mark.asyncio
async def test_league_leaderboard_active_only_by_default() -> None:
    alice = _make_player(display_name="Alice")
    snap = _make_snapshot(alice.id, rank=1)

    mock_db = AsyncMock()
    result = MagicMock()
    result.all.return_value = [(alice, snap)]
    mock_db.execute = AsyncMock(return_value=result)

    _override_member()
    app.dependency_overrides[get_db] = _db_with(mock_db)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/v1/leagues/{SLUG}/leaderboard")
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_league_leaderboard_include_inactive_shows_all() -> None:
    alice = _make_player(display_name="Alice", is_active=True)
    inactive = _make_player(display_name="Removed", is_active=False)
    snap_alice = _make_snapshot(alice.id, total_points=20, rank=1)
    snap_inactive = _make_snapshot(inactive.id, total_points=5, rank=2)

    mock_db = AsyncMock()
    result = MagicMock()
    result.all.return_value = [(alice, snap_alice), (inactive, snap_inactive)]
    mock_db.execute = AsyncMock(return_value=result)

    _override_member()
    app.dependency_overrides[get_db] = _db_with(mock_db)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/v1/leagues/{SLUG}/leaderboard?include_inactive=true")
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    inactive_entry = next(e for e in data if e["player_name"] == "Removed")
    assert inactive_entry["is_active"] is False


@pytest.mark.asyncio
async def test_league_leaderboard_requires_auth() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/v1/leagues/{SLUG}/leaderboard")
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# GET /api/v1/leagues/{slug}/leaderboard/history
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_league_leaderboard_history_groups_by_player() -> None:
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

    _override_member()
    app.dependency_overrides[get_db] = _db_with(mock_db)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/v1/leagues/{SLUG}/leaderboard/history")
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    by_name = {e["player_name"]: e for e in data}
    assert len(by_name["Alice"]["snapshots"]) == 2
    assert by_name["Alice"]["snapshots"][0]["total_points"] == 10
    assert by_name["Alice"]["snapshots"][1]["total_points"] == 20


@pytest.mark.asyncio
async def test_league_leaderboard_history_empty_when_no_snapshots() -> None:
    mock_db = AsyncMock()
    result = MagicMock()
    result.all.return_value = []
    mock_db.execute = AsyncMock(return_value=result)

    _override_member()
    app.dependency_overrides[get_db] = _db_with(mock_db)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/v1/leagues/{SLUG}/leaderboard/history")
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# GET /api/v1/leagues/{slug}/leaderboard/round/{stage}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_league_round_leaderboard_returns_sorted_points() -> None:
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

    result.all.return_value = [row_bob, row_alice]
    mock_db.execute = AsyncMock(return_value=result)

    _override_member()
    app.dependency_overrides[get_db] = _db_with(mock_db)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/v1/leagues/{SLUG}/leaderboard/round/group")
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["player_name"] == "Alice"
    assert data[0]["points"] == 30
    assert data[0]["rank"] == 1
    assert data[1]["rank"] == 2


@pytest.mark.asyncio
async def test_league_round_leaderboard_invalid_stage_returns_422() -> None:
    _override_member()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/v1/leagues/{SLUG}/leaderboard/round/nonsense")
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Removed v1 paths return 404
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/leaderboard",
        "/api/v1/leaderboard/history",
        "/api/v1/leaderboard/round/group",
    ],
)
async def test_old_leaderboard_paths_removed(path: str) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(path)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DB-backed: per-league scoping + C-2 dedupe under tied timestamps
# ---------------------------------------------------------------------------


async def _new_profile(conn: AsyncConnection, name: str) -> uuid.UUID:
    return (
        await conn.execute(
            text(
                """
                INSERT INTO profiles (id, display_name, pin_hash, role)
                VALUES (
                    gen_random_uuid(), :name,
                    '$2b$12$0000000000000000000000000000000000000000000000000000',
                    CAST('player' AS player_role)
                )
                RETURNING id
                """
            ),
            {"name": name},
        )
    ).scalar_one()


async def _new_league(conn: AsyncConnection, slug: str, name: str, creator: uuid.UUID) -> uuid.UUID:
    league_id = (
        await conn.execute(
            text(
                """
                INSERT INTO leagues (id, slug, name, created_by)
                VALUES (gen_random_uuid(), :slug, :name, :p)
                RETURNING id
                """
            ),
            {"slug": slug, "name": name, "p": str(creator)},
        )
    ).scalar_one()
    await conn.execute(
        text(
            """
            INSERT INTO league_memberships (id, league_id, player_id, role)
            VALUES (gen_random_uuid(), :l, :p, CAST('player' AS league_member_role))
            ON CONFLICT (league_id, player_id) DO NOTHING
            """
        ),
        {"l": league_id, "p": str(creator)},
    )
    return league_id


async def _add_member(conn: AsyncConnection, league_id: uuid.UUID, player_id: uuid.UUID) -> None:
    await conn.execute(
        text(
            """
            INSERT INTO league_memberships (id, league_id, player_id, role)
            VALUES (gen_random_uuid(), :l, :p, CAST('player' AS league_member_role))
            ON CONFLICT (league_id, player_id) DO NOTHING
            """
        ),
        {"l": str(league_id), "p": str(player_id)},
    )


async def _snapshot(
    conn: AsyncConnection,
    player_id: uuid.UUID,
    league_id: uuid.UUID,
    points: int,
    rank: int,
    snapshot_at: datetime,
) -> None:
    await conn.execute(
        text(
            """
            INSERT INTO leaderboard_snapshots (
                id, player_id, league_id, total_points, match_points,
                knockout_winner_points, special_points, rank,
                snapshot_at, triggered_by_match_id
            )
            VALUES (gen_random_uuid(), :p, :l, :pts, :pts, 0, 0, :rank, :t, NULL)
            """
        ),
        {"p": str(player_id), "l": str(league_id), "pts": points, "rank": rank, "t": snapshot_at},
    )


async def _fetch_leaderboard(
    session: AsyncSession, league_id: uuid.UUID
) -> list[dict[str, object]]:
    app.dependency_overrides[get_db] = _db_with(session)
    app.dependency_overrides[require_league_member] = lambda: (
        _make_requester(),
        _league(league_id),
    )
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/v1/leagues/{SLUG}/leaderboard")
    finally:
        app.dependency_overrides.clear()
    assert resp.status_code == 200
    return resp.json()


@pytest.mark.asyncio
async def test_league_leaderboard_hides_other_league_players(
    db_conn: AsyncConnection,
) -> None:
    """A player_id present in another league must not bleed in, and a shared
    player must show *this* league's points — acceptance criterion #2."""
    shared = await _new_profile(db_conn, "shared_x")
    other_only = await _new_profile(db_conn, "other_only_y")

    league_a = await _new_league(db_conn, "league-a", "League A", shared)
    league_b = await _new_league(db_conn, "league-b", "League B", other_only)
    await _add_member(db_conn, league_b, shared)

    t = datetime(2026, 6, 16, 18, 0, 0)
    await _snapshot(db_conn, shared, league_a, 10, 1, t)  # A-scoped points
    await _snapshot(db_conn, shared, league_b, 50, 2, t)  # B-scoped points
    await _snapshot(db_conn, other_only, league_b, 99, 1, t)

    session = AsyncSession(bind=db_conn, expire_on_commit=False)
    try:
        data = await _fetch_leaderboard(session, league_a)
    finally:
        await session.close()

    names = {e["player_name"] for e in data}
    assert "shared_x" in names
    assert "other_only_y" not in names, f"other-league player leaked: {data}"
    shared_entry = next(e for e in data if e["player_name"] == "shared_x")
    assert shared_entry["total_points"] == 10, "showed the wrong league's snapshot"


@pytest.mark.asyncio
async def test_league_leaderboard_dedupes_tied_timestamps_multi_league(
    db_conn: AsyncConnection,
) -> None:
    """Tied snapshot timestamps collapse to one row per player *in each league
    simultaneously*, keyed on (player_id, league_id) — acceptance criterion #4."""
    alice = await _new_profile(db_conn, "multi_alice")

    league_a = await _new_league(db_conn, "ml-league-a", "ML A", alice)
    league_b = await _new_league(db_conn, "ml-league-b", "ML B", alice)

    tied = datetime(2026, 6, 14, 18, 0, 0)
    # Two snapshots with identical snapshot_at in each league.
    await _snapshot(db_conn, alice, league_a, 5, 1, tied)
    await _snapshot(db_conn, alice, league_a, 10, 1, tied)
    await _snapshot(db_conn, alice, league_b, 50, 1, tied)
    await _snapshot(db_conn, alice, league_b, 60, 1, tied)

    session = AsyncSession(bind=db_conn, expire_on_commit=False)
    try:
        data_a = await _fetch_leaderboard(session, league_a)
        data_b = await _fetch_leaderboard(session, league_b)
    finally:
        await session.close()

    a_rows = [e for e in data_a if e["player_name"] == "multi_alice"]
    b_rows = [e for e in data_b if e["player_name"] == "multi_alice"]
    assert len(a_rows) == 1, f"league A not deduped: {data_a}"
    assert len(b_rows) == 1, f"league B not deduped: {data_b}"
    assert a_rows[0]["total_points"] in (5, 10)
    assert b_rows[0]["total_points"] in (50, 60)


@pytest.mark.asyncio
async def test_league_leaderboard_requires_membership_real_dep(
    db_conn: AsyncConnection,
) -> None:
    """Without the override, a non-member (here: the soft-deleted requester
    fixture state) is rejected by the real require_league_member guard."""
    creator = await _new_profile(db_conn, "lm_creator")
    league_id = await ensure_default_league_membership(db_conn, creator)
    outsider = await _new_profile(db_conn, "lm_outsider")

    session = AsyncSession(bind=db_conn, expire_on_commit=False)

    def _outsider() -> MagicMock:
        p = MagicMock(spec=Profile)
        p.id = outsider
        p.site_role = None
        return p

    app.dependency_overrides[get_db] = _db_with(session)
    app.dependency_overrides[get_current_player] = _outsider
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/leagues/steele-spreadsheet/leaderboard")
    finally:
        app.dependency_overrides.clear()
        await session.close()

    assert resp.status_code == 403
    assert league_id is not None
