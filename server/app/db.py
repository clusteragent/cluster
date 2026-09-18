"""SQLite persistence layer.

Kept intentionally tiny (SQLAlchemy Core-lite via ORM) so a self-hoster
can run the whole backend with zero external services. One file = one
DB, no Postgres/Docker required. Swap MEMORY_BACKEND=hindsight in .env
to route memory reads/writes to a Hindsight server instead (see
app/memory/hindsight_adapter.py) without touching the routes.
"""
from __future__ import annotations

import os
from datetime import datetime

from sqlalchemy import create_engine, String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

DB_PATH = os.environ.get("AGENTINDEX_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "cluster.db"))
ENGINE = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=ENGINE, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


class RunEvent(Base):
    """One task/settlement event — the on-chain-ish 'history' row."""

    __tablename__ = "run_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agent_id: Mapped[str] = mapped_column(String, index=True)
    label: Mapped[str] = mapped_column(String)
    detail: Mapped[str] = mapped_column(String)
    reward: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String, default="review")  # review | landed
    wallet: Mapped[str] = mapped_column(String, index=True, default="default")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MemoryNote(Base):
    """A durable memory note about a wallet/agent relationship.

    This is the local (SQLite) fallback for the pluggable memory layer.
    When MEMORY_BACKEND=hindsight, writes/reads go through
    app/memory/hindsight_adapter.py instead and this table is unused.

    content_hash enables the dedup pattern ported from finchagentic/mcp:
    identical content (normalized: lowercase, whitespace-collapsed) is
    skipped on retain() unless force=True, so an agent that re-emits the
    same fact twice doesn't bloat the notes table.
    """

    __tablename__ = "memory_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bank_id: Mapped[str] = mapped_column(String, index=True, default="default")
    content: Mapped[str] = mapped_column(String)
    content_hash: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[str] = mapped_column(String, nullable=True)
    tags: Mapped[str] = mapped_column(String, nullable=True)  # comma-joined; SQLite has no array type
    agent_id: Mapped[str] = mapped_column(String, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


def init_db() -> None:
    Base.metadata.create_all(ENGINE)


class CreditAccount(Base):
    """Per-wallet inference credit — $8 granted once, spent by chat usage.

    Created lazily on first chat request for a wallet. `granted_usd` is
    the signup grant; `used_usd` accumulates metered cost. remaining =
    granted - used, floored at 0. No top-up path yet (pre-launch).
    """

    __tablename__ = "credit_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    wallet: Mapped[str] = mapped_column(String, index=True, unique=True)
    granted_usd: Mapped[float] = mapped_column(Float, default=8.0)
    used_usd: Mapped[float] = mapped_column(Float, default=0.0)
    requests: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    """One chat turn. Kept for the conversation list + memory feed."""

    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    wallet: Mapped[str] = mapped_column(String, index=True)
    conversation_id: Mapped[str] = mapped_column(String, index=True, default="default")
    role: Mapped[str] = mapped_column(String)  # user | assistant
    content: Mapped[str] = mapped_column(String)
    model: Mapped[str] = mapped_column(String, nullable=True)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ApiUsage(Base):
    """Per-request usage log for API keys. One row per billed request:
    chat completions, model listings, etc. Powers the Settings usage
    panel (requests, tokens, USD) and future per-key billing."""

    __tablename__ = "api_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key_id: Mapped[int] = mapped_column(Integer, index=True)
    wallet: Mapped[str] = mapped_column(String, index=True)
    endpoint: Mapped[str] = mapped_column(String)          # e.g. /api/chat
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class ApiKey(Base):
    """A generated API key. Only the SHA-256 hash is stored — the raw
    key is shown exactly once at creation (clst_<prefix>_<secret>)."""

    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    wallet: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    prefix: Mapped[str] = mapped_column(String, index=True)  # first 12 chars, safe to display
    key_hash: Mapped[str] = mapped_column(String, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_used_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    revoked: Mapped[int] = mapped_column(Integer, default=0)


class SocialLink(Base):
    """Wallet <-> X account link + tip counters."""

    __tablename__ = "social_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    wallet: Mapped[str] = mapped_column(String, index=True, unique=True)
    x_handle: Mapped[str] = mapped_column(String, nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TipEvent(Base):
    """A recorded $CLST tip intent between wallets (social layer)."""

    __tablename__ = "tip_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    from_wallet: Mapped[str] = mapped_column(String, index=True)
    to_wallet: Mapped[str] = mapped_column(String, index=True)
    amount: Mapped[str] = mapped_column(String)
    note: Mapped[str] = mapped_column(String, nullable=True)
    tx_hash: Mapped[str] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


def get_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
