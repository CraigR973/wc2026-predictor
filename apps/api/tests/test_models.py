"""Tests for SQLAlchemy model definitions — no DB connection required."""

import src.models  # noqa: F401 — side-effect: registers all models on Base.metadata
from src.models import (
    Base,
    Group,
    Invite,
    Match,
    MatchStatus,
    Profile,
    RefreshToken,
    ResultSource,
    Team,
)
from src.models.profile import PlayerRole
from src.models.team import TournamentStage


def test_metadata_has_expected_tables() -> None:
    assert set(Base.metadata.tables.keys()) == {
        "groups",
        "profiles",
        "teams",
        "refresh_tokens",
        "invites",
        "matches",
    }


def test_group_columns() -> None:
    cols = {c.name for c in Group.__table__.columns}
    assert cols == {"id", "name", "created_at"}


def test_profile_columns() -> None:
    cols = {c.name for c in Profile.__table__.columns}
    assert {
        "id",
        "display_name",
        "pin_hash",
        "role",
        "timezone",
        "failed_login_count",
        "locked_until",
        "deleted_at",
        "created_at",
        "updated_at",
    }.issubset(cols)


def test_team_columns() -> None:
    cols = {c.name for c in Team.__table__.columns}
    assert {
        "id",
        "name",
        "code",
        "flag_emoji",
        "group_id",
        "eliminated_at_stage",
        "is_host",
        "football_data_team_id",
        "created_at",
    }.issubset(cols)


def test_refresh_token_columns() -> None:
    cols = {c.name for c in RefreshToken.__table__.columns}
    assert {
        "id",
        "player_id",
        "token_hash",
        "device_hint",
        "expires_at",
        "revoked_at",
        "created_at",
    }.issubset(cols)


def test_invite_columns() -> None:
    cols = {c.name for c in Invite.__table__.columns}
    assert {
        "id",
        "token",
        "display_name_hint",
        "created_by",
        "claimed_by",
        "claimed_at",
        "expires_at",
        "is_active",
        "created_at",
    }.issubset(cols)


def test_tournament_stage_values() -> None:
    assert {s.value for s in TournamentStage} == {
        "group",
        "r32",
        "r16",
        "qf",
        "sf",
        "third_place",
        "final",
        "winner",
    }


def test_player_role_values() -> None:
    assert {r.value for r in PlayerRole} == {"player", "admin"}


def test_team_fk_references_groups() -> None:
    fk_targets = {fk.target_fullname for fk in Team.__table__.foreign_keys}
    assert "groups.id" in fk_targets


def test_refresh_token_fk_references_profiles() -> None:
    fk_targets = {fk.target_fullname for fk in RefreshToken.__table__.foreign_keys}
    assert "profiles.id" in fk_targets


def test_invite_fks_reference_profiles() -> None:
    fk_targets = {fk.target_fullname for fk in Invite.__table__.foreign_keys}
    assert fk_targets == {"profiles.id"}


def test_profiles_has_unique_display_name() -> None:
    constraints = {c.name for c in Profile.__table__.constraints}
    assert "uq_profiles_display_name" in constraints


def test_groups_has_unique_name() -> None:
    constraints = {c.name for c in Group.__table__.constraints}
    assert "uq_groups_name" in constraints


def test_match_columns() -> None:
    cols = {c.name for c in Match.__table__.columns}
    assert {
        "id",
        "stage",
        "group_id",
        "match_number",
        "home_team_id",
        "away_team_id",
        "home_team_placeholder",
        "away_team_placeholder",
        "kickoff_utc",
        "original_kickoff_utc",
        "venue",
        "status",
        "actual_home_score",
        "actual_away_score",
        "extra_time",
        "penalties",
        "penalty_winner_id",
        "result_source",
        "football_data_match_id",
        "last_synced_at",
        "result_entered_at",
        "result_entered_by",
        "locked_at",
        "postponed_reason",
        "deleted_at",
        "created_at",
        "updated_at",
    }.issubset(cols)


def test_match_status_values() -> None:
    assert {s.value for s in MatchStatus} == {
        "scheduled",
        "locked",
        "live",
        "completed",
        "postponed",
        "cancelled",
    }


def test_result_source_values() -> None:
    assert {s.value for s in ResultSource} == {"auto", "manual", "override"}


def test_match_unique_constraints() -> None:
    constraint_names = {c.name for c in Match.__table__.constraints}
    assert "uq_matches_match_number" in constraint_names
    assert "uq_matches_football_data_match_id" in constraint_names


def test_match_indexes() -> None:
    index_names = {i.name for i in Match.__table__.indexes}
    assert "ix_matches_kickoff_utc" in index_names
    assert "ix_matches_stage_status" in index_names
    assert "ix_matches_football_data_match_id" in index_names


def test_match_fks() -> None:
    fk_targets = {fk.target_fullname for fk in Match.__table__.foreign_keys}
    assert "groups.id" in fk_targets
    assert "teams.id" in fk_targets
    assert "profiles.id" in fk_targets
