"""Tests for SQLAlchemy model definitions — no DB connection required."""

import src.models  # noqa: F401 — side-effect: registers all models on Base.metadata
from src.models import Base, Group, Invite, Profile, RefreshToken, Team
from src.models.profile import PlayerRole
from src.models.team import TournamentStage


def test_metadata_has_expected_tables() -> None:
    assert set(Base.metadata.tables.keys()) == {
        "groups",
        "profiles",
        "teams",
        "refresh_tokens",
        "invites",
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
