"""Portfolio & activity routes.

The wallet's real "position" is its $CLST token balance, read on-chain
by the frontend (useReadContract against AGENTINDEX_CLST_TOKEN_ADDRESS)
— this backend cannot and does not fabricate that number. What it does
serve: the agent-interaction activity log (for history/audit) and,
once $CLST is deployed, the proportional stock exposure computed from
the wallet's on-chain balance (frontend passes the balance in; this
endpoint never invents one).
"""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.db import SessionLocal, RunEvent
from app.agents_catalogue import AGENTS_BY_ID
from app.wallet_auth import require_wallet_auth

router = APIRouter()


@router.get("")
def get_portfolio(wallet: str = Query("default"), signature: str | None = Query(None), session_token: str | None = Query(None)):
    """Agent-interaction activity summary for a wallet.

    Does NOT return a token balance or reward total — those are either
    read live on-chain by the frontend (once $CLST is deployed) or
    simply don't exist yet. This is purely "how many agent
    capabilities has this wallet tried", for the activity feed.
    """
    require_wallet_auth(wallet, signature, session_token)
    db = SessionLocal()
    try:
        events = (
            db.query(RunEvent)
            .filter(RunEvent.wallet == wallet)
            .order_by(RunEvent.created_at.desc())
            .all()
        )
        agents_tried = {e.agent_id for e in events}
        rows = [
            {
                "id": e.id,
                "agent_id": e.agent_id,
                "agent_name": AGENTS_BY_ID.get(e.agent_id, {}).get("name", e.agent_id),
                "detail": e.detail,
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ]
        return {
            "wallet": wallet,
            "agents_tried_count": len(agents_tried),
            "activity": rows,
        }
    finally:
        db.close()


@router.get("/history")
def get_history(wallet: str = Query("default"), signature: str | None = Query(None), session_token: str | None = Query(None)):
    require_wallet_auth(wallet, signature, session_token)
    db = SessionLocal()
    try:
        events = (
            db.query(RunEvent)
            .filter(RunEvent.wallet == wallet)
            .order_by(RunEvent.created_at.desc())
            .all()
        )
        return {
            "wallet": wallet,
            "events": [
                {
                    "id": e.id,
                    "agent_id": e.agent_id,
                    "agent_name": AGENTS_BY_ID.get(e.agent_id, {}).get("name", e.agent_id),
                    "detail": e.detail,
                    "status": e.status,
                    "created_at": e.created_at.isoformat(),
                }
                for e in events
            ],
        }
    finally:
        db.close()
