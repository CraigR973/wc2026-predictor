"""Tests for Phase 11.4 backup endpoints."""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from src.auth import require_admin
from src.main import app
from src.models.profile import PlayerRole, Profile
from src.services.backup import BackupInfo


def _make_admin() -> Profile:
    p = MagicMock(spec=Profile)
    p.id = uuid.uuid4()
    p.display_name = "Admin"
    p.role = PlayerRole.admin
    p.timezone = "UTC"
    p.deleted_at = None
    return p


def _mock_db() -> AsyncGenerator[AsyncMock, None]:
    async def _gen() -> AsyncGenerator[AsyncMock, None]:
        yield AsyncMock()

    return _gen()


_SAMPLE_INFO = BackupInfo(
    filename="wc2026_20260610_030000.sql",
    size_bytes=102_400,
    created_at=datetime(2026, 6, 10, 3, 0, 0, tzinfo=UTC),
)


# ---------------------------------------------------------------------------
# POST /api/v1/admin/backup
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_trigger_backup_success() -> None:
    admin = _make_admin()
    app.dependency_overrides[require_admin] = lambda: admin

    with patch(
        "src.routers.admin.create_backup",
        new_callable=AsyncMock,
        return_value=_SAMPLE_INFO,
    ):
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/v1/admin/backup")
        finally:
            app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 201
    data = resp.json()
    assert data["filename"] == "wc2026_20260610_030000.sql"
    assert data["size_bytes"] == 102_400


@pytest.mark.asyncio
async def test_trigger_backup_pg_dump_failure() -> None:
    admin = _make_admin()
    app.dependency_overrides[require_admin] = lambda: admin

    with patch(
        "src.routers.admin.create_backup",
        new_callable=AsyncMock,
        side_effect=RuntimeError("pg_dump not found"),
    ):
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/v1/admin/backup")
        finally:
            app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 500
    assert "pg_dump not found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_trigger_backup_requires_admin() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/admin/backup")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/v1/admin/backups
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_backups_empty() -> None:
    admin = _make_admin()
    app.dependency_overrides[require_admin] = lambda: admin

    with patch("src.routers.admin.list_backups", return_value=[]):
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/admin/backups")
        finally:
            app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_backups_returns_entries() -> None:
    admin = _make_admin()
    app.dependency_overrides[require_admin] = lambda: admin

    info2 = BackupInfo(
        filename="wc2026_20260609_030000.sql",
        size_bytes=98_304,
        created_at=datetime(2026, 6, 9, 3, 0, 0, tzinfo=UTC),
    )

    with patch("src.routers.admin.list_backups", return_value=[_SAMPLE_INFO, info2]):
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/admin/backups")
        finally:
            app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["filename"] == "wc2026_20260610_030000.sql"


@pytest.mark.asyncio
async def test_list_backups_requires_admin() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/admin/backups")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/v1/admin/backups/{filename}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_download_backup_not_found() -> None:
    admin = _make_admin()
    app.dependency_overrides[require_admin] = lambda: admin

    with patch(
        "src.routers.admin.resolve_backup_path",
        return_value=Path("/tmp/wc2026_backups/wc2026_20260610_030000.sql"),
    ):
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/admin/backups/wc2026_20260610_030000.sql")
        finally:
            app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_download_backup_invalid_filename() -> None:
    admin = _make_admin()
    app.dependency_overrides[require_admin] = lambda: admin

    # filename reaches the endpoint but fails our regex validation
    with patch(
        "src.routers.admin.resolve_backup_path",
        side_effect=ValueError("Invalid backup filename"),
    ):
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/v1/admin/backups/invalid-backup-file.sql")
        finally:
            app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_download_backup_requires_admin() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/admin/backups/wc2026_20260610_030000.sql")
    assert resp.status_code == 401
