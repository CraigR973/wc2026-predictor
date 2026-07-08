"""Pure knockout-bracket progression resolver (U13.4).

The 104-match calendar is fully seeded up front (see :mod:`src.seed`): the 72
group matches carry real teams, and the 32 knockout matches are seeded as a
fixed *skeleton*. Each knockout slot stores a **source ref** describing where
its team will come from rather than a team id — for example
``home_source="winner_group_a"``, ``away_source="runner_up_group_b"``, or for
later rounds ``home_source="winner_match_73"``.

As group standings finalise and knockout results settle, this module resolves
those source refs into concrete team ids. Everything here is **pure**: no I/O,
no ORM, no clock. :mod:`src.services.knockout_advancement` owns the thin DB
layer that loads standings + results, calls :func:`resolve_bracket`, and
writes the resolved team ids back onto the seeded rows.

Source ref grammar (stored in ``matches.home_source`` / ``matches.away_source``):

* ``winner_group_<x>``     — winner of group X (``a``..``l``)
* ``runner_up_group_<x>``  — runner-up of group X
* ``third_group_<x>``      — third-placed team of group X. The real R32 bracket
                             assigns its eight winner-vs-third matches by group
                             (FIFA Annex C, this tournament's qualifying-third
                             combination {B,D,E,F,I,J,K,L}), not by rank.
* ``best_third_<n>``       — the n-th best third-placed team (1..8). Retained for
                             the legacy :func:`advance_to_r32` path only; unused
                             by the live :data:`KNOCKOUT_BRACKET`.
* ``winner_match_<n>``     — winner of knockout match number N
* ``loser_match_<n>``      — loser of knockout match number N (used only by the
                             third-place play-off)

:data:`KNOCKOUT_BRACKET` is the authoritative FIFA 2026 wiring used by both the
resolver and the seed, verified against the live kickoff schedule. The older
:data:`BRACKET_R32` (a synthetic balanced template) is retained only for the
deprecated :func:`advance_to_r32` admin path and must not be used to reason
about real fixtures.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from src.models.team import TournamentStage
from src.routers.groups import TeamStanding

# ---------------------------------------------------------------------------
# R32 bracket template (canonical home — re-exported by knockout_advancement)
# ---------------------------------------------------------------------------

_GROUP_LETTERS = tuple("ABCDEFGHIJKL")  # A..L

# 16 R32 pairings — every slot label appears exactly once across the 32
# entries. The pairing strategy is "winner-heavy bracket":
#   * each group winner (1A..1L) opens the round,
#   * the first 8 winners face the 8 best third-placed teams (T1..T8),
#   * the remaining 4 winners face four runners-up,
#   * the other 8 runners-up are paired among themselves.
# This avoids any winner-vs-winner first-round collision. It is balanced and
# deterministic but is not bound to FIFA's eventual official 2026 bracket.
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

# Match-number windows for each knockout round (FIFA's official 1–104 numbering,
# after the 72 group matches).
R32_FIRST_MATCH_NUMBER = 73
R16_FIRST_MATCH_NUMBER = 89
QF_FIRST_MATCH_NUMBER = 97
SF_FIRST_MATCH_NUMBER = 101
THIRD_PLACE_MATCH_NUMBER = 103
FINAL_MATCH_NUMBER = 104


# ---------------------------------------------------------------------------
# Third-place ranking + R32 slot assignment (pure)
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

    Raises ``ValueError`` if any expected slot is unfillable — meaning either a
    group has fewer than two finished standings or fewer than eight
    third-placed teams were supplied.
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
# Source-ref grammar
# ---------------------------------------------------------------------------

_WINNER_GROUP = "winner_group_"
_RUNNER_UP_GROUP = "runner_up_group_"
_THIRD_GROUP = "third_group_"
_BEST_THIRD = "best_third_"
_WINNER_MATCH = "winner_match_"
_LOSER_MATCH = "loser_match_"


#: Real FIFA 2026 R32 bracket: match_number → (home_source, away_source).
#: The eight winner-vs-third matches are assigned *by group* (FIFA Annex C, for
#: this tournament's qualifying-third combination {B,D,E,F,I,J,K,L}), not by
#: rank. Verified against the live kickoff schedule (e.g. match 74 = winner C v
#: runner-up F = Brazil v Japan @ noon Houston). Authoritative — do not reorder.
_R32_BRACKET: dict[int, tuple[str, str]] = {
    73: ("runner_up_group_a", "runner_up_group_b"),
    74: ("winner_group_c", "runner_up_group_f"),
    75: ("winner_group_e", "third_group_d"),
    76: ("winner_group_f", "runner_up_group_c"),
    77: ("runner_up_group_e", "runner_up_group_i"),
    78: ("winner_group_i", "third_group_f"),
    79: ("winner_group_a", "third_group_e"),
    80: ("winner_group_l", "third_group_k"),
    81: ("winner_group_g", "third_group_i"),
    82: ("winner_group_d", "third_group_b"),
    83: ("winner_group_h", "runner_up_group_j"),
    84: ("runner_up_group_k", "runner_up_group_l"),
    85: ("winner_group_b", "third_group_j"),
    86: ("runner_up_group_d", "runner_up_group_g"),
    87: ("winner_group_j", "runner_up_group_h"),
    88: ("winner_group_k", "third_group_l"),
}

#: Real FIFA 2026 wiring for R16 → Final: match_number → (home_source, away).
#: Fixed (result-independent); the third-place play-off (103) takes the two
#: semi-final losers. R16 entries (89-96) corrected 2026-07-03 against the
#: published FIFA schedule (Sky Sports + ESPN cross-checked to the minute) —
#: the prior wiring had 89/90/91 and 95/96 pairing the wrong feeder matches,
#: and 93/94 with home/away reversed. Match 95 home/away further corrected
#: 2026-07-04 to ARG-home (winner_match_87) per the published bracket — the
#: 07-03 pass had the right teams (86,87) but left EGY as home.
_LATER_ROUNDS_BRACKET: dict[int, tuple[str, str]] = {
    89: ("winner_match_73", "winner_match_76"),
    90: ("winner_match_75", "winner_match_78"),
    91: ("winner_match_74", "winner_match_77"),
    92: ("winner_match_79", "winner_match_80"),
    93: ("winner_match_84", "winner_match_83"),
    94: ("winner_match_82", "winner_match_81"),
    95: ("winner_match_87", "winner_match_86"),
    96: ("winner_match_85", "winner_match_88"),
    97: ("winner_match_90", "winner_match_89"),
    98: ("winner_match_93", "winner_match_94"),
    99: ("winner_match_91", "winner_match_92"),
    100: ("winner_match_95", "winner_match_96"),
    101: ("winner_match_97", "winner_match_98"),
    102: ("winner_match_99", "winner_match_100"),
    103: ("loser_match_101", "loser_match_102"),
    104: ("winner_match_101", "winner_match_102"),
}

#: match_number → (home_source, away_source) for all 32 knockout matches.
KNOCKOUT_BRACKET: dict[int, tuple[str, str]] = {**_R32_BRACKET, **_LATER_ROUNDS_BRACKET}


def stage_for_match_number(match_number: int) -> TournamentStage:
    """Return the knockout :class:`TournamentStage` for a seeded match number."""
    if R32_FIRST_MATCH_NUMBER <= match_number <= 88:
        return TournamentStage.r32
    if R16_FIRST_MATCH_NUMBER <= match_number <= 96:
        return TournamentStage.r16
    if QF_FIRST_MATCH_NUMBER <= match_number <= 100:
        return TournamentStage.qf
    if match_number in (SF_FIRST_MATCH_NUMBER, SF_FIRST_MATCH_NUMBER + 1):
        return TournamentStage.sf
    if match_number == THIRD_PLACE_MATCH_NUMBER:
        return TournamentStage.third_place
    if match_number == FINAL_MATCH_NUMBER:
        return TournamentStage.final
    raise ValueError(f"{match_number} is not a knockout match number (73–104)")


def placeholder_label(source: str) -> str:
    """Human-readable placeholder for a source ref, e.g. "Winner Group A"."""
    if source.startswith(_WINNER_GROUP):
        return f"Winner Group {source[len(_WINNER_GROUP) :].upper()}"
    if source.startswith(_RUNNER_UP_GROUP):
        return f"Runner-up Group {source[len(_RUNNER_UP_GROUP) :].upper()}"
    if source.startswith(_THIRD_GROUP):
        return f"3rd Place Group {source[len(_THIRD_GROUP) :].upper()}"
    if source.startswith(_BEST_THIRD):
        return f"Best 3rd #{source[len(_BEST_THIRD) :]}"
    if source.startswith(_WINNER_MATCH):
        return f"Winner of Match {source[len(_WINNER_MATCH) :]}"
    if source.startswith(_LOSER_MATCH):
        return f"Loser of Match {source[len(_LOSER_MATCH) :]}"
    raise ValueError(f"Unknown source ref: {source!r}")


# ---------------------------------------------------------------------------
# Resolution (pure)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class MatchOutcome:
    """A settled knockout match — enough to derive its winner and loser.

    Score-based result decides 90-minute matches; a draw is broken by
    ``penalty_winner_id`` (extra time does not change the score for prediction
    purposes — see §7 of the architecture doc).
    """

    home_team_id: uuid.UUID | None
    away_team_id: uuid.UUID | None
    home_score: int | None
    away_score: int | None
    penalty_winner_id: uuid.UUID | None = None

    @property
    def winner_id(self) -> uuid.UUID | None:
        if (
            self.home_team_id is None
            or self.away_team_id is None
            or self.home_score is None
            or self.away_score is None
        ):
            return None
        if self.home_score > self.away_score:
            return self.home_team_id
        if self.away_score > self.home_score:
            return self.away_team_id
        # Level after 90 (+ET): decided on penalties.
        if self.penalty_winner_id in (self.home_team_id, self.away_team_id):
            return self.penalty_winner_id
        return None

    @property
    def loser_id(self) -> uuid.UUID | None:
        winner = self.winner_id
        if winner is None:
            return None
        if winner == self.home_team_id:
            return self.away_team_id
        if winner == self.away_team_id:
            return self.home_team_id
        return None


@dataclass(frozen=True)
class ResolvedMatch:
    """Resolved (or still-unknown) teams for one knockout match."""

    home_team_id: uuid.UUID | None
    away_team_id: uuid.UUID | None

    @property
    def fully_resolved(self) -> bool:
        return self.home_team_id is not None and self.away_team_id is not None


def _group_is_complete(standings: list[TeamStanding]) -> bool:
    """A group is final once every team in it has played its three matches."""
    return len(standings) >= 2 and all(s.played == 3 for s in standings)


def all_groups_complete(group_standings: dict[str, list[TeamStanding]]) -> bool:
    """True once all twelve groups are fully played (so thirds can be ranked)."""
    if len(group_standings) < len(_GROUP_LETTERS):
        return False
    return all(_group_is_complete(s) for s in group_standings.values())


def _group_position(
    group_standings: dict[str, list[TeamStanding]],
    letter: str,
    index: int,
) -> uuid.UUID | None:
    standings = group_standings.get(letter)
    if standings is None or not _group_is_complete(standings) or index >= len(standings):
        return None
    return uuid.UUID(standings[index].team_id)


def resolve_source(
    source: str,
    group_standings: dict[str, list[TeamStanding]],
    ranked_thirds: list[TeamStanding],
    outcomes: dict[int, MatchOutcome],
) -> uuid.UUID | None:
    """Resolve a single source ref to a team id, or ``None`` if not yet known.

    ``ranked_thirds`` should be the output of :func:`rank_third_place_teams`
    once (and only once) all groups are complete — pass an empty list before
    then so ``best_third_*`` refs stay unresolved.
    """
    if source.startswith(_WINNER_GROUP):
        return _group_position(group_standings, source[len(_WINNER_GROUP) :].upper(), 0)
    if source.startswith(_RUNNER_UP_GROUP):
        return _group_position(group_standings, source[len(_RUNNER_UP_GROUP) :].upper(), 1)
    if source.startswith(_THIRD_GROUP):
        return _group_position(group_standings, source[len(_THIRD_GROUP) :].upper(), 2)
    if source.startswith(_BEST_THIRD):
        n = int(source[len(_BEST_THIRD) :])
        if 1 <= n <= len(ranked_thirds):
            return uuid.UUID(ranked_thirds[n - 1].team_id)
        return None
    if source.startswith(_WINNER_MATCH):
        outcome = outcomes.get(int(source[len(_WINNER_MATCH) :]))
        return outcome.winner_id if outcome is not None else None
    if source.startswith(_LOSER_MATCH):
        outcome = outcomes.get(int(source[len(_LOSER_MATCH) :]))
        return outcome.loser_id if outcome is not None else None
    raise ValueError(f"Unknown source ref: {source!r}")


def resolve_bracket(
    group_standings: dict[str, list[TeamStanding]],
    outcomes: dict[int, MatchOutcome],
) -> dict[int, ResolvedMatch]:
    """Resolve every knockout match's home/away team from current state.

    Pure: given the group standings and the set of settled knockout outcomes,
    returns ``match_number → ResolvedMatch``. A slot stays ``None`` until its
    feeding group/match has produced a definite team — so the same function is
    safe to call repeatedly as the tournament progresses.
    """
    ranked_thirds = (
        rank_third_place_teams(group_standings) if all_groups_complete(group_standings) else []
    )
    resolved: dict[int, ResolvedMatch] = {}
    for match_number, (home_source, away_source) in KNOCKOUT_BRACKET.items():
        resolved[match_number] = ResolvedMatch(
            home_team_id=resolve_source(home_source, group_standings, ranked_thirds, outcomes),
            away_team_id=resolve_source(away_source, group_standings, ranked_thirds, outcomes),
        )
    return resolved
