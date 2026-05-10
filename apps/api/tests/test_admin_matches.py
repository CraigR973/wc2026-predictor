"""Tests for admin match endpoints: reschedule, postpone, cancel."""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import require_admin
from src.database import get_db
from src.main import app
from src.models.match import Match, MatchStatus
from src.models.notification import ActionType, ActorType, AuditLog
from src.models.profile import PlayerRole, Profile


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _make_admin() -> Profile:
    p = MagicMock(spec=Profile)
    p.id = uuid.uuid4()
    p.display_name = "Admin"
    p.role = PlayerRole.admin
    p.deleted_at = None
    return p


def _make_match(
    *,
    status: MatchStatus = MatchStatus.scheduled,
    kickoff: datetime | None = None,
    original_kickoff: datetime | None = None,
    locked_at: datetime | None = None,
) -> Match:
    m = MagicMock(spec=Match)
    m.id = uuid.uuid4()
    m.match_number = 1
    m.status = status
    m.kickoff_utc = kickoff or _now()
    m.original_kickoff_utc = original_kickoff
    m.locked_at = locked_at
    m.postponed_reason = None
    m.deleted_at = None
    return m


def _scalar(value: object) -> MagicMock:
    r = MagicMock()
    r.scalar_one_or_none.return_value = value
    return r


def _stub_db(execute_results: list) -> AsyncMock:
    mock_db = AsyncMock(spec=AsyncSession)
    mock_db.execute = AsyncMock(side_effect=execute_results)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock(side_effect=lambda obj: None)
    mock_db.add = MagicMock()
    return mock_db


@asynccontextmanager
async def _override(mock_db: AsyncMock, admin: Profile) -> AsyncGenerator[None, None]:
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
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def _audit_rows(db: AsyncMock) -> list[AuditLog]:
    return [c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], AuditLog)]


# ---------------------------------------------------------------------------
# Reschedule
# ---------------------------------------------------------------------------


async def test_reschedule_match_updates_kickoff_and_sets_original(client: AsyncClient) -> None:
    admin = _make_admin()
    original = _now() + timedelta(days=1)
    new_kickoff = original + timedelta(hours=2)
    match = _make_match(kickoff=original)
    db = _stub_db([_scalar(match)])

    async with _override(db, admin):
        resp = await client.post(
            f"/api/v1/admin/matches/{match.id}/reschedule",
            json={"kickoff_utc": new_kickoff.isoformat()},
        )

    assert resp.status_code == 200, resp.text
    assert match.kickoff_utc == new_kickoff
    assert match.original_kickoff_utc == original
    rows = _audit_rows(db)
    assert len(rows) == 1
    assert rows[0].actor_type == ActorType.admin
    assert rows[0].action_type == ActionType.kickoff_changed


async def test_reschedule_preserves_existing_original_kickoff(client: AsyncClient) -> None:
    admin = _make_admin()
    first_original = _now() - timedelta(days=2)
    current_kickoff = _now() + timedelta(days=1)
    new_kickoff = current_kickoff + timedelta(hours=3)
    match = _make_match(kickoff=current_kickoff, original_kickoff=first_original)
    db = _stub_db([_scalar(match)])

    async with _override(db, admin):
        resp = await client.post(
            f"/api/v1/admin/matches/{match.id}/reschedule",
            json={"kickoff_utc": new_kickoff.isoformat()},
        )

    assert resp.status_code == 200
    assert match.original_kickoff_utc == first_original


async def test_reschedule_relocks_when_locked_and_new_kickoff_future(client: AsyncClient) -> None:
    admin = _make_admin()
    locked_at = _now() - timedelta(minutes=5)
    new_kickoff = _now() + timedelta(hours=2)
    match = _make_match(
        status=MatchStatus.locked,
        kickoff=_now() - timedelta(minutes=4),
        locked_at=locked_at,
    )
    db = _stub_db([_scalar(match)])

    async with _override(db, admin):
        resp = await client.post(
            f"/api/v1/admin/matches/{match.id}/reschedule",
            json={"kickoff_utc": new_kickoff.isoformat()},
        )

    assert resp.status_code == 200
    assert match.status == MatchStatus.scheduled
    assert match.locked_at is None


async def test_reschedule_match_not_found(client: AsyncClient) -> None:
    admin = _make_admin()
    db = _stub_db([_scalar(None)])

    async with _override(db, admin):
        resp = await client.post(
            f"/api/v1/admin/matches/{uuid.uuid4()}/reschedule",
            json={"kickoff_utc": _now().isoformat()},
        )

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Postpone
# ---------------------------------------------------------------------------


async def test_postpone_match_sets_status_and_reason(client: AsyncClient) -> None:
    admin = _make_admin()
    match = _make_match()
    db = _stub_db([_scalar(match)])

    async with _override(db, admin):
        resp = await client.post(
            f"/api/v1/admin/matches/{match.id}/postpone",
            json={"reason": "Severe weather"},
        )

    assert resp.status_code == 200
    assert match.status == MatchStatus.postponed
    assert match.postponed_reason == "Severe weather"
    rows = _audit_rows(db)
    assert len(rows) == 1
    assert rows[0].action_type == ActionType.match_postponed
    assert rows[0].changes == {"reason": "Severe weather"}


async def test_postpone_match_not_found(client: AsyncClient) -> None:
    admin = _make_admin()
    db = _stub_db([_scalar(None)])

    async with _override(db, admin):
        resp = await client.post(
            f"/api/v1/admin/matches/{uuid.uuid4()}/postpone",
            json={"reason": "x"},
        )

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Cancel
# ---------------------------------------------------------------------------


async def test_cancel_match_sets_status_and_writes_audit(client: AsyncClient) -> None:
    admin = _make_admin()
    match = _make_match()
    db = _stub_db([_scalar(match)])

    async with _override(db, admin):
        resp = await client.post(f"/api/v1/admin/matches/{match.id}/cancel")

    assert resp.status_code == 200
    assert match.status == MatchStatus.cancelled
    rows = _audit_rows(db)
    assert len(rows) == 1
    assert rows[0].action_type == ActionType.match_cancelled


async def test_cancel_match_not_found(client: AsyncClient) -> None:
    admin = _make_admin()
    db = _stub_db([_scalar(None)])

    async with _override(db, admin):
        resp = await client.post(f"/api/v1/admin/matches/{uuid.uuid4()}/cancel")

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Auth guard
# ---------------------------------------------------------------------------


async def test_admin_match_endpoints_require_auth(client: AsyncClient) -> None:
    resp = await client.post(
        f"/api/v1/admin/matches/{uuid.uuid4()}/cancel",
    )
    assert resp.status_code in (401, 403)
