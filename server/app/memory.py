"""Pluggable memory layer.

get_memory_backend() returns whichever backend is configured via the
MEMORY_BACKEND env var:

  MEMORY_BACKEND=sqlite    (default) — zero external deps, works out
                            of the box on any VPS, no matter how small.
  MEMORY_BACKEND=hindsight — routes retain/recall to a running Hindsight
                            server (https://github.com/vectorize-io/hindsight).
                            Requires HINDSIGHT_URL (default
                            http://localhost:8888) and, if Hindsight
                            itself isn't pre-configured with a model,
                            HINDSIGHT_API_LLM_API_KEY.

Both backends implement the same tiny interface: retain() and recall().
Routes never talk to SQLite or Hindsight directly — always through this
module — so switching backends is a one-line env change.

DEDUP + TIME-DECAY (ported from finchagentic/mcp's local-memory.ts /
tools/memory.ts, adapted to this backend's shape):
  - retain() hashes normalized content (lowercase, whitespace-collapsed)
    and skips inserting an exact duplicate for the same bank_id unless
    force=True is passed — an agent re-emitting the same fact twice
    doesn't bloat the table.
  - recall() applies a 90-day exponential time-decay to keyword-match
    scores so recent notes outrank stale ones with similar wording,
    instead of pure recency or pure keyword-count ordering.
"""
from __future__ import annotations

import hashlib
import math
import os
from datetime import datetime
from typing import Protocol

DECAY_HALF_LIFE_DAYS = 90.0


def _content_hash(content: str) -> str:
    normalized = " ".join(content.lower().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


def _decay_weight(created_at: datetime) -> float:
    """Exponential decay: weight halves every DECAY_HALF_LIFE_DAYS."""
    age_days = max((datetime.utcnow() - created_at).total_seconds() / 86400.0, 0.0)
    return math.pow(0.5, age_days / DECAY_HALF_LIFE_DAYS)


class MemoryBackend(Protocol):
    def retain(self, bank_id: str, content: str, agent_id: str | None = None, **kw) -> dict: ...
    def recall(self, bank_id: str, query: str, limit: int = 10) -> list[dict]: ...


class SQLiteMemory:
    """Default backend — keyword search + time-decay ranking + dedup.

    No embeddings, no LLM calls: this is intentionally the "it always
    works, even on a 1GB VPS" fallback. Good enough for "what did agent
    X do for wallet Y" lookups; not a substitute for real semantic
    recall — upgrade to Hindsight when you have the resources.
    """

    def retain(
        self,
        bank_id: str,
        content: str,
        agent_id: str | None = None,
        title: str | None = None,
        tags: list[str] | None = None,
        force: bool = False,
    ) -> dict:
        from app.db import SessionLocal, MemoryNote

        content_hash = _content_hash(content)
        db = SessionLocal()
        try:
            if not force:
                existing = (
                    db.query(MemoryNote)
                    .filter(MemoryNote.bank_id == bank_id, MemoryNote.content_hash == content_hash)
                    .order_by(MemoryNote.created_at.desc())
                    .first()
                )
                if existing:
                    return {
                        "id": existing.id,
                        "content": existing.content,
                        "created_at": existing.created_at.isoformat(),
                        "deduplicated": True,
                    }

            note = MemoryNote(
                bank_id=bank_id,
                content=content,
                content_hash=content_hash,
                agent_id=agent_id,
                title=title,
                tags=",".join(tags) if tags else None,
            )
            db.add(note)
            db.commit()
            db.refresh(note)
            return {
                "id": note.id,
                "content": note.content,
                "created_at": note.created_at.isoformat(),
                "deduplicated": False,
            }
        finally:
            db.close()

    def recall(self, bank_id: str, query: str, limit: int = 10) -> list[dict]:
        from app.db import SessionLocal, MemoryNote

        db = SessionLocal()
        try:
            terms = [t for t in query.lower().split() if len(t) > 1] or [query.lower()]
            candidates = db.query(MemoryNote).filter(MemoryNote.bank_id == bank_id).all()

            scored: list[tuple[float, MemoryNote]] = []
            for note in candidates:
                haystack = note.content.lower()
                keyword_score = sum(1 for t in terms if t in haystack)
                if keyword_score == 0:
                    continue
                score = keyword_score * _decay_weight(note.created_at)
                scored.append((score, note))

            if not scored:
                # keyword miss — fall back to "recent notes for this bank",
                # still decay-weighted so it isn't pure insertion order
                candidates_sorted = sorted(candidates, key=lambda n: _decay_weight(n.created_at), reverse=True)
                scored = [(_decay_weight(n.created_at), n) for n in candidates_sorted[:limit]]
            else:
                scored.sort(key=lambda x: x[0], reverse=True)
                scored = scored[:limit]

            return [
                {
                    "id": n.id,
                    "content": n.content,
                    "title": n.title,
                    "tags": n.tags.split(",") if n.tags else [],
                    "agent_id": n.agent_id,
                    "created_at": n.created_at.isoformat(),
                    "score": round(s, 4),
                }
                for s, n in scored
            ]
        finally:
            db.close()

    def consolidate(self, bank_id: str, topic: str, summary: str, source_ids: list[int]) -> dict:
        """Two-pass consolidation (finchagentic/mcp pattern): the CALLER
        (an LLM with the recalled notes in context) decides the merged
        summary; this just stores it as a new note tagged 'consolidated'
        and leaves the originals untouched — no server-side LLM call.
        """
        return self.retain(
            bank_id=bank_id,
            content=summary,
            title=f"Consolidated: {topic}",
            tags=["consolidated", topic.lower().replace(" ", "-")],
            force=True,
        ) | {"source_ids": source_ids}


class HindsightMemory:
    """Adapter for a running Hindsight server (retain/recall via REST).

    Talks directly to Hindsight's REST API rather than a client SDK —
    verified against a live container (ghcr.io/vectorize-io/hindsight)
    on 2026-09-16:
      POST /v1/{tenant}/banks/{bank_id}/memories          {"items":[{"content": ...}]}
      POST /v1/{tenant}/banks/{bank_id}/memories/recall    {"query": ...}
    "default" is Hindsight's default tenant; HINDSIGHT_URL points at
    the API port (8888), not the control-plane UI port (9999).
    """

    def __init__(self) -> None:
        import httpx

        self._base_url = os.environ.get("HINDSIGHT_URL", "http://localhost:8888")
        self._tenant = os.environ.get("HINDSIGHT_TENANT", "default")
        # Hindsight calls out to an LLM to extract entities/facts on every
        # retain() — 15-20s is normal, cold calls can run longer. A short
        # httpx timeout here just turns a real request into a fake 500.
        self._client = httpx.Client(base_url=self._base_url, timeout=90.0)

    def _bank_path(self, bank_id: str) -> str:
        # Hindsight bank_ids are path segments — sanitize wallet
        # addresses (0x...) into something path-safe without losing
        # uniqueness.
        safe = bank_id.replace("/", "_")
        return f"/v1/{self._tenant}/banks/{safe}"

    def retain(self, bank_id: str, content: str, agent_id: str | None = None, **kw) -> dict:
        r = self._client.post(f"{self._bank_path(bank_id)}/memories", json={"items": [{"content": content}]})
        r.raise_for_status()
        return {"content": content, "agent_id": agent_id, "raw": r.json()}

    def recall(self, bank_id: str, query: str, limit: int = 10) -> list[dict]:
        r = self._client.post(f"{self._bank_path(bank_id)}/memories/recall", json={"query": query})
        r.raise_for_status()
        results = r.json().get("results", [])
        return results[:limit]


_backend_instance: MemoryBackend | None = None


def get_memory_backend() -> MemoryBackend:
    global _backend_instance
    if _backend_instance is not None:
        return _backend_instance

    backend_name = os.environ.get("MEMORY_BACKEND", "sqlite").lower()
    if backend_name == "hindsight":
        _backend_instance = HindsightMemory()
    else:
        _backend_instance = SQLiteMemory()
    return _backend_instance
