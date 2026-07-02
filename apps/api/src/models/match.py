import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, UpdatedAtMixin, UUIDPrimaryKeyMixin
from src.models.team import TournamentStage


class MatchStatus(StrEnum):
    scheduled = "scheduled"
    locked = "locked"
    live = "live"
    completed = "completed"
    postponed = "postponed"
    cancelled = "cancelled"


class ResultSource(StrEnum):
    auto = "auto"
    manual = "manual"
    override = "override"


class Match(Base, UUIDPrimaryKeyMixin, UpdatedAtMixin):
    __tablename__ = "matches"
    __table_args__ = (
        UniqueConstraint("match_number", name="uq_matches_match_number"),
        UniqueConstraint("football_data_match_id", name="uq_matches_football_data_match_id"),
        Index("ix_matches_kickoff_utc", "kickoff_utc"),
        Index("ix_matches_stage_status", "stage", "status"),
        Index("ix_matches_football_data_match_id", "football_data_match_id"),
    )

    stage: Mapped[TournamentStage] = mapped_column(
        Enum(TournamentStage, name="tournament_stage", create_type=False),
        nullable=False,
    )
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True
    )
    match_number: Mapped[int] = mapped_column(Integer, nullable=False)
    home_team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    away_team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    home_team_placeholder: Mapped[str | None] = mapped_column(String(50), nullable=True)
    away_team_placeholder: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Positional source refs for the seeded knockout skeleton (U13). NULL for
    # group-stage rows. Resolved into real teams by knockout_progression as the
    # tournament advances. See that module for the source-ref grammar.
    home_source: Mapped[str | None] = mapped_column(String(32), nullable=True)
    away_source: Mapped[str | None] = mapped_column(String(32), nullable=True)
    kickoff_utc: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    original_kickoff_utc: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True
    )
    venue: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[MatchStatus] = mapped_column(
        Enum(MatchStatus, name="match_status", create_type=False),
        nullable=False,
        server_default="scheduled",
    )
    actual_home_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_away_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extra_time: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    penalties: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    penalty_winner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    # Display-only scorelines for knockout matches that went the distance. NULL
    # when the match never reached that phase. Prediction scoring keys off the
    # 90-minute ``actual_*_score`` only (§7); these are purely for showing the
    # full result. ``extra_time_*`` is the cumulative score at the end of ET.
    extra_time_home_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extra_time_away_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    penalty_home_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    penalty_away_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result_source: Mapped[ResultSource | None] = mapped_column(
        Enum(ResultSource, name="result_source", create_type=False),
        nullable=True,
    )
    football_data_match_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    result_entered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True
    )
    result_entered_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    # Stamped once, when ``result_source`` first becomes non-null (the full-time
    # settle). Anchors the auto-result self-heal window in ``result_sync`` — unlike
    # ``result_entered_at``, which the live-score sync stamps mid-match. NULL for
    # results finalized before migration 039 (treated as outside the window).
    result_finalized_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True
    )
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    postponed_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
