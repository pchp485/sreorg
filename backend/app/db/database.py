"""Async SQLAlchemy engine/session factory.

Provides the async engine and a session dependency. Imported lazily so the app
can run without the optional ``sqlalchemy``/driver dependencies installed.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from app.config import Settings


class Database:
    def __init__(self, settings: Settings) -> None:
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        self._engine = create_async_engine(settings.database_url, future=True)
        self._sessionmaker = async_sessionmaker(self._engine, expire_on_commit=False)

    async def create_all(self) -> None:
        from app.db.models import Base

        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def session(self) -> AsyncIterator:
        async with self._sessionmaker() as session:
            yield session

    async def dispose(self) -> None:
        await self._engine.dispose()
