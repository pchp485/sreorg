"""SQLAlchemy ORM models (production persistence layer).

These mirror the domain: users, their voice profiles, the audit trail, and
known devices. The runtime defaults to an in-memory user directory so the app
boots without a database; wiring a repository over these models is the
production path (see ``repositories.py``). Alembic manages migrations.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def _utcnow() -> datetime:
    return datetime.now(UTC)


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    voice_profiles: Mapped[list[VoiceProfileModel]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class VoiceProfileModel(Base):
    __tablename__ = "voice_profiles"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    sample_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped[UserModel] = relationship(back_populates="voice_profiles")


class AuditEventModel(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, index=True
    )
    event: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    session_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    detail: Mapped[dict] = mapped_column(JSON, default=dict)


class DeviceModel(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    domain: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)


class PermissionOverrideModel(Base):
    __tablename__ = "permission_overrides"

    role: Mapped[str] = mapped_column(String(32), primary_key=True)
    categories: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
