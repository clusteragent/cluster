"""Social layer — X account linking and $CLST tips.

Both are wallet-signature-gated: you can only link an X handle to (or
tip from) a wallet you provably control. The X link is recorded
server-side against the signature — there is no OAuth round-trip yet,
so it is a *claim* bound to a wallet, one handle per wallet and one
wallet per handle. Tips record intent + counters; on-chain settlement
of $CLST requires the token to be deployed (pre-launch, so tx_hash
stays null and the UI says so rather than inventing a hash).
"""
from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import Float, func

from app.db import SessionLocal, SocialLink, TipEvent
from app.wallet_auth import require_wallet_auth

router = APIRouter()

HANDLE_RE = re.compile(r"^[A-Za-z0-9_]{1,15}$")


def _normalize_handle(handle: str) -> str:
    return handle.strip().lstrip("@").lower()


@router.get("/profile")
def profile(wallet: str) -> dict:
    """Public social profile: X link + tip counters. No auth — this is
    the publicly displayed profile (the wallet address is the identity)."""
    if not wallet:
        raise HTTPException(status_code=422, detail="wallet is required")
    w = wallet.lower()
    db = SessionLocal()
    try:
        link = db.query(SocialLink).filter(SocialLink.wallet == w).first()
        sent = db.query(func.count(TipEvent.id)).filter(TipEvent.from_wallet == w).scalar() or 0
        recv = db.query(func.count(TipEvent.id)).filter(TipEvent.to_wallet == w).scalar() or 0
        total = (
            db.query(func.coalesce(func.sum(func.cast(TipEvent.amount, Float)), 0.0))
            .filter(TipEvent.from_wallet == w)
            .scalar()
            or 0.0
        )
        return {
            "wallet": w,
            "x_handle": link.x_handle if link else None,
            "x_linked": bool(link and link.x_handle),
            "tips_sent": int(sent),
            "tips_received": int(recv),
            "tip_total_usd": float(total),
        }
    finally:
        db.close()


class LinkXRequest(BaseModel):
    wallet: str
    signature: str | None = None
    session_token: str | None = None
    handle: str


@router.post("/link-x")
def link_x(req: LinkXRequest) -> dict:
    """Link (or unlink, with an empty handle) an X account to a wallet."""
    require_wallet_auth(req.wallet, req.signature, req.session_token)
    w = req.wallet.lower()
    handle = _normalize_handle(req.handle)

    db = SessionLocal()
    try:
        link = db.query(SocialLink).filter(SocialLink.wallet == w).first()

        if not handle:  # unlink
            if link:
                link.x_handle = None
                db.commit()
            return {"linked": False, "handle": ""}

        if not HANDLE_RE.match(handle):
            raise HTTPException(status_code=422, detail="Invalid X handle")

        taken = db.query(SocialLink).filter(SocialLink.x_handle == handle, SocialLink.wallet != w).first()
        if taken:
            raise HTTPException(status_code=409, detail="This X handle is already linked to another wallet")

        if link is None:
            link = SocialLink(wallet=w, x_handle=handle)
            db.add(link)
        else:
            link.x_handle = handle
        db.commit()
        return {"linked": True, "handle": handle}
    finally:
        db.close()


class TipRequest(BaseModel):
    wallet: str
    signature: str | None = None
    session_token: str | None = None
    to: str
    amount: str
    note: str | None = None


@router.post("/tip")
def tip(req: TipRequest) -> dict:
    """Record a $CLST tip intent between two wallets."""
    require_wallet_auth(req.wallet, req.signature, req.session_token)
    to = req.to.strip().lower()
    if not to.startswith("0x") or len(to) != 42:
        raise HTTPException(status_code=422, detail="Recipient must be a 0x address")
    if to == req.wallet.lower():
        raise HTTPException(status_code=422, detail="Cannot tip yourself")

    try:
        amt = float(req.amount)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Amount must be a number")
    if amt <= 0 or amt > 1_000_000:
        raise HTTPException(status_code=422, detail="Amount out of range")

    db = SessionLocal()
    try:
        row = TipEvent(
            from_wallet=req.wallet.lower(),
            to_wallet=to,
            amount=str(req.amount),
            note=(req.note or "")[:280] or None,
            tx_hash=None,  # on-chain settlement needs $CLST deployed — never faked
        )
        db.add(row)
        db.commit()
        return {"recorded": True, "tx_hash": None, "note": "$CLST not deployed yet — tip intent recorded"}
    finally:
        db.close()
