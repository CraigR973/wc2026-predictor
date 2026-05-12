from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base, UpdatedAtMixin, UUIDPrimaryKeyMixin


class PlayerRole(StrEnum):
    player = "player"
    admin = "admin"


class Profile(Base, UUIDPrimaryKeyMixin, UpdatedAtMixin):
    __tablename__ = "profiles"
    __table_args__ = (UniqueConstraint("display_name", name="uq_profiles_display_name"),)

    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    pin_hash: Mapped[str] = mapped_column(String(60), nullable=False)
    role: Mapped[PlayerRole] = mapped_column(
        Enum(PlayerRole, name="player_role", create_type=False),
        nullable=False,
        server_default="player",
    )
    timezone: Mapped[str] = mapped_column(String(100), nullable=False, server_default="UTC")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    failed_login_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
