"""Chat proxy — Cluster agents backed by the vikey.ai LLM gateway.

Every wallet gets $8 of inference credit on first use (no card, no
signup form — the wallet IS the account). Requests are proxied to the
gateway with the server-side key; usage is metered per token against
the credit account and the raw key never leaves the server.

Models are grouped for the picker: frontier, fast, reasoning, code.
Pricing is USD per 1M tokens (in, out) — used to meter credit. Numbers
are the gateway's published rates; keep this table in sync if the
gateway changes them.
"""
from __future__ import annotations

import os
from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import ChatMessage, CreditAccount, SessionLocal
from app.wallet_auth import require_wallet_auth
from app.db import ApiUsage
from app.routes.keys import resolve_key

router = APIRouter()

# --- simple per-wallet rate limit (in-memory fixed window, single worker) ---
import time as _time
from collections import defaultdict as _dd

_RATE_LIMIT = 30          # requests
_RATE_WINDOW = 60.0       # seconds
_rate_hits: dict[str, list[float]] = _dd(list)


def _rate_limit_check(wallet: str) -> None:
    now = _time.time()
    hits = _rate_hits[wallet]
    while hits and now - hits[0] > _RATE_WINDOW:
        hits.pop(0)
    if len(hits) >= _RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit: 30 chat requests per minute")
    hits.append(now)

GATEWAY_BASE = os.environ.get("AGENTINDEX_LLM_BASE_URL", "https://api.vikey.ai/v1")
GATEWAY_KEY = (
    os.environ.get("AGENTINDEX_LLM_API_KEY")
    or os.environ.get("HERMES_CUSTOM_API_VIKEY_AI_API_KEY")
    or ""
)
SIGNUP_CREDIT_USD = 5.0

SYSTEM_PROMPT = """You are the Cluster agent — the built-in AI of cluster, a self-hostable index of AI financial agents trading tokenized stocks on Robinhood Chain (chain id 4663, EVM-compatible, Uniswap v3 swaps via SwapRouter02 0xcaf681a66d020601342297493863e78c959e5cb2).

Product facts you KNOW (never say you lack information about Cluster):
- $CLST is the index token. It is cooming soon (pre-launch) — no contract address exists yet, nothing has been distributed, all payout figures are honest zeros until the first cycle lands.
- The universe: 192 tradeable instruments (tokenized stocks/ETFs on 4663). The payout basket: 19 curated names (NVDA is the largest weight), bought live by the keeper bot from accumulated fees.
- Mechanism: fees in -> vault buys the 19-name basket at market -> $CLST holders paid pro-rata every cycle. No smart-contract treasury — a keeper bot pattern (same family as its sibling deployments).
- The app: realtime markets (quotes, movers, sector heat, Yahoo news), in-app swaps on 4663, distribution transparency (every payout per address), chat with 24 models via the vikey gateway, API keys with per-request usage metering (requests, tokens, USD), wallet-signature auth (single-use nonce), $8 free inference credit per wallet.
- Install: MCP server (claude/codex/openclaw `mcp add cluster`), Hermes `hermes skill install`, npm `npm install cluster`, or clone github.com/rimurucook/cluster. Docs at /docs.

Style: concise, direct, numbers-first. Use the user's language (reply in Indonesian if they write Indonesian). If asked for live prices you don't have, say so and point to the Markets tab — never invent prices."""


# id -> (label, group, context, price_in, price_out) USD per 1M tokens
MODEL_TABLE: dict[str, tuple[str, str, int, float, float]] = {
    "openai/gpt-6-astra":       ("GPT-6 Astra",        "Frontier",  400_000, 2.50, 10.00),
    "openai/gpt-5.6-terra":     ("GPT-5.6 Terra",      "Frontier",  400_000, 2.00,  8.00),
    "openai/gpt-5.6-sol":       ("GPT-5.6 Sol",        "Frontier",  400_000, 1.80,  7.20),
    "openai/gpt-5.6-luna":      ("GPT-5.6 Luna",       "Fast",      256_000, 0.60,  2.40),
    "anthropic/claude-opus-5":  ("Claude Opus 5",      "Frontier",  500_000, 5.00, 25.00),
    "anthropic/claude-opus-4.8":("Claude Opus 4.8",    "Frontier",  500_000, 4.00, 20.00),
    "anthropic/claude-sonnet-5":("Claude Sonnet 5",    "Balanced",  500_000, 1.50,  7.50),
    "anthropic/claude-sonnet-4.6":("Claude Sonnet 4.6","Balanced",  500_000, 1.20,  6.00),
    "anthropic/claude-fable-5.1":("Claude Fable 5.1",  "Fast",      300_000, 0.50,  2.00),
    "anthropic/claude-fable-5": ("Claude Fable 5",     "Fast",      300_000, 0.40,  1.60),
    "gemini/gemini-3.8-flash":  ("Gemini 3.8 Flash",   "Fast",      500_000, 0.35,  1.40),
    "gemini/gemini-3.7-flash-high": ("Gemini 3.7 Flash High", "Reasoning", 500_000, 0.45, 1.80),
    "deepseek/deepseek-v4-pro": ("DeepSeek V4 Pro",    "Reasoning", 300_000, 0.55,  2.20),
    "deepseek/deepseek-v4.1-flash": ("DeepSeek V4.1 Flash", "Fast", 256_000, 0.25,  1.00),
    "deepseek/deepseek-v4-flash": ("DeepSeek V4 Flash", "Fast",     256_000, 0.20,  0.80),
    "moonshot/kimi-k3":         ("Kimi K3",            "Reasoning", 400_000, 0.70,  2.80),
    "moonshot/kimi-k2.7-code":  ("Kimi K2.7 Code",     "Code",      400_000, 0.60,  2.40),
    "qwen/qwen3.8-max":         ("Qwen 3.8 Max",       "Balanced",  300_000, 0.80,  3.20),
    "qwen/qwen3.6-plus-uncensored": ("Qwen 3.6 Plus",  "Balanced",  256_000, 0.45,  1.80),
    "zai/glm-5.3":              ("GLM 5.3",            "Balanced",  256_000, 0.50,  2.00),
    "glm/glm-5.3-flash":        ("GLM 5.3 Flash",      "Fast",      256_000, 0.15,  0.60),
    "minimax/minimax-m3":       ("MiniMax M3",         "Balanced",  300_000, 0.40,  1.60),
    "anthropic/claude-opus-4.7":("Claude Opus 4.7",    "Frontier",  500_000, 4.00, 20.00),
    "anthropic/claude-opus-4.6":("Claude Opus 4.6",    "Frontier",  500_000, 3.50, 17.50),
}

FALLBACK_PRICE = (1.00, 4.00)  # for an id not in the table


def _price(model: str) -> tuple[float, float]:
    entry = MODEL_TABLE.get(model)
    return (entry[3], entry[4]) if entry else FALLBACK_PRICE


def _account(db, wallet: str) -> CreditAccount:
    """Fetch-or-create the credit account. The wallet is the identity."""
    wallet = wallet.lower()
    acct = db.query(CreditAccount).filter(CreditAccount.wallet == wallet).first()
    if acct is None:
        acct = CreditAccount(wallet=wallet, granted_usd=SIGNUP_CREDIT_USD, used_usd=0.0, requests=0)
        db.add(acct)
        db.commit()
        db.refresh(acct)
    return acct


def _credits_payload(acct: CreditAccount) -> dict:
    remaining = max(0.0, acct.granted_usd - acct.used_usd)
    return {
        "wallet": acct.wallet,
        "granted_usd": round(acct.granted_usd, 6),
        "used_usd": round(acct.used_usd, 6),
        "remaining_usd": round(remaining, 6),
        "requests": acct.requests,
    }


@router.get("/models")
def list_models() -> dict:
    """The model catalogue for the picker. Public — no auth needed."""
    models = [
        {"id": mid, "label": label, "group": group, "context": ctx}
        for mid, (label, group, ctx, _pi, _po) in MODEL_TABLE.items()
    ]
    groups = []
    for m in models:
        if m["group"] not in groups:
            groups.append(m["group"])
    return {
        "models": models,
        "groups": groups,
        "credit_usd": SIGNUP_CREDIT_USD,
        "note": f"${SIGNUP_CREDIT_USD:.0f} signup credit per wallet. Metered per token.",
    }


@router.get("/credits")
def get_credits(wallet: str) -> dict:
    """Remaining credit for a wallet. Read-only — creates the account
    (with the grant) on first call so the UI can show $8 immediately."""
    if not wallet:
        raise HTTPException(status_code=422, detail="wallet is required")
    db = SessionLocal()
    try:
        acct = _account(db, wallet)
        return _credits_payload(acct)
    finally:
        db.close()


class ChatRequest(BaseModel):
    wallet: str
    model: str
    messages: list[dict]
    signature: str | None = None
    session_token: str | None = None
    conversation_id: str | None = None
    api_key: str | None = None  # Bearer key from external callers — logs usage per request
    thinking: bool = False  # extended reasoning pass for supported models


@router.post("")
def chat(req: ChatRequest) -> dict:
    """One completion. Proxies to the gateway, meters usage, stores the turn.

    Auth: EITHER a fresh wallet signature (in-app path) OR a valid API
    key (external caller path — billed per request against the key)."""
    db = SessionLocal()
    try:
        key_row = resolve_key(req.api_key) if req.api_key else None
        if req.api_key and key_row is None:
            raise HTTPException(status_code=401, detail="Invalid or revoked API key")
    finally:
        db.close()
    if key_row is None:
        require_wallet_auth(req.wallet, req.signature, req.session_token)  # in-app path needs the signature
    if not GATEWAY_KEY:
        raise HTTPException(status_code=503, detail="LLM gateway key not configured on this server")
    if req.model not in MODEL_TABLE:
        raise HTTPException(status_code=422, detail=f"Unknown model '{req.model}'")
    if not req.messages:
        raise HTTPException(status_code=422, detail="messages must not be empty")

    _rate_limit_check(req.wallet.lower())
    db = SessionLocal()
    try:
        acct = _account(db, req.wallet)
        remaining = max(0.0, acct.granted_usd - acct.used_usd)
        if remaining <= 0:
            raise HTTPException(status_code=402, detail="Credit exhausted. Top-ups are not open yet.")

        # Reserve the worst-case cost up front (committed immediately) so two
        # concurrent requests can't both pass this check and double-spend the
        # last cents of the $8. Post-response usage metering is the true-up.
        est_pi, est_po = _price(req.model)
        estimate = min(
            (800 / 1_000_000.0) * est_pi + (2048 / 1_000_000.0) * est_po,
            remaining,
        )
        acct.used_usd = float(acct.used_usd) + estimate
        db.commit()

        def _unreserve() -> None:
            acct.used_usd = max(0.0, float(acct.used_usd) - estimate)
            db.commit()

        try:
            with httpx.Client(timeout=180.0) as client:
                res = client.post(
                    f"{GATEWAY_BASE}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {GATEWAY_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": req.model,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            *([{"role": "system", "content": "Think through this problem step by step with maximum rigor before answering. Consider multiple approaches, verify your reasoning, and check for errors before giving the final answer."}] if req.thinking else []),
                            *req.messages,
                        ],
                        "max_tokens": 4096 if req.thinking else 2048,
                    },
                )
        except httpx.HTTPError as exc:
            _unreserve()
            raise HTTPException(status_code=502, detail=f"LLM gateway unreachable: {exc}") from exc

        if res.status_code != 200:
            _unreserve()
            raise HTTPException(status_code=502, detail=f"LLM gateway error {res.status_code}: {res.text[:300]}")

        data = res.json()
        choices = data.get("choices") or []
        if not choices:
            _unreserve()
            raise HTTPException(status_code=502, detail="LLM gateway returned no choices")
        reply = (choices[0].get("message") or {}).get("content") or ""

        usage = data.get("usage") or {}
        pt = int(usage.get("prompt_tokens") or 0)
        ct = int(usage.get("completion_tokens") or 0)
        pi, po = _price(req.model)
        cost = (pt / 1_000_000.0) * pi + (ct / 1_000_000.0) * po

        # True-up: swap the reservation for the real token cost.
        acct.used_usd = max(0.0, float(acct.used_usd) - estimate + cost)
        acct.requests = int(acct.requests) + 1
        acct.updated_at = datetime.utcnow()

        # Usage log — one row per billed request (per API key)
        if key_row is not None:
            db.add(ApiUsage(
                key_id=key_row["id"], wallet=req.wallet.lower(), endpoint="/api/chat",
                model=req.model, prompt_tokens=pt, completion_tokens=ct, cost_usd=cost,
            ))

        conv = req.conversation_id or "default"
        last_user = next((m for m in reversed(req.messages) if m.get("role") == "user"), None)
        if last_user:
            db.add(ChatMessage(
                wallet=req.wallet.lower(), conversation_id=conv,
                role="user", content=str(last_user.get("content", ""))[:8000], model=req.model,
            ))
        db.add(ChatMessage(
            wallet=req.wallet.lower(), conversation_id=conv,
            role="assistant", content=reply[:8000], model=req.model, cost_usd=cost,
        ))
        db.commit()
        db.refresh(acct)

        return {
            "reply": reply,
            "model": req.model,
            "usage": {"prompt_tokens": pt, "completion_tokens": ct, "cost_usd": round(cost, 6)},
            "credit": {"remaining_usd": round(max(0.0, acct.granted_usd - acct.used_usd), 6),
                       "used_usd": round(acct.used_usd, 6)},
        }
    finally:
        db.close()


@router.get("/conversations")
def conversations(wallet: str, signature: str | None = None, session_token: str | None = None) -> dict:
    """Conversation list (grouped turns) for a wallet. Requires wallet auth —
    titles are derived from user message content, so this is private data."""
    if not wallet:
        raise HTTPException(status_code=422, detail="wallet is required")
    require_wallet_auth(wallet, signature, session_token)
    db = SessionLocal()
    try:
        rows = (
            db.query(ChatMessage)
            .filter(ChatMessage.wallet == wallet.lower())
            .order_by(ChatMessage.created_at.desc())
            .limit(500)
            .all()
        )
        by_conv: dict[str, dict] = {}
        for r in rows:
            c = by_conv.setdefault(r.conversation_id, {
                "id": r.conversation_id, "title": "", "model": r.model or "",
                "created_at": r.created_at.isoformat(), "messages": 0,
            })
            c["messages"] += 1
            if r.role == "user" and not c["title"]:
                c["title"] = r.content[:80]
        return {"conversations": list(by_conv.values())}
    finally:
        db.close()
