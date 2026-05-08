"""Shared pytest fixtures.

Tests that require a live Postgres database depend on the ``db_engine``
fixture. They skip automatically when ``DATABASE_URL`` is not set so the
default unit-test job stays hermetic. CI provides a Postgres service plus
``alembic upgrade head`` before running these tests.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine

DATABASE_URL = os.environ.get("DATABASE_URL")


@pytest_asyncio.fixture(scope="session")
async def db_engine() -> AsyncIterator[AsyncEngine]:
    if not DATABASE_URL:
        pytest.skip("DATABASE_URL not set — Postgres-backed tests skipped")
    engine = create_async_engine(DATABASE_URL, future=True)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def db_conn(db_engine: AsyncEngine) -> AsyncIterator[AsyncConnection]:
    """A connection wrapped in a transaction that always rolls back.

    Tests should never see each other's writes — every test runs inside a
    SAVEPOINT-style transaction that is discarded on exit.
    """
    async with db_engine.connect() as conn:
        trans = await conn.begin()
        try:
            yield conn
        finally:
            await trans.rollback()
