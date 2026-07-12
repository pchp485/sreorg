"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "voice_profiles",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("users.id"), index=True),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("sample_count", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), index=True),
        sa.Column("event", sa.String(64), nullable=False),
        sa.Column("user_id", sa.String(64), nullable=True),
        sa.Column("role", sa.String(32), nullable=True),
        sa.Column("outcome", sa.String(32), nullable=False, index=True),
        sa.Column("session_id", sa.String(128), nullable=True),
        sa.Column("detail", sa.JSON),
    )
    op.create_table(
        "devices",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("domain", sa.String(32), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("metadata", sa.JSON),
    )
    op.create_table(
        "permission_overrides",
        sa.Column("role", sa.String(32), primary_key=True),
        sa.Column("categories", sa.JSON),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.Column("note", sa.Text, nullable=True),
    )


def downgrade() -> None:
    for table in (
        "permission_overrides",
        "devices",
        "audit_events",
        "voice_profiles",
        "users",
    ):
        op.drop_table(table)
