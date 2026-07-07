"""Auto result-fetch job (Phase 5.3).

Runs every 5 minutes (driven by the APScheduler IntervalTrigger registered
in `src.scheduler`), pulls the WC competition feed from football-data.org,
and applies a status delta per match:

* ``FINISHED`` → score + status=completed + result_source=auto (skipped if a
  manual or override result already exists).
* ``IN_PLAY``/``LIVE``/``PAUSED``/``SUSPENDED`` → status=live.
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

After any finished result is applied we call
:func:`sync_knockout_bracket` so the next knockout round's seeded
placeholder rows resolve to real teams on this — the tournament's primary,
automatic — path. Without it R16+ fixtures stayed on ``TBD`` until an admin
manually entered a result (only the manual admin paths called it before).
The bracket resolver is idempotent and monotonic, so the call is a cheap
no-op when nothing new has settled.

Fixtures are matched to the feed by ``football_data_match_id``, which is
orientation-independent — the feed's home/away can disagree with the order we
store. Every FINISHED/LIVE write is therefore reconciled against the feed by
team identity (``_resolve_orientation``): an aligned fixture writes positionally,
a reversed one swaps the score tuples and maps the advancer by identity, and a
genuine mismatch (or unresolved/placeholder teams) refuses to write and audits a
``sync_failed`` row *without* tripping the consecutive-failure counter. This
guarantees a stored orientation can never persist a scoreline backwards or
advance the wrong team (the R16 match-95 incident).

On three consecutive API failures we write an ``auto_sync_failed``
notification for every admin and an ``audit_log`` row with
``action_type = sync_failed``. The counter resets on the next successful
run.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from enum import StrEnum

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.config import settings
from src.database import AsyncSessionLocal
from src.models.match import Match, MatchStatus, ResultSource
from src.models.notification import (
    ActionType,
    ActorType,
    AuditLog,
)
from src.models.team import Team, TournamentStage
from src.services.football_data import (
    FDMatch,
    FDMatchStatus,
    FDScore,
    FDScoreLine,
    FDTeam,
    FootballDataClient,
    FootballDataError,
)
from src.services.knockout_advancement import sync_knockout_bracket
from src.services.notification_triggers import (
    MatchUpdate,
    notify_auto_sync_failed,
    notify_kickoff_changed,
    notify_match_postponed,
    notify_result_detected,
)

log: structlog.stdlib.BoundLogger = structlog.get_logger(__name__)


_LIVE_STATUSES = {
    FDMatchStatus.IN_PLAY,
    FDMatchStatus.LIVE,
    FDMatchStatus.PAUSED,
    FDMatchStatus.SUSPENDED,
}
_SCHEDULED_STATUSES = {FDMatchStatus.SCHEDULED, FDMatchStatus.TIMED}
_FD_STAGE_TO_LOCAL_STAGE = {
    "GROUP_STAGE": TournamentStage.group,
    "LAST_32": TournamentStage.r32,
    "ROUND_OF_32": TournamentStage.r32,
    "PRELIMINARY_ROUND": TournamentStage.r32,
    "LAST_16": TournamentStage.r16,
    "ROUND_OF_16": TournamentStage.r16,
    "QUARTER_FINALS": TournamentStage.qf,
    "SEMI_FINALS": TournamentStage.sf,
    "THIRD_PLACE": TournamentStage.third_place,
    "FINAL": TournamentStage.final,
}


class _Orientation(StrEnum):
    """How our stored home/away maps onto the feed's for a resolved fixture.

    A fixture is matched by ``football_data_match_id`` (orientation-independent),
    so the feed's home/away can disagree with the order we store. Every score /
    advancer write is otherwise positional, so a disagreement would persist the
    scoreline backwards or advance the wrong team (the R16 match-95 incident).
    """

    aligned = "aligned"  # feed home == our home — write positionally (no-op)
    reversed_ = "reversed"  # feed home == our away — swap before writing
    mismatch = "mismatch"  # feed pair matches neither of ours — fail-safe, refuse


_FAILURE_ALERT_THRESHOLD = 3

# How long after finalization an *auto* result may still be revised by the feed.
# football-data can serve a transient/incomplete payload right at full time (e.g.
# the extra-time aggregate before ``regularTime`` is populated — the Belgium–Senegal
# R32 incident, 2026-07-01) and correct it minutes later. Our finished-write is
# otherwise idempotent, so without this the first (possibly wrong) read is frozen.
# Bounded so a late upstream revision of a long-settled match can't reshuffle the
# leaderboard days later. Manual/override results are never revised.
_AUTO_RESULT_REVISE_WINDOW = timedelta(minutes=30)

# Process-lifetime counter. None means "not yet loaded from DB this process".
# Persists across job invocations within a single process (fast path) and is
# recovered from the audit log after a restart (DB path).
_consecutive_failures: int | None = None


async def _load_consecutive_failures(session: AsyncSession) -> int:
    """Return the current failure count, loading from DB on first call."""
    global _consecutive_failures
    if _consecutive_failures is not None:
        return _consecutive_failures
    # DB recovery: count sync_failed rows since the last sync_triggered row.
    last_success_ts = await session.scalar(
        select(AuditLog.timestamp)
        .where(AuditLog.action_type == ActionType.sync_triggered)
        .order_by(AuditLog.timestamp.desc())
        .limit(1)
    )
    q = select(func.count()).where(AuditLog.action_type == ActionType.sync_failed)
    if last_success_ts is not None:
        q = q.where(AuditLog.timestamp > last_success_ts)
    _consecutive_failures = (await session.scalar(q)) or 0
    return _consecutive_failures


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
    match_updates: list[MatchUpdate] = []
    async with session_factory() as session:
        for fd_match in fd_matches:
            changed, update = await _sync_one_match(session, fd_match)
            if changed:
                updates += 1
            if update:
                match_updates.append(update)
        await session.commit()

        # Dispatch push notifications after commit so leaderboard snapshots
        # (written by the DB scoring trigger) are visible to the session.
        for upd in match_updates:
            try:
                if upd.event_type == "finished":
                    await notify_result_detected(session, upd)
                elif upd.event_type == "postponed":
                    await notify_match_postponed(session, upd)
                elif upd.event_type == "kickoff_changed":
                    await notify_kickoff_changed(session, upd)
            except Exception:
                log.exception(
                    "notify failed",
                    event_type=upd.event_type,
                    match_id=str(upd.match_id),
                )
        if match_updates:
            await session.commit()

        # Resolve seeded knockout placeholders into real teams whenever a
        # result has settled — group results fill the R32, knockout results
        # cascade to the next round. This is the auto path's equivalent of the
        # ``_maybe_resync_knockout`` call the manual admin result endpoints make.
        # A ``result_corrected`` event can flip the advancer, so it re-resolves too.
        # Best-effort: bracket resolution must never abort the sync cycle.
        if any(u.event_type in {"finished", "result_corrected"} for u in match_updates):
            try:
                await sync_knockout_bracket(session)
            except Exception:
                log.exception("knockout bracket sync failed")

    global _consecutive_failures
    _consecutive_failures = 0
    log.info("auto sync complete", updated=updates, total=len(fd_matches))

    async with session_factory() as session:
        session.add(
            AuditLog(
                actor_id=None,
                actor_type=ActorType.system,
                action_type=ActionType.sync_triggered,
                target_table="matches",
                target_id=None,
                changes={"updated": updates, "total": len(fd_matches)},
            )
        )
        await session.commit()

    return updates


async def _sync_one_match(
    session: AsyncSession, fd_match: FDMatch
) -> tuple[bool, MatchUpdate | None]:
    """Apply the feed's view of a single match. Returns (changed, MatchUpdate|None)."""
    match = await _resolve_match(session, fd_match)
    if match is None:
        return False, None

    now = _now()
    fd_status = fd_match.status

    def _base(event_type: str, **extra: object) -> MatchUpdate:
        return MatchUpdate(
            event_type=event_type,
            match_id=match.id,
            stage=match.stage.value,
            home_team_id=match.home_team_id,
            away_team_id=match.away_team_id,
            home_placeholder=match.home_team_placeholder,
            away_placeholder=match.away_team_placeholder,
            **extra,  # type: ignore[arg-type]
        )

    if fd_status == FDMatchStatus.FINISHED:
        orientation = await _resolve_orientation(session, match, fd_match)
        if orientation is _Orientation.mismatch:
            _record_orientation_failure(session, match, fd_match)
            return False, None
        outcome = _apply_finished(
            session, match, fd_match, now, reversed_=orientation is _Orientation.reversed_
        )
        # "finished" fires the result-detected push; "result_corrected" is a silent
        # in-window revision (no re-notify) that still re-runs the bracket resolver.
        if outcome in {"finalized", "corrected"}:
            return True, _base(
                "finished" if outcome == "finalized" else "result_corrected",
                home_score=match.actual_home_score,
                away_score=match.actual_away_score,
            )
        return False, None

    if fd_status == FDMatchStatus.POSTPONED:
        if _apply_postponed(session, match, now):
            return True, _base("postponed")
        return False, None

    if fd_status == FDMatchStatus.CANCELLED:
        return _apply_cancelled(session, match, now), None

    if fd_status in _LIVE_STATUSES:
        orientation = await _resolve_orientation(session, match, fd_match)
        if orientation is _Orientation.mismatch:
            _record_orientation_failure(session, match, fd_match)
            return False, None
        return _apply_live(
            session, match, fd_match, now, reversed_=orientation is _Orientation.reversed_
        ), None

    if fd_status in _SCHEDULED_STATUSES:
        old_kickoff = match.kickoff_utc
        if _apply_kickoff_drift(session, match, fd_match, now):
            return True, _base(
                "kickoff_changed",
                old_kickoff=old_kickoff,
                new_kickoff=match.kickoff_utc,
            )
        return False, None

    return False, None


async def _resolve_match(session: AsyncSession, fd_match: FDMatch) -> Match | None:
    row = await session.execute(
        select(Match)
        .where(
            Match.football_data_match_id == fd_match.id,
            Match.deleted_at.is_(None),
        )
        .with_for_update()
    )
    match = row.scalar_one_or_none()
    if match is not None:
        return match
    return await _resolve_match_by_teams(session, fd_match)


async def _resolve_match_by_teams(session: AsyncSession, fd_match: FDMatch) -> Match | None:
    local_stage = _FD_STAGE_TO_LOCAL_STAGE.get(fd_match.stage)
    home_code = fd_match.homeTeam.tla
    away_code = fd_match.awayTeam.tla
    if local_stage is None or not home_code or not away_code:
        return None

    teams_row = await session.execute(select(Team).where(Team.code.in_([home_code, away_code])))
    teams = {team.code: team for team in teams_row.scalars().all()}
    home_team = teams.get(home_code)
    away_team = teams.get(away_code)
    if home_team is None or away_team is None:
        return None

    _maybe_backfill_team_id(home_team, fd_match.homeTeam.id)
    _maybe_backfill_team_id(away_team, fd_match.awayTeam.id)

    match_row = await session.execute(
        select(Match)
        .where(
            Match.stage == local_stage,
            Match.home_team_id == home_team.id,
            Match.away_team_id == away_team.id,
            Match.deleted_at.is_(None),
        )
        .with_for_update()
    )
    matches = list(match_row.scalars().all())
    if len(matches) != 1:
        if len(matches) > 1:
            log.warning(
                "ambiguous fallback match resolution",
                fd_id=fd_match.id,
                fd_stage=fd_match.stage,
                home_code=home_code,
                away_code=away_code,
                candidate_count=len(matches),
            )
        return None

    match = matches[0]
    _maybe_backfill_match_id(match, fd_match.id)
    return match


def _maybe_backfill_team_id(team: Team, fd_team_id: int | None) -> None:
    if fd_team_id is None:
        return
    if team.football_data_team_id is None:
        team.football_data_team_id = fd_team_id
        return
    if team.football_data_team_id != fd_team_id:
        log.warning(
            "football-data team id mismatch",
            team_code=team.code,
            current=team.football_data_team_id,
            incoming=fd_team_id,
        )


def _maybe_backfill_match_id(match: Match, fd_match_id: int) -> None:
    if match.football_data_match_id is None:
        match.football_data_match_id = fd_match_id
        return
    if match.football_data_match_id != fd_match_id:
        log.warning(
            "football-data match id mismatch",
            match_id=str(match.id),
            match_number=match.match_number,
            current=match.football_data_match_id,
            incoming=fd_match_id,
        )


def _same_team(team: Team, fd_team: FDTeam) -> bool:
    """Whether ``fd_team`` from the feed is our ``team``.

    TLA ↔ ``Team.code`` is the primary signal — it is always present upstream and
    needs no backfill. ``football_data_team_id`` is a corroborating fallback for
    the rare case where the feed omits a ``tla`` (both sides must carry an id).
    """
    if fd_team.tla and team.code:
        return fd_team.tla == team.code
    if team.football_data_team_id is not None and fd_team.id is not None:
        return team.football_data_team_id == fd_team.id
    return False


def _orientation(home_team: Team, away_team: Team, fd_match: FDMatch) -> _Orientation:
    """Reconcile our stored home/away against the feed's homeTeam/awayTeam."""
    fd_home, fd_away = fd_match.homeTeam, fd_match.awayTeam
    if _same_team(home_team, fd_home) and _same_team(away_team, fd_away):
        return _Orientation.aligned
    if _same_team(home_team, fd_away) and _same_team(away_team, fd_home):
        return _Orientation.reversed_
    return _Orientation.mismatch


async def _resolve_orientation(
    session: AsyncSession, match: Match, fd_match: FDMatch
) -> _Orientation:
    """Load the two team rows and compute the feed↔stored orientation.

    Issued only from the FINISHED/LIVE branches (``Match`` has no team
    relationship), so idle scheduled ticks add no query. Returns ``mismatch`` —
    the fail-safe — when the fixture's teams are unresolved/placeholder or the
    feed pair matches neither of ours; the caller then refuses to write and audits.
    """
    if match.home_team_id is None or match.away_team_id is None:
        return _Orientation.mismatch
    rows = await session.execute(
        select(Team).where(Team.id.in_([match.home_team_id, match.away_team_id]))
    )
    teams = {team.id: team for team in rows.scalars().all()}
    home_team = teams.get(match.home_team_id)
    away_team = teams.get(match.away_team_id)
    if home_team is None or away_team is None:
        return _Orientation.mismatch
    return _orientation(home_team, away_team, fd_match)


def _record_orientation_failure(session: AsyncSession, match: Match, fd_match: FDMatch) -> None:
    """Audit a per-match orientation anomaly without tripping the failure counter.

    A *reversed* fixture is corrected silently; this fires only on a genuine
    MISMATCH (or unresolved/placeholder teams) where we refuse to write. It is a
    per-match data anomaly, **not** a feed outage, so it deliberately leaves
    ``_consecutive_failures`` untouched (bumping it would alert admins about a
    perfectly healthy feed). The row omits the ``consecutive_failures`` key that
    :func:`_record_failure` writes — so the two are distinguishable — and it
    always precedes the cycle's ``sync_triggered`` row, so the DB recovery count
    in :func:`_load_consecutive_failures` never counts it.
    """
    log.warning(
        "auto sync orientation mismatch — refusing to write",
        fd_id=fd_match.id,
        match_id=str(match.id),
        match_number=match.match_number,
        our_home_team_id=str(match.home_team_id),
        our_away_team_id=str(match.away_team_id),
        fd_home_tla=fd_match.homeTeam.tla,
        fd_away_tla=fd_match.awayTeam.tla,
    )
    session.add(
        AuditLog(
            actor_id=None,
            actor_type=ActorType.system,
            action_type=ActionType.sync_failed,
            target_table="matches",
            target_id=match.id,
            changes={
                "reason": "orientation_mismatch",
                "fd_match_id": fd_match.id,
                "fd_home_tla": fd_match.homeTeam.tla,
                "fd_away_tla": fd_match.awayTeam.tla,
            },
        )
    )


def _has_goals(scoreline: FDScoreLine | None) -> bool:
    """True when football-data actually populated a sub-scoreline (even ``0-0``).

    A sub-score can be missing two ways — the field is absent (``None``) or present
    but empty (``{home: null, away: null}``). Both mean "no data"; a real ``0-0``
    (either side ``0``, not ``None``) counts as present.
    """
    return scoreline is not None and (scoreline.home is not None or scoreline.away is not None)


def _went_to_penalties(score: FDScore) -> bool:
    """Whether a shootout decided the tie.

    ``duration`` alone is NOT trusted: football-data can briefly serve
    ``duration="REGULAR"`` for a knockout it has already recorded extra-time /
    shootout goals for (observed in prod in the minutes after full time, before
    the feed self-corrects). The presence of ``penalties`` goals is authoritative.
    """
    return score.duration == "PENALTY_SHOOTOUT" or _has_goals(score.penalties)


def _went_to_extra_time(score: FDScore) -> bool:
    """Whether the tie went past 90 minutes (extra time and/or a shootout).

    As with :func:`_went_to_penalties`, recorded ``extraTime`` goals (or a
    shootout) override a ``duration`` string that still reads ``REGULAR``.
    """
    return (
        score.duration in {"EXTRA_TIME", "PENALTY_SHOOTOUT"}
        or _has_goals(score.extraTime)
        or _went_to_penalties(score)
    )


def _grading_scoreline(fd_match: FDMatch) -> tuple[int | None, int | None]:
    """The end-of-normal-time scoreline used to grade predictions.

    football-data's ``fullTime`` is the *aggregate* for knockout matches decided
    in extra time or on penalties (regulation + extra time + the shootout tally),
    so it is NOT the real scoreline. The score at the end of 90 minutes lives in
    ``regularTime`` — and that is what predictions are scored on (§7: extra time
    does not change the score for prediction purposes). For ordinary matches the
    feed omits ``regularTime`` and ``fullTime`` already holds the real score.

    When the feed omits ``regularTime`` but *has* recorded extra-time / shootout
    goals (the transient inconsistency where ``duration`` still reads ``REGULAR``),
    we back the 90-minute score out of the aggregate: ``fullTime − extraTime −
    penalties``. Without this the aggregate is stored as the scoreline and every
    prediction on the match is graded against the wrong result.
    """
    score = fd_match.score
    rt = score.regularTime
    if rt is not None and rt.home is not None and rt.away is not None:
        return rt.home, rt.away

    home, away = score.fullTime.home, score.fullTime.away
    if home is None or away is None:
        return home, away
    if _went_to_extra_time(score):
        et, pens = score.extraTime, score.penalties
        home -= (et.home or 0) if et is not None else 0
        away -= (et.away or 0) if et is not None else 0
        home -= (pens.home or 0) if pens is not None else 0
        away -= (pens.away or 0) if pens is not None else 0
    return home, away


def _advancer_id(match: Match, fd_match: FDMatch, reversed_: bool = False) -> uuid.UUID | None:
    """The team that progressed, when a knockout went to extra time or penalties.

    A level 90-minute scoreline is broken downstream by ``penalty_winner_id`` —
    both the scoring trigger and the bracket resolver consult it — so we record
    the feed's winner there. This also covers an extra-time-decided win, whose
    ``regularTime`` is level even though the match produced a winner.

    ``reversed_`` reflects that our stored home/away is the feed's away/home, so
    the feed's ``HOME_TEAM`` winner is our *away* team (and vice-versa): map the
    winner to a team id by identity, never positionally.
    """
    if not _went_to_extra_time(fd_match.score):
        return None
    winner = fd_match.score.winner
    if winner == "HOME_TEAM":
        return match.away_team_id if reversed_ else match.home_team_id
    if winner == "AWAY_TEAM":
        return match.home_team_id if reversed_ else match.away_team_id
    return None


def _extra_time_scoreline(fd_match: FDMatch) -> tuple[int | None, int | None]:
    """The cumulative score at the end of extra time, for display.

    football-data reports ``extraTime`` as the goals scored *during* extra time,
    so the end-of-ET scoreline is ``(90-min score) + extraTime``. The 90-min base
    comes from :func:`_grading_scoreline`, so this still resolves when the feed
    omits ``regularTime`` and the base is derived from the aggregate. Returns
    ``(None, None)`` when the match did not reach extra time.
    """
    score = fd_match.score
    if not _went_to_extra_time(score):
        return None, None
    reg_home, reg_away = _grading_scoreline(fd_match)
    if reg_home is None or reg_away is None:
        return None, None
    et = score.extraTime
    et_home = et.home if et is not None and et.home is not None else 0
    et_away = et.away if et is not None and et.away is not None else 0
    return reg_home + et_home, reg_away + et_away


def _penalty_scoreline(fd_match: FDMatch) -> tuple[int | None, int | None]:
    """The penalty shootout tally, for display. ``(None, None)`` when no shootout."""
    if not _went_to_penalties(fd_match.score):
        return None, None
    pens = fd_match.score.penalties
    if pens is None:
        return None, None
    return pens.home, pens.away


def _write_result_fields(
    match: Match,
    home: int,
    away: int,
    extra_time: bool,
    penalties: bool,
    advancer: uuid.UUID | None,
    et_home: int | None,
    et_away: int | None,
    pen_home: int | None,
    pen_away: int | None,
) -> None:
    """Write the grading-relevant result columns.

    Shared by the first finalization and an in-window correction so the two paths
    can never drift into writing different field sets.
    """
    match.actual_home_score = home
    match.actual_away_score = away
    match.extra_time = extra_time
    match.penalties = penalties
    match.penalty_winner_id = advancer
    match.extra_time_home_score = et_home
    match.extra_time_away_score = et_away
    match.penalty_home_score = pen_home
    match.penalty_away_score = pen_away


def _apply_finished(
    session: AsyncSession,
    match: Match,
    fd_match: FDMatch,
    now: datetime,
    *,
    reversed_: bool = False,
) -> str | None:
    """Settle a FINISHED feed entry. Returns the event kind, or None for no-op.

    * ``"finalized"`` — first time we record this result (fires notifications).
    * ``"corrected"`` — an *auto* result revised inside the self-heal window
      because the feed changed the grading scoreline / advancer (no re-notify).
    * ``None`` — nothing to do: a bad payload, an unexpected local status, a
      manual/override result, a frozen (out-of-window) auto result, or an
      in-window auto result the feed left unchanged.
    """
    home, away = _grading_scoreline(fd_match)
    if home is None or away is None:
        log.warning("finished match missing score", fd_id=fd_match.id)
        return None

    # Derive the full target result once — used by both the first-write and the
    # correction path (via _write_result_fields).
    extra_time = _went_to_extra_time(fd_match.score)
    penalties = _went_to_penalties(fd_match.score)
    advancer = _advancer_id(match, fd_match, reversed_)
    et_home, et_away = _extra_time_scoreline(fd_match)
    pen_home, pen_away = _penalty_scoreline(fd_match)
    if reversed_:
        # Our stored home/away is the feed's away/home — flip every feed-order
        # tuple so the write (and the self-heal equality check below, which
        # compares against columns already in our orientation) lands correctly.
        # ``advancer`` is already mapped by identity above.
        home, away = away, home
        et_home, et_away = et_away, et_home
        pen_home, pen_away = pen_away, pen_home

    if match.result_source is None:
        # First finalization. Match must be locked/live/completed to accept a
        # result, mirroring the admin manual entry validation in routers.admin.
        if match.status not in {MatchStatus.locked, MatchStatus.live, MatchStatus.completed}:
            log.warning(
                "finished match has unexpected local status",
                fd_id=fd_match.id,
                local_status=match.status,
            )
            return None
        _write_result_fields(
            match, home, away, extra_time, penalties, advancer, et_home, et_away, pen_home, pen_away
        )
        match.result_source = ResultSource.auto
        match.result_entered_by = None
        match.status = MatchStatus.completed
        match.result_finalized_at = now
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
                    "penalty_winner_id": str(advancer) if advancer else None,
                    "result_source": ResultSource.auto.value,
                },
            )
        )
        return "finalized"

    # A result already exists. Only an *auto* result, still inside the self-heal
    # window, may be revised — never manual/override, and never a match settled
    # long enough ago that a late upstream revision would just be noise.
    if match.result_source is not ResultSource.auto:
        return None
    if match.result_finalized_at is None or now - match.result_finalized_at > (
        _AUTO_RESULT_REVISE_WINDOW
    ):
        return None

    match.last_synced_at = now
    if (
        match.actual_home_score == home
        and match.actual_away_score == away
        and match.extra_time == extra_time
        and match.penalties == penalties
        and match.penalty_winner_id == advancer
        and match.extra_time_home_score == et_home
        and match.extra_time_away_score == et_away
        and match.penalty_home_score == pen_home
        and match.penalty_away_score == pen_away
    ):
        return None  # feed unchanged — nothing to correct

    prev_home, prev_away = match.actual_home_score, match.actual_away_score
    _write_result_fields(
        match, home, away, extra_time, penalties, advancer, et_home, et_away, pen_home, pen_away
    )
    # result_finalized_at is deliberately NOT refreshed: the window is measured
    # from the first finalization, so a self-correcting feed cannot extend it.
    log.info(
        "auto result corrected within self-heal window",
        fd_id=fd_match.id,
        match_id=str(match.id),
        previous=f"{prev_home}-{prev_away}",
        corrected=f"{home}-{away}",
    )
    session.add(
        AuditLog(
            actor_id=None,
            actor_type=ActorType.system,
            action_type=ActionType.result_auto_fetched,
            target_table="matches",
            target_id=match.id,
            changes={
                "corrected": True,
                "previous_home_score": prev_home,
                "previous_away_score": prev_away,
                "actual_home_score": home,
                "actual_away_score": away,
                "penalty_winner_id": str(advancer) if advancer else None,
                "result_source": ResultSource.auto.value,
            },
        )
    )
    return "corrected"


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


def _apply_live(
    session: AsyncSession,
    match: Match,
    fd_match: FDMatch,
    now: datetime,
    *,
    reversed_: bool = False,
) -> bool:
    if match.status not in {MatchStatus.locked, MatchStatus.scheduled, MatchStatus.live}:
        # Already completed/postponed/cancelled — feed must catch up.
        match.last_synced_at = now
        return False

    changed = False
    if match.status != MatchStatus.live:
        match.status = MatchStatus.live
        changed = True

    # Write the running in-play score so predictions and the leaderboard update
    # live during the match. The feed reports fullTime=null before kickoff and a
    # real score (0-0 onward) once underway, so only write when both halves are
    # present — and only when the score actually moved, so no-op sync ticks
    # don't re-fire the scoring trigger. We deliberately leave result_source
    # NULL: the result isn't final until FINISHED, so the finish handler treats
    # the final whistle as the first finalization (settling status / extra_time /
    # penalties and opening the self-heal window) rather than an in-window
    # correction of an already-settled result.
    home, away = _grading_scoreline(fd_match)
    if reversed_:
        # Store live scores in our orientation, not the feed's (see _apply_finished).
        home, away = away, home
    if (
        home is not None
        and away is not None
        and (match.actual_home_score != home or match.actual_away_score != away)
    ):
        match.actual_home_score = home
        match.actual_away_score = away
        changed = True

    # Mirror the live phase (AET / shootout tally) for the in-progress card.
    # These columns are outside the matches_score_results trigger's OF list
    # (migration 037), so writing them never re-fires scoring — only
    # actual_*_score and penalty_winner_id do that, and penalty_winner_id is
    # deliberately left untouched here until _apply_finished settles it.
    live_extra_time = _went_to_extra_time(fd_match.score)
    live_penalties = _went_to_penalties(fd_match.score)
    if match.extra_time != live_extra_time:
        match.extra_time = live_extra_time
        changed = True
    if match.penalties != live_penalties:
        match.penalties = live_penalties
        changed = True
    et_home, et_away = _extra_time_scoreline(fd_match)
    if reversed_:
        et_home, et_away = et_away, et_home
    if match.extra_time_home_score != et_home or match.extra_time_away_score != et_away:
        match.extra_time_home_score = et_home
        match.extra_time_away_score = et_away
        changed = True
    pen_home, pen_away = _penalty_scoreline(fd_match)
    if reversed_:
        pen_home, pen_away = pen_away, pen_home
    if match.penalty_home_score != pen_home or match.penalty_away_score != pen_away:
        match.penalty_home_score = pen_home
        match.penalty_away_score = pen_away
        changed = True

    match.last_synced_at = now
    return changed


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
    async with session_factory() as session:
        consecutive_failures = await _load_consecutive_failures(session) + 1
        _consecutive_failures = consecutive_failures
        log.warning(
            "auto sync failed",
            consecutive_failures=consecutive_failures,
            reason=reason,
        )

        session.add(
            AuditLog(
                actor_id=None,
                actor_type=ActorType.system,
                action_type=ActionType.sync_failed,
                target_table="matches",
                target_id=None,
                changes={
                    "reason": reason,
                    "consecutive_failures": consecutive_failures,
                },
            )
        )

        if consecutive_failures == _FAILURE_ALERT_THRESHOLD:
            try:
                await notify_auto_sync_failed(session, reason)
            except Exception:
                log.exception("notify_auto_sync_failed failed")

        await session.commit()


def reset_failure_counter() -> None:
    """Test helper — reset the in-process counter to 0."""
    global _consecutive_failures
    _consecutive_failures = 0
