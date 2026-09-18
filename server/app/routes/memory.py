"""Memory routes — thin HTTP wrapper over the pluggable memory backend.

Exists mainly so the MCP server (and any external agent) can call
retain/recall over plain HTTP without needing direct DB or Hindsight
access — one contract, works no matter which backend is configured.

Wallet-signature gated: bank_id is normally a wallet address, and
without a signature check anyone could write/read memory notes for a
wallet they don't control (same class of bug as the portfolio/runs
routes — see app/wallet_auth.py).
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.memory import get_memory_backend
from app.wallet_auth import require_wallet_auth

router = APIRouter()

MAX_CONTENT_CHARS = 4000  # a memory note is a fact, not a document — keep it bounded


class RetainRequest(BaseModel):
    bank_id: str = "default"
    content: str = Field(..., min_length=1, max_length=MAX_CONTENT_CHARS)
    signature: str | None = None
    session_token: str | None = None
    agent_id: str | None = None
    title: str | None = Field(None, max_length=200)
    tags: list[str] | None = None
    force: bool = False  # bypass dedup — see app/memory.py::SQLiteMemory.retain


class RecallRequest(BaseModel):
    bank_id: str = "default"
    query: str = Field(..., min_length=1, max_length=500)
    signature: str | None = None
    session_token: str | None = None
    limit: int = Field(10, ge=1, le=50)


class ConsolidateRequest(BaseModel):
    bank_id: str = "default"
    signature: str | None = None
    session_token: str | None = None
    topic: str = Field(..., max_length=200)
    summary: str = Field(..., min_length=1, max_length=MAX_CONTENT_CHARS)
    source_ids: list[int] = []


@router.post("/retain")
def retain(req: RetainRequest):
    require_wallet_auth(req.bank_id, req.signature, req.session_token)
    result = get_memory_backend().retain(
        bank_id=req.bank_id,
        content=req.content,
        agent_id=req.agent_id,
        title=req.title,
        tags=req.tags,
        force=req.force,
    )
    return {"ok": True, "result": result}


@router.post("/recall")
def recall(req: RecallRequest):
    require_wallet_auth(req.bank_id, req.signature, req.session_token)
    results = get_memory_backend().recall(bank_id=req.bank_id, query=req.query, limit=req.limit)
    return {"ok": True, "count": len(results), "results": results}


@router.post("/consolidate")
def consolidate(req: ConsolidateRequest):
    """Two-pass consolidation: caller (an LLM) already recalled the
    fragmented notes and decided the merged summary — this just stores
    it. See app/memory.py::SQLiteMemory.consolidate for the rationale
    (ported from finchagentic/mcp's memory_consolidate tool).
    """
    require_wallet_auth(req.bank_id, req.signature, req.session_token)
    backend = get_memory_backend()
    if not hasattr(backend, "consolidate"):
        return {"ok": False, "error": "consolidate() not supported on the active memory backend"}
    result = backend.consolidate(req.bank_id, req.topic, req.summary, req.source_ids)
    return {"ok": True, "result": result}
