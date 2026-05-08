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
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, TimestampMixin, UpdatedAtMixin, UUIDPrimaryKeyMixin


class SpecialPredictionType(StrEnum):
    tournament_winner = "tournament_winner"
    golden_boot = "golden_boot"
    top_scoring_team = "top_scoring_team"


class Prediction(Base, UUIDPrimaryKeyMixin, UpdatedAtMixin):
    __tablename__ = "predictions"
    __table_args__ = (
        UniqueConstraint("player_id", "match_id", name="uq_predictions_player_match"),
        Index("ix_predictions_player_id", "player_id"),
        Index("ix_predictions_match_id", "match_id"),
    )

    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False
    )
    predicted_home: Mapped[int | None] = mapped_column(Integer, nullable=True)
    predicted_away: Mapped[int | None] = mapped_column(Integer, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    update_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    points_awarded: Mapped[int | None] = mapped_column(Integer, nullable=True)
    points_breakdown: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)


class KnockoutPrediction(Base, UUIDPrimaryKeyMixin, UpdatedAtMixin):
    __tablename__ = "knockout_predictions"
    __table_args__ = (
        UniqueConstraint("player_id", "match_id", name="uq_knockout_predictions_player_match"),
        Index("ix_knockout_predictions_player_id", "player_id"),
        Index("ix_knockout_predictions_match_id", "match_id"),
    )

    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False
    )
    predicted_winner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    update_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    points_awarded: Mapped[int | None] = mapped_column(Integer, nullable=True)


class SpecialPrediction(Base, UUIDPrimaryKeyMixin, UpdatedAtMixin):
    __tablename__ = "special_predictions"
    __table_args__ = (
        UniqueConstraint("player_id", "prediction_type", name="uq_special_predictions_player_type"),
        Index("ix_special_predictions_player_id", "player_id"),
    )

    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    prediction_type: Mapped[SpecialPredictionType] = mapped_column(
        Enum(SpecialPredictionType, name="special_prediction_type", create_type=False),
        nullable=False,
    )
    predicted_team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    predicted_player_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    points_awarded: Mapped[int | None] = mapped_column(Integer, nullable=True)


class LeaderboardSnapshot(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "leaderboard_snapshots"
    __table_args__ = (
        Index(
            "ix_leaderboard_snapshots_snapshot_at_player_id",
            "snapshot_at",
            "player_id",
        ),
        Index("ix_leaderboard_snapshots_player_id", "player_id"),
    )

    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    total_points: Mapped[int] = mapped_column(Integer, nullable=False)
    match_points: Mapped[int] = mapped_column(Integer, nullable=False)
    knockout_winner_points: Mapped[int] = mapped_column(Integer, nullable=False)
    special_points: Mapped[int] = mapped_column(Integer, nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    triggered_by_match_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matches.id", ondelete="SET NULL"), nullable=True
    )


class PushSubscription(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "push_subscriptions"
    __table_args__ = (Index("ix_push_subscriptions_player_id", "player_id"),)

    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    subscription: Mapped[dict] = mapped_column(JSONB, nullable=False)
    device_hint: Mapped[str | None] = mapped_column(String(100), nullable=True)
    failed_send_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)


class NotificationPreferences(Base, UpdatedAtMixin):
    __tablename__ = "notification_preferences"

    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    deadline_warning: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    match_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    result_detected: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    leaderboard_shift: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    round_complete: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    match_postponed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    special_results: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    global_mute: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    quiet_hours_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True
    )
    quiet_hours_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True
    )
