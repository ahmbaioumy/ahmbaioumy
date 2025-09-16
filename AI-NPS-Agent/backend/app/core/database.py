from __future__ import annotations

import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings


Base = declarative_base()

engine = None
async_session_maker: sessionmaker | None = None


def init_engine_and_session() -> None:
    global engine, async_session_maker
    db_path = settings.sqlite_db_path
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    database_url = f"sqlite+aiosqlite:///{db_path}"
    engine = create_async_engine(database_url, echo=False, future=True)
    async_session_maker = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if async_session_maker is None:
        init_engine_and_session()
    assert async_session_maker is not None
    async with async_session_maker() as session:  # type: ignore[arg-type]
        yield session


async def create_all_tables() -> None:
    assert engine is not None
    from app.models import ChatSession, ChatMessage, NPSRecord  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

