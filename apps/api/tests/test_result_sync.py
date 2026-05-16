"""Unit tests for the auto result-fetch job (Phase 5.3).

These tests run without a database; the session is a MagicMock that
records the in-memory mutations the sync routine applies. Postgres-only
behaviour (the row-level lock, the scoring trigger) is exercised in the
integration job that runs against a real database in CI.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.models.match import Match, MatchStatus, ResultSource
from src.models.notification import (
    ActionType,
    ActorType,
    AuditLog,
    NotificationLog,
)
from src.services import result_sync
from src.services.football_data import (
    FDMatch,
    FDMatchesResponse,
    FDMatchStatus,
    FDScore,
    FDScoreLine,
    FDTeam,
    FootballDataServerError,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now() -> datetime:
    return datetime(2026, 6, 11, 18, 30, 0)


def _make_match(
    *,
    fd_id: int = 419665,
    status: MatchStatus = MatchStatus.locked,
    kickoff: datetime | None = None,
    result_source: ResultSource | None = None,
    original_kickoff: datetime | None = None,
) -> MagicMock:
    m = MagicMock(spec=Match)
    m.id = uuid.uuid4()
    m.football_data_match_id = fd_id
    m.status = status
    m.kickoff_utc = kickoff or _now() - timedelta(minutes=30)
    m.original_kickoff_utc = original_kickoff
    m.locked_at = None
    m.actual_home_score = None
    m.actual_away_score = None
    m.extra_time = False
    m.penalties = False
    m.result_source = result_source
    m.result_entered_by = None
    m.last_synced_at = None
    m.deleted_at = None
    return m


def _fd_match(
    *,
    fd_id: int = 419665,
    status: FDMatchStatus = FDMatchStatus.FINISHED,
    utc_date: datetime | None = None,
    home_score: int | None = 2,
    away_score: int | None = 1,
    duration: str = "REGULAR",
) -> FDMatch:
    return FDMatch(
        id=fd_id,
        utcDate=utc_date or datetime(2026, 6, 11, 18, 0, 0, tzinfo=UTC),
        status=status,
        stage="GROUP_STAGE",
        group="GROUP_A",
        homeTeam=FDTeam(id=1, name="Home", tla="HOM"),
        awayTeam=FDTeam(id=2, name="Away", tla="AWY"),
        score=FDScore(
            winner=None,
            duration=duration,
            fullTime=FDScoreLine(home=home_score, away=away_score),
        ),
    )


def _scalars(items: list[Any]) -> MagicMock:
    r = MagicMock()
    r.scalar_one_or_none.return_value = items[0] if items else None
    r.scalars.return_value.all.return_value = items
    return r


def _mock_session_factory(execute_results: list[MagicMock]) -> tuple[MagicMock, AsyncMock]:
    """Build a session_factory whose session.execute replays the given results."""
    session = AsyncMock()
    session.execute = AsyncMock(side_effect=execute_results)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.flush = AsyncMock()

    class _Ctx:
        async def __aenter__(self) -> AsyncMock:
            return session

        async def __aexit__(self, *a: object) -> None:
            return None

    factory = MagicMock(return_value=_Ctx())
    return factory, session


def _mock_client_factory(
    fd_matches: list[FDMatch] | None = None,
    raise_error: Exception | None = None,
) -> MagicMock:
    client = AsyncMock()
    if raise_error is not None:
        client.get_competition_matches = AsyncMock(side_effect=raise_error)
    else:
        client.get_competition_matches = AsyncMock(
            return_value=FDMatchesResponse(count=len(fd_matches or []), matches=fd_matches or [])
        )
    client.close = AsyncMock()
    return MagicMock(return_value=client)


@pytest.fixture(autouse=True)
def _reset_counter() -> None:
    result_sync.reset_failure_counter()


@pytest.fixture(autouse=True)
def _no_notify(monkeypatch: pytest.MonkeyPatch) -> None:
    with (
        patch("src.services.result_sync.notify_result_detected", new_callable=AsyncMock),
        patch("src.services.result_sync.notify_kickoff_changed", new_callable=AsyncMock),
        patch("src.services.result_sync.notify_match_postponed", new_callable=AsyncMock),
    ):
        yield


# ---------------------------------------------------------------------------
# FINISHED — new result
# ---------------------------------------------------------------------------


async def test_finished_match_writes_score_and_audit() -> None:
    match = _make_match(status=MatchStatus.locked)
    fd = _fd_match(status=FDMatchStatus.FINISHED, home_score=3, away_score=1)
    factory, session = _mock_session_factory([_scalars([match])])
    client_factory = _mock_client_factory([fd])

    count = await result_sync.sync_results(session_factory=factory, client_factory=client_factory)

    assert count == 1
    assert match.actual_home_score == 3
    assert match.actual_away_score == 1
    assert match.result_source == ResultSource.auto
    assert match.status == MatchStatus.completed
    assert match.result_entered_by is None
    audit = next(c.args[0] for c in session.add.call_args_list if isinstance(c.args[0], AuditLog))
    assert audit.actor_type == ActorType.system
    assert audit.action_type == ActionType.result_auto_fetched
    assert audit.target_id == match.id


# ---------------------------------------------------------------------------
# Idempotency — no-op when result_source is already set
# ---------------------------------------------------------------------------


async def test_finished_match_with_existing_result_is_noop() -> None:
    match = _make_match(status=MatchStatus.completed, result_source=ResultSource.manual)
    match.actual_home_score = 1
    match.actual_away_score = 0
    fd = _fd_match(status=FDMatchStatus.FINISHED, home_score=3, away_score=1)
    factory, session = _mock_session_factory([_scalars([match])])
    client_factory = _mock_client_factory([fd])

    count = await result_sync.sync_results(session_factory=factory, client_factory=client_factory)

    assert count == 0
    assert match.actual_home_score == 1
    assert match.actual_away_score == 0
    assert match.result_source == ResultSource.manual
    # Only the commit should have run; no audit row appended.
    assert not [c for c in session.add.call_args_list if isinstance(c.args[0], AuditLog)]


# ---------------------------------------------------------------------------
# Race condition — admin manual entry between rows
# ---------------------------------------------------------------------------


async def test_race_with_manual_entry_skipped() -> None:
    """If a manual entry won the row-lock race, we observe result_source != None."""
    match = _make_match(status=MatchStatus.completed, result_source=ResultSource.override)
    match.actual_home_score = 2
    match.actual_away_score = 2
    fd = _fd_match(status=FDMatchStatus.FINISHED, home_score=4, away_score=0)
    factory, session = _mock_session_factory([_scalars([match])])
    client_factory = _mock_client_factory([fd])

    count = await result_sync.sync_results(session_factory=factory, client_factory=client_factory)

    assert count == 0
    # Admin's override stands.
    assert match.result_source == ResultSource.override
    assert match.actual_home_score == 2


# ---------------------------------------------------------------------------
# POSTPONED + CANCELLED + IN_PLAY status deltas
# ---------------------------------------------------------------------------


async def test_postponed_transitions_status_and_audits() -> None:
    match = _make_match(status=MatchStatus.scheduled)
    fd = _fd_match(status=FDMatchStatus.POSTPONED, home_score=None, away_score=None)
    factory, session = _mock_session_factory([_scalars([match])])
    client_factory = _mock_client_factory([fd])

    count = await result_sync.sync_results(session_factory=factory, client_factory=client_factory)

    assert count == 1
    assert match.status == MatchStatus.postponed
    audit = next(c.args[0] for c in session.add.call_args_list if isinstance(c.args[0], AuditLog))
    assert audit.action_type == ActionType.match_postponed
    assert audit.actor_type == ActorType.system


async def test_cancelled_transitions_status() -> None:
    match = _make_match(status=MatchStatus.scheduled)
    fd = _fd_match(status=FDMatchStatus.CANCELLED, home_score=None, away_score=None)
    factory, _ = _mock_session_factory([_scalars([match])])
    client_factory = _mock_client_factory([fd])

    await result_sync.sync_results(session_factory=factory, client_factory=client_factory)

    assert match.status == MatchStatus.cancelled


async def test_in_play_transitions_locked_to_live() -> None:
    match = _make_match(status=MatchStatus.locked)
    fd = _fd_match(status=FDMatchStatus.IN_PLAY, home_score=None, away_score=None)
    factory, _ = _mock_session_factory([_scalars([match])])
    client_factory = _mock_client_factory([fd])

    count = await result_sync.sync_results(session_factory=factory, client_factory=client_factory)

    assert count == 1
    assert match.status == MatchStatus.live


# ---------------------------------------------------------------------------
# Kickoff change — drift detection + lock-job re-registration
# ---------------------------------------------------------------------------


async def test_kickoff_change_updates_kickoff_and_preserves_original() -> None:
    original = datetime(2026, 6, 15, 18, 0, 0)
    new_kickoff = datetime(2026, 6, 15, 20, 0, 0)
    match = _make_match(status=MatchStatus.scheduled, kickoff=original)
    fd = _fd_match(
        status=FDMatchStatus.TIMED,
        utc_date=new_kickoff.replace(tzinfo=UTC),
        home_score=None,
        away_score=None,
    )
    factory, session = _mock_session_factory([_scalars([match])])
    client_factory = _mock_client_factory([fd])

    count = await result_sync.sync_results(session_factory=factory, client_factory=client_factory)

    assert count == 1
    # The periodic lock_due_matches job is the lock-job mechanism — it
    # picks up the new kickoff_utc on its next tick. That is the
    # "re-registration" path: we update the DB row only.
    assert match.kickoff_utc == new_kickoff
    assert match.original_kickoff_utc == original
    audit = next(c.args[0] for c in session.add.call_args_list if isinstance(c.args[0], AuditLog))
    assert audit.action_type == ActionType.kickoff_changed
    assert audit.changes is not None
    assert audit.changes["new_kickoff_utc"] == new_kickoff.isoformat()
    assert audit.changes["old_kickoff_utc"] == original.isoformat()


async def test_kickoff_unchanged_is_noop() -> None:
    kickoff = datetime(2026, 6, 15, 18, 0, 0)
    match = _make_match(status=MatchStatus.scheduled, kickoff=kickoff)
    fd = _fd_match(
        status=FDMatchStatus.TIMED,
        utc_date=kickoff.replace(tzinfo=UTC),
        home_score=None,
        away_score=None,
    )
    factory, session = _mock_session_factory([_scalars([match])])
    client_factory = _mock_client_factory([fd])

    count = await result_sync.sync_results(session_factory=factory, client_factory=client_factory)

    assert count == 0
    assert match.kickoff_utc == kickoff
    assert not [c for c in session.add.call_args_list if isinstance(c.args[0], AuditLog)]


# ---------------------------------------------------------------------------
# Failure counter + admin alert
# ---------------------------------------------------------------------------


async def test_api_failure_increments_counter_and_writes_audit() -> None:
    # No admin profiles returned, so alert path inserts nothing for admins.
    factory, session = _mock_session_factory([_scalars([])])
    client_factory = _mock_client_factory(raise_error=FootballDataServerError("503: maintenance"))

    count = await result_sync.sync_results(session_factory=factory, client_factory=client_factory)

    assert count == 0
    audit = next(c.args[0] for c in session.add.call_args_list if isinstance(c.args[0], AuditLog))
    assert audit.action_type == ActionType.sync_failed
    assert audit.actor_type == ActorType.system


async def test_three_consecutive_failures_alerts_admins() -> None:
    err = FootballDataServerError("503")

    for _ in range(2):
        factory, _ = _mock_session_factory([_scalars([])])
        client_factory = _mock_client_factory(raise_error=err)
        await result_sync.sync_results(session_factory=factory, client_factory=client_factory)

    # Third failure should trigger notify_auto_sync_failed.
    factory, _ = _mock_session_factory([_scalars([])])
    client_factory = _mock_client_factory(raise_error=err)
    _alert_patch = "src.services.result_sync.notify_auto_sync_failed"
    with patch(_alert_patch, new_callable=AsyncMock) as mock_alert:
        await result_sync.sync_results(session_factory=factory, client_factory=client_factory)

    mock_alert.assert_awaited_once()
    assert "503" in mock_alert.call_args.args[1]


async def test_successful_sync_resets_failure_counter() -> None:
    # Fail twice, then succeed → counter back to 0.
    err = FootballDataServerError("503")
    for _ in range(2):
        factory, _ = _mock_session_factory([_scalars([])])
        client_factory = _mock_client_factory(raise_error=err)
        await result_sync.sync_results(session_factory=factory, client_factory=client_factory)

    factory, _ = _mock_session_factory([_scalars([])])
    client_factory = _mock_client_factory([])
    await result_sync.sync_results(session_factory=factory, client_factory=client_factory)

    # Now another failure should be the *first* in a new streak, not the third.
    factory, session = _mock_session_factory([_scalars([])])
    client_factory = _mock_client_factory(raise_error=err)
    await result_sync.sync_results(session_factory=factory, client_factory=client_factory)
    notifications = [
        c.args[0] for c in session.add.call_args_list if isinstance(c.args[0], NotificationLog)
    ]
    assert notifications == []


# ---------------------------------------------------------------------------
# Unknown match — silently skipped
# ---------------------------------------------------------------------------


async def test_unknown_fd_match_id_is_skipped() -> None:
    fd = _fd_match(status=FDMatchStatus.FINISHED)
    factory, session = _mock_session_factory([_scalars([])])
    client_factory = _mock_client_factory([fd])

    count = await result_sync.sync_results(session_factory=factory, client_factory=client_factory)

    assert count == 0
    # No audit rows written for unknown matches.
    assert not [c for c in session.add.call_args_list if isinstance(c.args[0], AuditLog)]


# ---------------------------------------------------------------------------
# Scheduler registration
# ---------------------------------------------------------------------------


def test_scheduler_registers_5_minute_sync_job() -> None:
    from src.scheduler import create_scheduler

    scheduler = create_scheduler()
    try:
        job = scheduler.get_job("sync_results")
        assert job is not None
        assert job.trigger.interval == timedelta(minutes=5)
        assert job.coalesce is True
        assert job.max_instances == 1
    finally:
        if scheduler.running:
            scheduler.shutdown(wait=False)
