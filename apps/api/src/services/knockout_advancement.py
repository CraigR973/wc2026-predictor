"""Knockout advancement service (Phase 7.1).

Computes which 32 teams advance from the 12-group stage to the Round of 32
and creates the 16 R32 match rows. Kickoff times for the new matches are
pulled from football-data.org and assigned in chronological order.

Public surface:

* :data:`BRACKET_R32` — the 16 slot-pair templates used to build R32
  matches. Each slot label refers to a position in the group stage:

    * ``1A``..``1L`` — winners of groups A through L (12 slots)
    * ``2A``..``2L`` — runners-up of groups A through L (12 slots)
    * ``T1``..``T8`` — the eight best third-placed teams, ranked
      across all 12 groups using FIFA tiebreakers (points → GD → GF →
      team code)

  Every slot label is used exactly once, so the 32 advancing teams are
  fully consumed across 16 matches. This default pairing is balanced
  (winners avoid winners, runners-up are spread across the bracket) but
  is not bound to FIFA's eventual official 2026 bracket — admin can
  reshuffle pairings later via per-match admin tools.

* :func:`rank_third_place_teams` — sort the twelve third-placed
  standings rows into a single FIFA-ranked list and return the top
  eight.
* :func:`assign_r32_slots` — apply :data:`BRACKET_R32` to a slot →
  ``TeamStanding`` map and produce the ordered list of (home, away)
  team pairs for the 16 R32 matches.
* :func:`advance_to_r32` — orchestrator. Validates that the group
  stage is complete, computes standings via the same helper used by
  the groups router, fetches kickoff times from football-data.org,
  persists 16 ``Match`` rows + one ``AuditLog`` entry per match.

A future phase may extend this module with R32→R16, R16→QF, etc.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.group import Group
from src.models.match import Match, MatchStatus
from src.models.notification import ActionType, ActorType, AuditLog
from src.models.team import Team, TournamentStage
from src.routers.groups import TeamStanding, _compute_standings
from src.services.football_data import FDMatch

log: structlog.stdlib.BoundLogger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Bracket constants
# ---------------------------------------------------------------------------

_GROUP_LETTERS = tuple("ABCDEFGHIJKL")  # A..L

# 16 R32 pairings — every slot label appears exactly once across the 32
# entries. The pairing strategy is "winner-heavy bracket":
#   * each group winner (1A..1L) opens the round,
#   * the first 8 winners face the 8 best third-placed teams (T1..T8),
#   * the remaining 4 winners face four runners-up,
#   * the other 8 runners-up are paired among themselves.
# This avoids any winner-vs-winner first-round collision.
BRACKET_R32: list[tuple[str, str]] = [
    ("1A", "T1"),
    ("1B", "T2"),
    ("1C", "T3"),
    ("1D", "T4"),
    ("1E", "T5"),
    ("1F", "T6"),
    ("1G", "T7"),
    ("1H", "T8"),
    ("1I", "2A"),
    ("1J", "2B"),
    ("1K", "2C"),
    ("1L", "2D"),
    ("2E", "2F"),
    ("2G", "2H"),
    ("2I", "2J"),
    ("2K", "2L"),
]

# Match numbers reserved for R32 in the seed plan (after the 72 group
# matches). Matches are written in BRACKET_R32 order.
_R32_FIRST_MATCH_NUMBER = 73

# football-data.org may report Round of 32 under several labels depending on
# competition layout (48-team tournament had no official label before 2026).
# Accept any of these; tests can supply whichever one the live feed uses.
_FD_R32_STAGE_LABELS = frozenset(
    {
        "LAST_32",
        "ROUND_OF_32",
        "PRELIMINARY_ROUND",
    }
)


# ---------------------------------------------------------------------------
# Pure functions
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _ThirdPlace:
    """Lightweight view of a third-placed team for cross-group ranking."""

    group: str
    standing: TeamStanding


def rank_third_place_teams(
    group_standings: dict[str, list[TeamStanding]],
) -> list[TeamStanding]:
    """Return the top eight third-placed teams across all twelve groups.

    Ranking applies FIFA tiebreakers in order: points → goal difference →
    goals for → team code (deterministic last-resort).
    """
    thirds: list[_ThirdPlace] = []
    for group_name, standings in group_standings.items():
        if len(standings) < 3:
            continue
        thirds.append(_ThirdPlace(group=group_name, standing=standings[2]))

    def _key(t: _ThirdPlace) -> tuple[int, int, int, str]:
        s = t.standing
        return (-s.points, -s.gd, -s.gf, s.team_code)

    thirds.sort(key=_key)
    return [t.standing for t in thirds[:8]]


def assign_r32_slots(
    group_standings: dict[str, list[TeamStanding]],
    third_place_ranked: list[TeamStanding],
) -> dict[str, TeamStanding]:
    """Build a slot-label → standing map covering all 32 advancing teams.

    Raises ``ValueError`` if any expected slot is unfillable — meaning
    either a group has fewer than two finished standings or fewer than
    eight third-placed teams were supplied.
    """
    if len(third_place_ranked) < 8:
        raise ValueError(f"Expected 8 ranked third-place teams; got {len(third_place_ranked)}")

    out: dict[str, TeamStanding] = {}
    for letter in _GROUP_LETTERS:
        standings = group_standings.get(letter)
        if standings is None or len(standings) < 2:
            raise ValueError(f"Group {letter} missing 1st/2nd-place standings")
        out[f"1{letter}"] = standings[0]
        out[f"2{letter}"] = standings[1]

    for idx, standing in enumerate(third_place_ranked[:8], start=1):
        out[f"T{idx}"] = standing

    return out


# ---------------------------------------------------------------------------
# DB orchestrator
# ---------------------------------------------------------------------------


async def _load_group_standings(db: AsyncSession) -> dict[str, list[TeamStanding]]:
    groups_r = await db.execute(select(Group).order_by(Group.name))
    groups = list(groups_r.scalars().all())

    teams_r = await db.execute(select(Team))
    all_teams = list(teams_r.scalars().all())
    teams_by_group: dict[uuid.UUID, list[Team]] = {}
    for t in all_teams:
        if t.group_id is None:
            continue
        teams_by_group.setdefault(t.group_id, []).append(t)

    matches_r = await db.execute(
        select(Match).where(
            Match.stage == TournamentStage.group,
            Match.deleted_at.is_(None),
        )
    )
    all_matches = list(matches_r.scalars().all())
    matches_by_group: dict[uuid.UUID, list[Match]] = {}
    for m in all_matches:
        if m.group_id is None:
            continue
        matches_by_group.setdefault(m.group_id, []).append(m)

    out: dict[str, list[TeamStanding]] = {}
    for g in groups:
        teams = teams_by_group.get(g.id, [])
        matches = matches_by_group.get(g.id, [])
        out[g.name] = _compute_standings(teams, matches, g.standings_override)
    return out


def _all_group_matches_complete(group_standings: dict[str, list[TeamStanding]]) -> bool:
    # Each team plays 3 matches in a 4-team group. Every standing row's
    # ``played`` count must equal 3 once the group stage is over.
    for standings in group_standings.values():
        for row in standings:
            if row.played != 3:
                return False
    return True


def _filter_r32_fixtures(fd_matches: list[FDMatch]) -> list[FDMatch]:
    r32 = [m for m in fd_matches if m.stage in _FD_R32_STAGE_LABELS]
    r32.sort(key=lambda m: m.utcDate)
    return r32


async def _r32_match_count(db: AsyncSession) -> int:
    rows = await db.execute(
        select(Match).where(
            Match.stage == TournamentStage.r32,
            Match.deleted_at.is_(None),
        )
    )
    return len(list(rows.scalars().all()))


def _strip_tz(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(UTC).replace(tzinfo=None)


class KnockoutAdvanceError(Exception):
    """Raised when advancement preconditions fail. The endpoint maps
    each subclass to the appropriate HTTP status code."""


class GroupStageIncompleteError(KnockoutAdvanceError):
    pass


class AlreadyAdvancedError(KnockoutAdvanceError):
    pass


class MissingKickoffsError(KnockoutAdvanceError):
    pass


async def advance_to_r32(
    db: AsyncSession,
    admin_id: uuid.UUID,
    fd_fetcher: Callable[[], Awaitable[list[FDMatch]]],
) -> list[Match]:
    """Create the sixteen R32 matches.

    Raises one of the :class:`KnockoutAdvanceError` subclasses if a
    precondition fails. The caller is responsible for translating
    those into HTTP responses.

    The DB session is committed here so the audit and match rows land
    together.
    """
    if await _r32_match_count(db) > 0:
        raise AlreadyAdvancedError("R32 matches already exist")

    group_standings = await _load_group_standings(db)
    if not _all_group_matches_complete(group_standings):
        raise GroupStageIncompleteError("Group stage is not yet complete")

    third_place_ranked = rank_third_place_teams(group_standings)
    slot_to_standing = assign_r32_slots(group_standings, third_place_ranked)

    fd_matches_all = await fd_fetcher()
    fd_r32 = _filter_r32_fixtures(fd_matches_all)
    if len(fd_r32) < len(BRACKET_R32):
        raise MissingKickoffsError(
            f"football-data.org returned only {len(fd_r32)} R32 fixtures; need {len(BRACKET_R32)}"
        )

    # Resolve TeamStanding back to ORM Team rows. We don't reload — the
    # Team objects are still cached on `_compute_standings`'s `stats`
    # map, but its result type strips them. Re-fetch by id in one query.
    needed_ids: set[uuid.UUID] = set()
    for standing in slot_to_standing.values():
        needed_ids.add(uuid.UUID(standing.team_id))
    teams_r = await db.execute(select(Team).where(Team.id.in_(needed_ids)))
    team_by_id = {t.id: t for t in teams_r.scalars().all()}

    created: list[Match] = []
    audits: list[AuditLog] = []
    for idx, (home_slot, away_slot) in enumerate(BRACKET_R32):
        home_standing = slot_to_standing[home_slot]
        away_standing = slot_to_standing[away_slot]
        home_team = team_by_id[uuid.UUID(home_standing.team_id)]
        away_team = team_by_id[uuid.UUID(away_standing.team_id)]
        fd_fixture = fd_r32[idx]

        match = Match(
            stage=TournamentStage.r32,
            group_id=None,
            match_number=_R32_FIRST_MATCH_NUMBER + idx,
            home_team_id=home_team.id,
            away_team_id=away_team.id,
            home_team_placeholder=home_slot,
            away_team_placeholder=away_slot,
            kickoff_utc=_strip_tz(fd_fixture.utcDate),
            status=MatchStatus.scheduled,
            result_source=None,
            football_data_match_id=fd_fixture.id,
        )
        db.add(match)
        created.append(match)

        audit = AuditLog(
            actor_id=admin_id,
            actor_type=ActorType.admin,
            action_type=ActionType.knockout_advanced,
            target_table="matches",
            target_id=None,  # match.id is assigned during the flush below
            changes={
                "stage": TournamentStage.r32.value,
                "match_number": match.match_number,
                "home_slot": home_slot,
                "away_slot": away_slot,
                "home_team_id": str(home_team.id),
                "away_team_id": str(away_team.id),
                "home_team_code": home_team.code,
                "away_team_code": away_team.code,
                "kickoff_utc": match.kickoff_utc.isoformat(),
                "football_data_match_id": fd_fixture.id,
            },
        )
        db.add(audit)
        audits.append(audit)

    await db.flush()
    for match, audit in zip(created, audits, strict=True):
        audit.target_id = match.id
    await db.commit()
    log.info(
        "advanced to R32",
        admin_id=str(admin_id),
        matches_created=len(created),
        first_kickoff=created[0].kickoff_utc.isoformat(),
    )
    return created
