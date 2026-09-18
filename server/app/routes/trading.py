"""Trading intelligence routes — proxies to a running OpenCatz instance.

Wires the "Trading" category agents (Relay, Pivot) to a real screening
engine instead of a decorative UI button. OpenCatz
(dizcorvus/opencatz-ai-robinhood-chain, MIT) runs as its OWN separate
service — it is a full multi-agent Discord/Telegram/Terminal bot with
its own daemon, not something embedded into this process — and exposes
a REST API AgentIndex calls into.

Requires OPENCATZ_URL (default http://localhost:4671) and
OPENCATZ_API_KEY pointing at a running `node dist/index.js` from
/root/opencatz. If OpenCatz isn't running, every route here returns a
clear 503 — never a fabricated signal.
"""
from __future__ import annotations

import os

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter()

OPENCATZ_URL = os.environ.get("OPENCATZ_URL", "http://localhost:4671")
OPENCATZ_API_KEY = os.environ.get("OPENCATZ_API_KEY", "")


def _client() -> httpx.Client:
    headers = {"X-OpenCatz-Api-Key": OPENCATZ_API_KEY} if OPENCATZ_API_KEY else {}
    return httpx.Client(base_url=OPENCATZ_URL, headers=headers, timeout=15.0)


@router.get("/status")
def opencatz_status():
    """Live status of the OpenCatz screening engine — real or a clean 503."""
    try:
        with _client() as c:
            r = c.get("/health")
            r.raise_for_status()
            return r.json()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"OpenCatz engine unreachable at {OPENCATZ_URL} — start it with `node dist/index.js` in /root/opencatz. ({exc})",
        )
