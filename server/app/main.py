"""Cluster backend — FastAPI app.

Self-hostable backend for the Cluster web app:
- Serves the stock catalogue (tokenized equities on Robinhood Chain),
  portfolio holdings, and $CLST index membership
- Pluggable memory backend (SQLite by default, Hindsight when configured)
- Wallet-signature-gated writes/reads — see app/wallet_auth.py
- Exposed both as a REST API (consumed by the React frontend) and,
  indirectly, by the MCP server in ../mcp/server.py (which just calls
  this API over HTTP — same contract, no code duplication).
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routes import (
    agents, portfolio, runs, memory, market, auth, index_composition,
    trading, distributions, trade, chat, keys, social,
)

app = FastAPI(
    title="Cluster API",
    description="Self-hosted backend for Cluster — hold $CLST, own a slice of the index.",
    version="0.2.0",
)

# CORS: defaults to the local dev origins only. Set AGENTINDEX_CORS_ORIGINS
# to a comma-separated list of your deployed frontend origin(s) in
# production — DO NOT use "*" once real wallet auth is in front of this API,
# since a wildcard origin lets any website's JS call it as the visitor.
_default_origins = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
_cors_origins = os.environ.get("AGENTINDEX_CORS_ORIGINS", _default_origins).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "agentindex-api"}


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(memory.router, prefix="/api/memory", tags=["memory"])
app.include_router(market.router, prefix="/api/market", tags=["market"])
app.include_router(index_composition.router, prefix="/api/index", tags=["index"])
app.include_router(trading.router, prefix="/api/trading", tags=["trading"])
app.include_router(distributions.router, prefix="/api/distributions", tags=["distributions"])
app.include_router(trade.router, prefix="/api/trade", tags=["trade"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(keys.router, prefix="/api/keys", tags=["keys"])
app.include_router(social.router, prefix="/api/social", tags=["social"])
