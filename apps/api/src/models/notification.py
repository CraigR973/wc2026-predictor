import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, UUIDPrimaryKeyMixin


class NotificationType(StrEnum):
    deadline_warning = "deadline_warning"
    match_locked = "match_locked"
    result_detected = "result_detected"
    leaderboard_shift = "leaderboard_shift"
    round_complete = "round_complete"
    match_postponed = "match_postponed"
    kickoff_changed = "kickoff_changed"
    invite_accepted = "invite_accepted"
    auto_sync_failed = "auto_sync_failed"
    special_results = "special_results"


class DeliveryStatus(StrEnum):
    sent = "sent"
    failed = "failed"
    expired = "expired"
    suppressed = "suppressed"


class ActorType(StrEnum):
    admin = "admin"
    player = "player"
    system = "system"


class ActionType(StrEnum):
    result_auto_fetched = "result_auto_fetched"
    result_manual_entered = "result_manual_entered"
    result_overridden = "result_overridden"
    match_postponed = "match_postponed"
    match_rescheduled = "match_rescheduled"
    match_cancelled = "match_cancelled"
    kickoff_changed = "kickoff_changed"
    predictions_locked = "predictions_locked"
    player_removed = "player_removed"
    player_pin_reset = "player_pin_reset"
    invite_created = "invite_created"
    invite_revoked = "invite_revoked"
    knockout_advanced = "knockout_advanced"
    special_awarded = "special_awarded"
    sync_triggered = "sync_triggered"
    sync_failed = "sync_failed"
    tiebreaker_overridden = "tiebreaker_overridden"
    backup_failed = "backup_failed"
    backup_downloaded = "backup_downloaded"


class NotificationLog(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "notification_log"
    __table_args__ = (
        Index("ix_notification_log_player_id", "player_id"),
        Index("ix_notification_log_sent_at", "sent_at"),
    )

    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type", create_type=False),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    match_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matches.id", ondelete="SET NULL"), nullable=True
    )
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    delivery_status: Mapped[DeliveryStatus] = mapped_column(
        Enum(DeliveryStatus, name="delivery_status", create_type=False),
        nullable=False,
    )


class AuditLog(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_log_actor_id", "actor_id"),
        Index("ix_audit_log_timestamp", "timestamp"),
        Index("ix_audit_log_action_type", "action_type"),
    )

    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    actor_type: Mapped[ActorType] = mapped_column(
        Enum(ActorType, name="actor_type", create_type=False),
        nullable=False,
    )
    action_type: Mapped[ActionType] = mapped_column(
        Enum(ActionType, name="action_type", create_type=False),
        nullable=False,
    )
    target_table: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    changes: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default="now()", nullable=False
    )
