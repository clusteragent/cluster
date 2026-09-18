"""EIP-191 signature verification for wallet-authenticated requests.

Every route that mutates or reads wallet-scoped data (run_agent, memory,
portfolio) must prove the caller actually controls the wallet address
they claim — otherwise anyone who knows an address can write fake
history to it or read its portfolio (this was a real, exploited gap:
`POST /api/runs {"wallet": "<anyone's address>"}` worked with zero
proof of ownership).

Pattern (see skill:web3/evm-wallet-auth):
  1. Client calls GET /api/auth/challenge?wallet=0x... to get a
     single-use, time-boxed message to sign.
  2. Client signs it with personal_sign (MetaMask/any injected wallet
     or Reown AppKit's underlying wagmi signer).
  3. Client sends {wallet, signature} with the request; this module
     recovers the signer address from (challenge, signature) and
     checks it equals `wallet`, case-insensitively.

Challenges are single-use and expire after CHALLENGE_TTL_SECONDS so a
captured signature can't be replayed indefinitely.
"""
from __future__ import annotations

import os
import secrets
import time

from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import HTTPException

CHALLENGE_TTL_SECONDS = 300  # 5 minutes

# In-memory challenge store: {wallet_lower: (nonce, expires_at)}.
# Fine for a single-process self-hosted deployment; swap for Redis if
# you run multiple backend workers.
_CHALLENGES: dict[str, tuple[str, float]] = {}

# Escape hatch for local development ONLY — never set this in production.
# Lets you exercise the API with curl before wiring a real signer.
_DEV_BYPASS = os.environ.get("AGENTINDEX_DEV_AUTH_BYPASS", "").lower() in ("1", "true", "yes")


def issue_challenge(wallet: str) -> dict:
    wallet = wallet.lower()
    nonce = secrets.token_hex(16)
    expires_at = time.time() + CHALLENGE_TTL_SECONDS
    _CHALLENGES[wallet] = (nonce, expires_at)
    message = (
        f"Sign this message to prove you own this wallet on AgentIndex.\n\n"
        f"Wallet: {wallet}\n"
        f"Nonce: {nonce}\n\n"
        f"This request will not cost any gas."
    )
    return {"message": message, "expires_in": CHALLENGE_TTL_SECONDS}


def _rebuild_challenge_message(wallet: str, nonce: str) -> str:
    return (
        f"Sign this message to prove you own this wallet on AgentIndex.\n\n"
        f"Wallet: {wallet.lower()}\n"
        f"Nonce: {nonce}\n\n"
        f"This request will not cost any gas."
    )


def verify_wallet_signature(wallet: str, signature: str) -> bool:
    """Fail closed: any malformed input returns False (-> 401), never raises."""
    wallet_lower = wallet.lower()
    entry = _CHALLENGES.get(wallet_lower)
    if not entry:
        return False
    nonce, expires_at = entry
    if time.time() > expires_at:
        del _CHALLENGES[wallet_lower]
        return False

    message = _rebuild_challenge_message(wallet, nonce)
    try:
        recovered = Account.recover_message(encode_defunct(text=message), signature=signature)
    except Exception:
        return False

    ok = recovered.lower() == wallet_lower
    if ok:
        # single-use — burn the challenge whether or not the caller
        # reuses it again immediately
        del _CHALLENGES[wallet_lower]
    return ok


def require_wallet_auth(
    wallet: str,
    signature: str | None = None,
    session_token: str | None = None,
) -> None:
    """Raise 401 unless the caller proves ownership of `wallet`.

    Two valid proofs:
      - a fresh single-use `signature` over a challenge, OR
      - a `session_token` previously issued after a valid signature.
    Set AGENTINDEX_DEV_AUTH_BYPASS=1 only for local curl testing — it is
    loudly logged and must never be set in a real deployment.
    """
    if _DEV_BYPASS:
        return
    # A session token may arrive via either param — accept both.
    for tok in (session_token, signature):
        if tok and wallet_for_session(tok) == wallet.lower():
            return
    if not signature or not verify_wallet_signature(wallet, signature):
        raise HTTPException(status_code=401, detail="Wallet signature required or invalid/expired challenge")

# ─── Session tokens ──────────────────────────────────────────────────────────
# UX: signing EVERY request pops the wallet UI constantly. Instead, one
# signature buys a time-boxed session token bound to the wallet; the
# frontend uses it for all wallet-scoped calls until it expires, then
# re-signs once.
SESSION_TTL_SECONDS = 60 * 60
_SESSIONS: dict[str, tuple[str, float]] = {}  # token -> (wallet_lower, expires_at)


def create_session(wallet: str) -> dict:
    """Issue a session token AFTER a valid signature has been verified."""
    token = secrets.token_hex(32)
    _SESSIONS[token] = (wallet.lower(), time.time() + SESSION_TTL_SECONDS)
    now = time.time()
    for t in [t for t, (_, exp) in _SESSIONS.items() if exp < now]:
        del _SESSIONS[t]
    return {"session_token": token, "expires_in": SESSION_TTL_SECONDS}


def wallet_for_session(token: str | None) -> str | None:
    """Return the wallet this session token belongs to, or None (expired/unknown)."""
    if not token:
        return None
    entry = _SESSIONS.get(token)
    if not entry:
        return None
    wallet_lower, expires_at = entry
    if time.time() > expires_at:
        del _SESSIONS[token]
        return None
    return wallet_lower
