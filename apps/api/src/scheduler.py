"""Background scheduler for time-driven match transitions.

Runs a minute-by-minute job that locks any match whose kickoff has arrived,
and writes a corresponding audit_log row for each lock transition.
"""

from __future__ import annotations

from datetime import UTC, datetime

import structlog
from apscheduler.schedulers.asyncio import (  # type: ignore[import-untyped,unused-ignore]
    AsyncIOScheduler,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.config import settings
from src.database import AsyncSessionLocal
from src.models.match import Match, MatchStatus
from src.models.notification import ActionType, ActorType, AuditLog
from src.services.backup import create_backup
from src.services.notification_triggers import (
    MatchUpdate,
    check_deadline_warnings,
    notify_match_locked,
)
from src.services.result_sync import sync_results

log: structlog.stdlib.BoundLogger = structlog.get_logger(__name__)


def _utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


async def lock_due_matches(
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
    now: datetime | None = None,
) -> int:
    """Transition any scheduled match whose kickoff has passed to ``locked``.

    Returns the number of matches that were locked. Each transition writes
    an ``audit_log`` row with action_type=predictions_locked, actor_type=system.
    """
    current = now if now is not None else _utc_now()
    locked_count = 0

    async with session_factory() as session:
        result = await session.execute(
            select(Match).where(
                Match.status == MatchStatus.scheduled,
                Match.kickoff_utc <= current,
                Match.deleted_at.is_(None),
            )
        )
        matches = list(result.scalars().all())

        locked_updates: list[MatchUpdate] = []
        for match in matches:
            match.status = MatchStatus.locked
            match.locked_at = current
            session.add(
                AuditLog(
                    actor_id=None,
                    actor_type=ActorType.system,
                    action_type=ActionType.predictions_locked,
                    target_table="matches",
                    target_id=match.id,
                    changes={"locked_at": current.isoformat()},
                )
            )
            locked_updates.append(
                MatchUpdate(
                    event_type="match_locked",
                    match_id=match.id,
                    stage=match.stage.value,
                    home_team_id=match.home_team_id,
                    away_team_id=match.away_team_id,
                    home_placeholder=match.home_team_placeholder,
                    away_placeholder=match.away_team_placeholder,
                )
            )
            locked_count += 1

        if locked_count:
            await session.commit()
            log.info("matches locked", count=locked_count)
            for upd in locked_updates:
                await notify_match_locked(session, upd)
            await session.commit()

    return locked_count


async def run_scheduled_backup() -> None:
    """Daily backup job — runs at 03:00 UTC."""
    try:
        info = await create_backup(settings.backup_dir, settings.database_url)
        log.info("scheduled backup complete", filename=info.filename, size_bytes=info.size_bytes)
    except Exception:
        log.exception("scheduled backup failed")


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        lock_due_matches,
        trigger="interval",
        minutes=1,
        id="lock_due_matches",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    scheduler.add_job(
        sync_results,
        trigger="interval",
        minutes=5,
        id="sync_results",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    scheduler.add_job(
        check_deadline_warnings,
        kwargs={"session_factory": AsyncSessionLocal},
        trigger="interval",
        minutes=1,
        id="deadline_warnings",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    scheduler.add_job(
        run_scheduled_backup,
        trigger="cron",
        hour=3,
        minute=0,
        id="daily_backup",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    return scheduler
