"""Wallet auth routes — challenge/response for proving wallet ownership."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.wallet_auth import create_session, issue_challenge, verify_wallet_signature

router = APIRouter()


@router.get("/challenge")
def get_challenge(wallet: str = Query(..., description="EVM address requesting a signing challenge")):
    """Get a single-use message to sign with your wallet.

    Sign the returned `message` with personal_sign, then pass the
    resulting signature as `signature` on any wallet-scoped request
    (run_agent, memory retain/recall, portfolio) alongside `wallet`.
    """
    return issue_challenge(wallet)


class SessionRequest(BaseModel):
    wallet: str
    signature: str


@router.post("/session")
def create_session_route(body: SessionRequest) -> dict:
    """Exchange ONE wallet signature for a 30-minute session token.

    The frontend signs once per session and uses the token for all
    wallet-scoped calls — no more signing every request.
    """
    if not verify_wallet_signature(body.wallet, body.signature):
        raise HTTPException(status_code=401, detail="Wallet signature required or invalid/expired challenge")
    return create_session(body.wallet)
