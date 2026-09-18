"""API keys — self-serve issuance for the AgentIndex endpoint.

The wallet signature IS the auth: you prove you control the wallet, and
the key is bound to it. Only the SHA-256 hash is persisted — the raw
key (`aix_<prefix>_<secret>`) is returned exactly once at creation and
is unrecoverable afterwards, same as GitHub/OpenAI/Stripe tokens.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import ApiKey, ApiUsage, SessionLocal
from app.wallet_auth import require_wallet_auth

router = APIRouter()

KEY_PREFIX = "clst"


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _public(row: ApiKey) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "prefix": row.prefix,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "last_used_at": row.last_used_at.isoformat() if row.last_used_at else None,
        "revoked": bool(row.revoked),
    }


@router.get("")
def list_keys(wallet: str, signature: str | None = None, session_token: str | None = None) -> dict:
    require_wallet_auth(wallet, signature, session_token)
    db = SessionLocal()
    try:
        rows = (
            db.query(ApiKey)
            .filter(ApiKey.wallet == wallet.lower())
            .order_by(ApiKey.created_at.desc())
            .all()
        )
        return {"keys": [_public(r) for r in rows]}
    finally:
        db.close()


class CreateKeyRequest(BaseModel):
    wallet: str
    signature: str | None = None
    session_token: str | None = None
    name: str = "default"


@router.post("")
def create_key(req: CreateKeyRequest) -> dict:
    require_wallet_auth(req.wallet, req.signature, req.session_token)
    name = (req.name or "default").strip()[:64]
    if not name:
        raise HTTPException(status_code=422, detail="name is required")

    db = SessionLocal()
    try:
        active = (
            db.query(ApiKey)
            .filter(ApiKey.wallet == req.wallet.lower(), ApiKey.revoked == 0)
            .count()
        )
        if active >= 20:
            raise HTTPException(status_code=429, detail="Key limit reached (20 active). Revoke one first.")

        prefix = secrets.token_hex(4)          # 8 hex chars, shown in listings
        secret = secrets.token_urlsafe(24)
        raw = f"{KEY_PREFIX}_{prefix}_{secret}"
        row = ApiKey(
            wallet=req.wallet.lower(),
            name=name,
            prefix=f"{KEY_PREFIX}_{prefix}",
            key_hash=_hash(raw),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {
            "key": raw,           # shown ONCE — never stored in plaintext
            "id": row.id,
            "name": row.name,
            "created_at": row.created_at.isoformat(),
        }
    finally:
        db.close()


class RevokeRequest(BaseModel):
    wallet: str
    signature: str | None = None
    session_token: str | None = None


@router.delete("/{key_id}")
def revoke_key(key_id: int, req: RevokeRequest) -> dict:
    require_wallet_auth(req.wallet, req.signature, req.session_token)
    db = SessionLocal()
    try:
        row = (
            db.query(ApiKey)
            .filter(ApiKey.id == key_id, ApiKey.wallet == req.wallet.lower())
            .first()
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Key not found")
        row.revoked = 1
        db.commit()
        return {"revoked": True}
    finally:
        db.close()


@router.get("/usage")
def usage_summary(wallet: str, signature: str | None = None, session_token: str | None = None) -> dict:
    """Per-key usage for the wallet: requests, tokens, USD — 30d + all-time."""
    require_wallet_auth(wallet, signature, session_token)
    db = SessionLocal()
    try:
        rows = (
            db.query(ApiUsage)
            .filter(ApiUsage.wallet == wallet.lower())
            .order_by(ApiUsage.created_at.desc())
            .limit(2000)
            .all()
        )
        keys = {r.id: r for r in db.query(ApiKey).filter(ApiKey.wallet == wallet.lower()).all()}

        def bucket(rs):
            return {
                "requests": len(rs),
                "prompt_tokens": sum(r.prompt_tokens for r in rs),
                "completion_tokens": sum(r.completion_tokens for r in rs),
                "cost_usd": round(sum(r.cost_usd for r in rs), 6),
            }

        cutoff = datetime.utcnow() - timedelta(days=30)
        recent = [r for r in rows if r.created_at and r.created_at >= cutoff]
        by_key: dict[int, dict] = {}
        for r in rows:
            k = by_key.setdefault(r.key_id, {
                "name": keys[r.key_id].name if r.key_id in keys else "deleted",
                "prefix": keys[r.key_id].prefix if r.key_id in keys else "?",
                "all": {"requests": 0, "prompt_tokens": 0, "completion_tokens": 0, "cost_usd": 0.0},
                "recent": {"requests": 0, "prompt_tokens": 0, "completion_tokens": 0, "cost_usd": 0.0},
                "last_used": None,
            })
            in30 = r.created_at and r.created_at >= cutoff
            for pool, take in ((k["all"], True), (k["recent"], in30)):
                if not take:
                    continue
                pool["requests"] += 1
                pool["prompt_tokens"] += r.prompt_tokens
                pool["completion_tokens"] += r.completion_tokens
                pool["cost_usd"] = round(pool["cost_usd"] + r.cost_usd, 6)
            created_iso = r.created_at.isoformat() if r.created_at else None
            if k["last_used"] is None or (created_iso and created_iso > (k["last_used"] or "")):
                k["last_used"] = created_iso
        return {
            "totals": {"all": bucket(rows), "recent_30d": bucket(recent)},
            "keys": [
                {"key_id": kid, **k, "last_used": k["last_used"]}
                for kid, k in sorted(by_key.items(), key=lambda kv: -(kv[1]["all"]["requests"]))
            ],
        }
    finally:
        db.close()


def resolve_key(raw: str) -> dict | None:
    """Look up a live key by its raw value; bump last_used_at. Returns a
    plain dict (id, wallet, name, prefix) — safe to use after the session
    closes (never hand out detached ORM objects)."""
    db = SessionLocal()
    try:
        row = db.query(ApiKey).filter(ApiKey.key_hash == _hash(raw), ApiKey.revoked == 0).first()
        if row is None:
            return None
        row.last_used_at = datetime.utcnow()
        db.commit()
        return {"id": row.id, "wallet": row.wallet, "name": row.name, "prefix": row.prefix}
    finally:
        db.close()
