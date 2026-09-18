"""Agent activity log — NOT a reward mechanic.

Historical note: this used to generate a random "reward" per run,
implying running an agent earned $CLST. That was wrong on two counts:
(1) $CLST has never been deployed, so no reward could ever settle, and
(2) the actual product model is "hold $CLST, get proportional exposure
to the index basket" — holding, not running agents, is what pays.

This endpoint now just logs that a wallet interacted with an agent
capability (useful for the memory/history feed and for MCP clients
that want an audit trail) with reward always 0 and status always
"logged" — no fabricated settlement number, ever.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents_catalogue import AGENTS_BY_ID
from app.db import SessionLocal, RunEvent
from app.memory import get_memory_backend
from app.wallet_auth import require_wallet_auth

router = APIRouter()


class RunRequest(BaseModel):
    agent_id: str
    wallet: str = "default"
    signature: str | None = None
    session_token: str | None = None
    label: str | None = None


class RunResponse(BaseModel):
    id: int
    agent_id: str
    label: str
    detail: str
    reward: float
    status: str
    created_at: str


@router.post("", response_model=RunResponse)
def run_agent(req: RunRequest):
    require_wallet_auth(req.wallet, req.signature, req.session_token)
    agent = AGENTS_BY_ID.get(req.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{req.agent_id}' not found")

    label = req.label or f"{agent['name']} task"

    db = SessionLocal()
    try:
        event = RunEvent(
            agent_id=agent["id"],
            label=agent["name"],
            detail=label,
            reward=0.0,  # never fabricated — see module docstring
            status="logged",
            wallet=req.wallet,
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        result = RunResponse(
            id=event.id,
            agent_id=event.agent_id,
            label=event.label,
            detail=event.detail,
            reward=event.reward,
            status=event.status,
            created_at=event.created_at.isoformat(),
        )
    finally:
        db.close()

    get_memory_backend().retain(
        bank_id=req.wallet,
        content=f"Interacted with {agent['name']} ({agent['ticker']}): '{label}'",
        agent_id=agent["id"],
    )
    return result
