"""Add specials_revealed to notification_type enum

Revision ID: 032
Revises: 031
Create Date: 2026-06-11
"""

from alembic import op

revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'specials_revealed'")


def downgrade() -> None:
    pass  # Postgres does not support removing enum values
