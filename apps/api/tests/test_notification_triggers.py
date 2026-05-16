"""Tests for Phase 10.3 — notification trigger wiring."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.models.match import MatchStatus
from src.models.notification import NotificationType
from src.models.prediction import LeaderboardSnapshot
from src.models.profile import Profile
from src.services.notification_triggers import (
    MatchUpdate,
    check_deadline_warnings,
    notify_auto_sync_failed,
    notify_invite_accepted,
    notify_kickoff_changed,
    notify_leaderboard_shifts,
    notify_match_locked,
    notify_match_postponed,
    notify_result_detected,
    notify_round_complete,
    notify_special_results_awarded,
)

_NT = "src.services.notification_triggers"
_SEND = f"{_NT}.send_notification"
_TEAM = f"{_NT}._team_name"
_LB_SHIFTS = f"{_NT}.notify_leaderboard_shifts"
_RC = f"{_NT}.notify_round_complete"


# ── Helpers ───────────────────────────────────────────────────────────────────


def _match_update(**kwargs: Any) -> MatchUpdate:
    defaults: dict[str, Any] = {
        "event_type": "test",
        "match_id": uuid.uuid4(),
        "stage": "group_stage",
        "home_team_id": None,
        "away_team_id": None,
        "home_placeholder": "France",
        "away_placeholder": "Germany",
    }
    defaults.update(kwargs)
    return MatchUpdate(**defaults)


def _player(role: str = "player") -> MagicMock:
    p = MagicMock(spec=Profile)
    p.id = uuid.uuid4()
    p.display_name = "Alice"
    p.is_active = True
    p.deleted_at = None
    p.role = role
    return p


def _snap(player_id: uuid.UUID, rank: int, match_id: uuid.UUID) -> MagicMock:
    s = MagicMock(spec=LeaderboardSnapshot)
    s.player_id = player_id
    s.rank = rank
    s.triggered_by_match_id = match_id
    return s


# ── notify_match_locked ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_notify_match_locked_calls_send_for_all_players() -> None:
    update = _match_update()
    players = [_player(), _player()]
    session = AsyncMock()
    session.execute.return_value = MagicMock(
        scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=players)))
    )

    with (
        patch(_SEND, new_callable=AsyncMock) as mock_send,
        patch(_TEAM, new_callable=AsyncMock, return_value="France"),
    ):
        await notify_match_locked(session, update)

    assert mock_send.call_count == len(players)
    for call_args in mock_send.call_args_list:
        assert call_args.args[2] == NotificationType.match_locked


# ── notify_result_detected ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_notify_result_detected_dispatches_dependent_triggers() -> None:
    update = _match_update(event_type="finished", home_score=2, away_score=1)
    players = [_player()]
    session = AsyncMock()
    session.execute.return_value = MagicMock(
        scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=players)))
    )

    with (
        patch(_SEND, new_callable=AsyncMock) as mock_send,
        patch(_TEAM, new_callable=AsyncMock, return_value="France"),
        patch(_LB_SHIFTS, new_callable=AsyncMock) as mock_lb,
        patch(_RC, new_callable=AsyncMock) as mock_rc,
    ):
        await notify_result_detected(session, update)

    # result notification + leaderboard_shifts + round_complete both fired
    mock_lb.assert_awaited_once_with(session, update.match_id)
    mock_rc.assert_awaited_once_with(session, update.stage)
    assert mock_send.call_count >= 1


# ── notify_leaderboard_shifts ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_notify_leaderboard_shifts_sends_when_rank_changed() -> None:
    match_id = uuid.uuid4()
    player_id = uuid.uuid4()
    new_snap = _snap(player_id, 2, match_id)
    old_snap = _snap(player_id, 5, uuid.uuid4())

    session = AsyncMock()
    # First execute: new snapshots
    # Second execute: previous snapshot per player
    session.execute.side_effect = [
        MagicMock(
            scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[new_snap])))
        ),
        MagicMock(scalar_one_or_none=MagicMock(return_value=old_snap)),
    ]

    with patch(_SEND, new_callable=AsyncMock) as mock_send:
        await notify_leaderboard_shifts(session, match_id)

    mock_send.assert_awaited_once()
    call = mock_send.call_args
    assert call.args[2] == NotificationType.leaderboard_shift
    assert "up" in call.args[3]


@pytest.mark.asyncio
async def test_notify_leaderboard_shifts_no_send_when_rank_unchanged() -> None:
    match_id = uuid.uuid4()
    player_id = uuid.uuid4()
    new_snap = _snap(player_id, 3, match_id)
    old_snap = _snap(player_id, 3, uuid.uuid4())

    session = AsyncMock()
    session.execute.side_effect = [
        MagicMock(
            scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[new_snap])))
        ),
        MagicMock(scalar_one_or_none=MagicMock(return_value=old_snap)),
    ]

    with patch(_SEND, new_callable=AsyncMock) as mock_send:
        await notify_leaderboard_shifts(session, match_id)

    mock_send.assert_not_awaited()


# ── notify_round_complete ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_notify_round_complete_fires_when_all_done() -> None:
    players = [_player()]
    session = AsyncMock()
    # total = 3, completed = 3 → fire
    session.execute.side_effect = [
        MagicMock(scalar=MagicMock(return_value=3)),  # total
        MagicMock(scalar=MagicMock(return_value=3)),  # done
        MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=players)))),
    ]
    with patch(_SEND, new_callable=AsyncMock) as mock_send:
        await notify_round_complete(session, "group_stage")
    mock_send.assert_awaited()


@pytest.mark.asyncio
async def test_notify_round_complete_no_fire_when_incomplete() -> None:
    session = AsyncMock()
    session.execute.side_effect = [
        MagicMock(scalar=MagicMock(return_value=3)),  # total
        MagicMock(scalar=MagicMock(return_value=1)),  # done — not all finished
    ]
    with patch(_SEND, new_callable=AsyncMock) as mock_send:
        await notify_round_complete(session, "group_stage")
    mock_send.assert_not_awaited()


# ── notify_match_postponed ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_notify_match_postponed() -> None:
    update = _match_update(event_type="postponed")
    players = [_player()]
    session = AsyncMock()
    session.execute.return_value = MagicMock(
        scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=players)))
    )
    with (
        patch(_SEND, new_callable=AsyncMock) as mock_send,
        patch(_TEAM, new_callable=AsyncMock, return_value="X"),
    ):
        await notify_match_postponed(session, update)
    for call in mock_send.call_args_list:
        assert call.args[2] == NotificationType.match_postponed


# ── notify_kickoff_changed ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_notify_kickoff_changed_includes_new_time() -> None:
    update = _match_update(
        event_type="kickoff_changed",
        new_kickoff=datetime(2026, 6, 14, 18, 0),
    )
    players = [_player()]
    session = AsyncMock()
    session.execute.return_value = MagicMock(
        scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=players)))
    )
    with (
        patch(_SEND, new_callable=AsyncMock) as mock_send,
        patch(_TEAM, new_callable=AsyncMock, return_value="X"),
    ):
        await notify_kickoff_changed(session, update)
    assert mock_send.call_count == 1
    assert "18:00" in mock_send.call_args.args[4]


# ── notify_invite_accepted ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_notify_invite_accepted_notifies_admins_only() -> None:
    admin = _player(role="admin")
    session = AsyncMock()
    session.execute.return_value = MagicMock(
        scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[admin])))
    )
    with patch(_SEND, new_callable=AsyncMock) as mock_send:
        await notify_invite_accepted(session, "Craig")
    assert mock_send.call_count == 1
    assert "Craig" in mock_send.call_args.args[4]


# ── notify_special_results_awarded ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_notify_special_results_awarded() -> None:
    players = [_player(), _player()]
    session = AsyncMock()
    session.execute.return_value = MagicMock(
        scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=players)))
    )
    with patch(_SEND, new_callable=AsyncMock) as mock_send:
        await notify_special_results_awarded(session, "tournament_winner")
    assert mock_send.call_count == len(players)
    for call in mock_send.call_args_list:
        assert call.args[2] == NotificationType.special_results


# ── notify_auto_sync_failed ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_notify_auto_sync_failed_sends_to_admins() -> None:
    admin = _player(role="admin")
    session = AsyncMock()
    session.execute.return_value = MagicMock(
        scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[admin])))
    )
    with patch(_SEND, new_callable=AsyncMock) as mock_send:
        await notify_auto_sync_failed(session, "Connection refused")
    assert mock_send.call_count == 1
    assert mock_send.call_args.args[2] == NotificationType.auto_sync_failed


# ── check_deadline_warnings ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_deadline_warning_fires_for_imminent_match() -> None:

    from src.services.notification_triggers import _warned_match_ids

    match_id = uuid.uuid4()
    match = MagicMock()
    match.id = match_id
    match.stage = "group_stage"
    match.status = MatchStatus.scheduled
    match.kickoff_utc = datetime(2026, 6, 14, 18, 0)
    match.home_team_id = None
    match.away_team_id = None
    match.home_team_placeholder = "France"
    match.away_team_placeholder = "Germany"
    match.deleted_at = None

    _warned_match_ids.discard(match_id)

    players = [_player()]
    session_mock = AsyncMock()
    session_mock.execute.side_effect = [
        MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[match])))),
        MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=players)))),
    ]

    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__ = AsyncMock(return_value=session_mock)
    mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

    now = datetime(2026, 6, 14, 17, 44)  # 16 min before 18:00, within 14–16 min window
    with (
        patch(_SEND, new_callable=AsyncMock) as mock_send,
        patch(_TEAM, new_callable=AsyncMock, return_value="France"),
    ):
        count = await check_deadline_warnings(mock_factory, now=now)

    assert count == 1
    mock_send.assert_awaited()
    assert match_id in _warned_match_ids


@pytest.mark.asyncio
async def test_deadline_warning_not_double_sent() -> None:
    from src.services.notification_triggers import _warned_match_ids

    match_id = uuid.uuid4()
    _warned_match_ids.add(match_id)  # already warned

    match = MagicMock()
    match.id = match_id
    match.status = MatchStatus.scheduled
    match.kickoff_utc = datetime(2026, 6, 14, 18, 0)
    match.deleted_at = None

    session_mock = AsyncMock()
    session_mock.execute.return_value = MagicMock(
        scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[match])))
    )

    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__ = AsyncMock(return_value=session_mock)
    mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

    now = datetime(2026, 6, 14, 17, 44)
    with patch(_SEND, new_callable=AsyncMock) as mock_send:
        count = await check_deadline_warnings(mock_factory, now=now)

    assert count == 0
    mock_send.assert_not_awaited()
