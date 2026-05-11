"""Auto result-fetch job (Phase 5.3).

Runs every 5 minutes (driven by the APScheduler IntervalTrigger registered
in `src.scheduler`), pulls the WC competition feed from football-data.org,
and applies a status delta per match:

* ``FINISHED`` → score + status=completed + result_source=auto (skipped if a
  manual or override result already exists).
* ``IN_PLAY``/``PAUSED``/``SUSPENDED`` → status=live.
* ``POSTPONED`` → status=postponed.
* ``CANCELLED`` → status=cancelled.
* ``TIMED``/``SCHEDULED`` → kickoff drift detection — when the upstream
  ``utcDate`` differs from our ``kickoff_utc`` we update kickoff_utc and
  preserve the original. The periodic ``lock_due_matches`` job picks up
  the new kickoff naturally (no per-match job to re-register).

Each row is taken under a ``SELECT ... FOR UPDATE`` lock so simultaneous
admin manual entry cannot race the sync. The job is idempotent — a second
run with unchanged feed is a no-op because we skip matches where
``result_source IS NOT NULL`` for FINISHED handling and avoid redundant
writes elsewhere.

On three consecutive API failures we write an ``auto_sync_failed``
notification for every admin and an ``audit_log`` row with
``action_type = sync_failed``. The counter resets on the next successful
run.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.config import settings
from src.database import AsyncSessionLocal
from src.models.match import Match, MatchStatus, ResultSource
from src.models.notification import (
    ActionType,
    ActorType,
    AuditLog,
    DeliveryStatus,
    NotificationLog,
    NotificationType,
)
from src.models.profile import PlayerRole, Profile
from src.services.football_data import (
    FDMatch,
    FDMatchStatus,
    FootballDataClient,
    FootballDataError,
)

log: structlog.stdlib.BoundLogger = structlog.get_logger(__name__)


_LIVE_STATUSES = {
    FDMatchStatus.IN_PLAY,
    FDMatchStatus.PAUSED,
    FDMatchStatus.SUSPENDED,
}
_SCHEDULED_STATUSES = {FDMatchStatus.SCHEDULED, FDMatchStatus.TIMED}

_FAILURE_ALERT_THRESHOLD = 3


# Module-level counter survives across job invocations within a single
# process. Reset to 0 on every successful sync. We alert exactly once
# per breach by checking equality with the threshold.
_consecutive_failures = 0


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _strip_tz(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(UTC).replace(tzinfo=None)


# Factory aliases so tests can inject mock clients without touching the real one.
ClientFactory = Callable[[], FootballDataClient]
SessionFactory = async_sessionmaker[AsyncSession]


def _default_client_factory() -> FootballDataClient:
    return FootballDataClient(api_key=settings.football_data_api_key)


async def sync_results(
    session_factory: SessionFactory = AsyncSessionLocal,
    client_factory: ClientFactory = _default_client_factory,
    fetcher: Callable[[FootballDataClient], Awaitable[list[FDMatch]]] | None = None,
) -> int:
    """Run one auto-sync cycle.

    Returns the number of matches that were updated. Failures are logged
    and counted; the function does not re-raise so an APScheduler-driven
    invocation never terminates the scheduler.
    """
    global _consecutive_failures

    client = client_factory()
    try:
        if fetcher is None:
            response = await client.get_competition_matches()
            fd_matches = response.matches
        else:
            fd_matches = await fetcher(client)
    except FootballDataError as exc:
        await _record_failure(session_factory, str(exc))
        return 0
    finally:
        await client.close()

    updates = 0
    async with session_factory() as session:
        for fd_match in fd_matches:
            if await _sync_one_match(session, fd_match):
                updates += 1
        await session.commit()

    _consecutive_failures = 0
    log.info("auto sync complete", updated=updates, total=len(fd_matches))
    return updates


async def _sync_one_match(session: AsyncSession, fd_match: FDMatch) -> bool:
    """Apply the feed's view of a single match. Returns True when changed."""
    row = await session.execute(
        select(Match)
        .where(
            Match.football_data_match_id == fd_match.id,
            Match.deleted_at.is_(None),
        )
        .with_for_update()
    )
    match = row.scalar_one_or_none()
    if match is None:
        # Match isn't seeded locally — happens for friendly fixtures the
        # feed includes but we don't track. Silently ignore.
        return False

    now = _now()
    fd_status = fd_match.status

    if fd_status == FDMatchStatus.FINISHED:
        return _apply_finished(session, match, fd_match, now)

    if fd_status == FDMatchStatus.POSTPONED:
        return _apply_postponed(session, match, now)

    if fd_status == FDMatchStatus.CANCELLED:
        return _apply_cancelled(session, match, now)

    if fd_status in _LIVE_STATUSES:
        return _apply_live(session, match, now)

    if fd_status in _SCHEDULED_STATUSES:
        return _apply_kickoff_drift(session, match, fd_match, now)

    return False


def _apply_finished(session: AsyncSession, match: Match, fd_match: FDMatch, now: datetime) -> bool:
    # Idempotent: a prior auto/manual/override write owns the result.
    if match.result_source is not None:
        return False

    home = fd_match.score.fullTime.home
    away = fd_match.score.fullTime.away
    if home is None or away is None:
        log.warning("finished match missing score", fd_id=fd_match.id)
        return False

    # Match must be locked/live/completed to accept a result, mirroring
    # the admin manual entry validation in routers.admin.
    if match.status not in {MatchStatus.locked, MatchStatus.live, MatchStatus.completed}:
        log.warning(
            "finished match has unexpected local status",
            fd_id=fd_match.id,
            local_status=match.status,
        )
        return False

    match.actual_home_score = home
    match.actual_away_score = away
    match.extra_time = fd_match.score.duration in {"EXTRA_TIME", "PENALTY_SHOOTOUT"}
    match.penalties = fd_match.score.duration == "PENALTY_SHOOTOUT"
    match.result_source = ResultSource.auto
    match.result_entered_by = None
    match.status = MatchStatus.completed
    match.last_synced_at = now

    session.add(
        AuditLog(
            actor_id=None,
            actor_type=ActorType.system,
            action_type=ActionType.result_auto_fetched,
            target_table="matches",
            target_id=match.id,
            changes={
                "actual_home_score": home,
                "actual_away_score": away,
                "result_source": ResultSource.auto.value,
            },
        )
    )
    return True


def _apply_postponed(session: AsyncSession, match: Match, now: datetime) -> bool:
    if match.status in {MatchStatus.postponed, MatchStatus.completed, MatchStatus.cancelled}:
        # Don't undo a completed match or repeat a postponement.
        match.last_synced_at = now
        return False
    match.status = MatchStatus.postponed
    match.last_synced_at = now
    session.add(
        AuditLog(
            actor_id=None,
            actor_type=ActorType.system,
            action_type=ActionType.match_postponed,
            target_table="matches",
            target_id=match.id,
            changes={"source": "football_data"},
        )
    )
    return True


def _apply_cancelled(session: AsyncSession, match: Match, now: datetime) -> bool:
    if match.status in {MatchStatus.cancelled, MatchStatus.completed}:
        match.last_synced_at = now
        return False
    match.status = MatchStatus.cancelled
    match.last_synced_at = now
    session.add(
        AuditLog(
            actor_id=None,
            actor_type=ActorType.system,
            action_type=ActionType.match_cancelled,
            target_table="matches",
            target_id=match.id,
            changes={"source": "football_data"},
        )
    )
    return True


def _apply_live(session: AsyncSession, match: Match, now: datetime) -> bool:
    if match.status == MatchStatus.live:
        match.last_synced_at = now
        return False
    if match.status not in {MatchStatus.locked, MatchStatus.scheduled}:
        # Already completed/postponed/cancelled — feed must catch up.
        match.last_synced_at = now
        return False
    match.status = MatchStatus.live
    match.last_synced_at = now
    return True


def _apply_kickoff_drift(
    session: AsyncSession, match: Match, fd_match: FDMatch, now: datetime
) -> bool:
    if match.status != MatchStatus.scheduled:
        # We don't shift kickoffs for matches that are already locked/live/etc.
        match.last_synced_at = now
        return False
    new_kickoff = _strip_tz(fd_match.utcDate)
    if new_kickoff == match.kickoff_utc:
        match.last_synced_at = now
        return False

    old_kickoff = match.kickoff_utc
    if match.original_kickoff_utc is None:
        match.original_kickoff_utc = old_kickoff
    match.kickoff_utc = new_kickoff
    match.last_synced_at = now

    session.add(
        AuditLog(
            actor_id=None,
            actor_type=ActorType.system,
            action_type=ActionType.kickoff_changed,
            target_table="matches",
            target_id=match.id,
            changes={
                "old_kickoff_utc": old_kickoff.isoformat(),
                "new_kickoff_utc": new_kickoff.isoformat(),
                "source": "football_data",
            },
        )
    )
    return True


async def _record_failure(session_factory: SessionFactory, reason: str) -> None:
    global _consecutive_failures
    _consecutive_failures += 1
    log.warning(
        "auto sync failed",
        consecutive_failures=_consecutive_failures,
        reason=reason,
    )

    async with session_factory() as session:
        session.add(
            AuditLog(
                actor_id=None,
                actor_type=ActorType.system,
                action_type=ActionType.sync_failed,
                target_table="matches",
                target_id=None,
                changes={
                    "reason": reason,
                    "consecutive_failures": _consecutive_failures,
                },
            )
        )

        if _consecutive_failures == _FAILURE_ALERT_THRESHOLD:
            admins = await session.execute(
                select(Profile).where(
                    Profile.role == PlayerRole.admin,
                    Profile.deleted_at.is_(None),
                )
            )
            now = _now()
            for admin in admins.scalars().all():
                session.add(
                    NotificationLog(
                        player_id=admin.id,
                        notification_type=NotificationType.auto_sync_failed,
                        title="Result auto-sync is failing",
                        body=(
                            f"The football-data.org sync has failed "
                            f"{_FAILURE_ALERT_THRESHOLD} consecutive times. "
                            f"Last error: {reason[:200]}"
                        ),
                        match_id=None,
                        sent_at=now,
                        delivery_status=DeliveryStatus.sent,
                    )
                )

        await session.commit()


def reset_failure_counter() -> None:
    """Test helper — clear the in-process consecutive-failure counter."""
    global _consecutive_failures
    _consecutive_failures = 0
