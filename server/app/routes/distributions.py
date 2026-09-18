"""Distribution feed — the public record of every cycle that paid holders.

Architecture (same no-smart-contract pattern as Stock Divvy / Kumo /
SPX500): the treasury receives fees → a keeper bot buys the stock basket
on Uniswap on Robinhood Chain → the bot pushes a pro-rata slice of each
instrument to every eligible $CLST holder. The bot publishes a static JSON
snapshot (a ``latest.json`` in a public data repo, updated ~60s) and this
route serves it to the app — no backend of ours needs to touch the chain.

Point ``AGENTINDEX_FEED_URL`` at the raw URL of that snapshot to light
this up (e.g. https://raw.githubusercontent.com/<org>/<data-repo>/main/latest.json).

Honest by construction: until $CLST launches and the bot completes its
first cycle there IS no feed, so this returns ``live: false`` with the
reason — never fabricated rows. The Distribution view renders that state
verbatim.
"""
from __future__ import annotations

import os
import time

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter()

FEED_URL = os.environ.get("AGENTINDEX_FEED_URL", "").strip()
# Default when unset: the keeper bot on this same VPS writes bot/latest.json —
# read it directly from disk (zero network hop, realtime ~60s cadence).
LOCAL_FEED = "/root/cluster/bot/latest.json"
_CACHE: tuple[float, dict] | None = None
_CACHE_TTL = 45  # seconds — the feed itself updates ~60s when live

_EMPTY = {
    "live": False,
    "reason": "feed_not_configured",
    "detail": (
        "$CLST has not launched yet, so no fees have been collected and no "
        "distribution cycle has run. This page fills in automatically from "
        "the first cycle — the keeper bot publishes a public feed and "
        "AGENTINDEX_FEED_URL points this API at it."
    ),
    "updated_at": None,
    "mode": None,
    "totals": {"cycles": 0, "distributed_usd": 0.0, "recipients": 0},
    "treasury": {"address": None, "eth": None, "updated_at": None},
    "cycles": [],
    "payroll": [],
    "recent_buys": [],
}


def _normalize(snap: dict) -> dict:
    """Map the bot's snapshot schema onto the app's distribution shape."""
    history = snap.get("distributionHistory") or []
    recent = snap.get("recentDistributions") or []

    cycles = []
    for d in history[-60:]:
        cycles.append(
            {
                "at": d.get("at"),
                "cycle_index": d.get("cycleIndex"),
                "usd": d.get("usd"),
                "transfers": d.get("transfers"),
                "recipients": d.get("recipientsCount") or 0,
                "assets": d.get("assets") or [],  # [{symbol, amount}] when the bot includes legs
            }
        )
    cycles.sort(key=lambda c: c.get("at") or "", reverse=True)

    # unique recipients can't be derived exactly from compact history —
    # take the bot's payroll count when present, else sum of per-cycle counts
    totals_raw = snap.get("totals") or {}
    recipients = snap.get("payrollCount")
    if recipients is None:
        recipients = sum(c["recipients"] for c in cycles)

    treasury_raw = snap.get("treasury") or {}
    return {
        "live": True,
        "reason": None,
        "detail": None,
        "updated_at": snap.get("updatedAt"),
        "mode": snap.get("mode"),
        "totals": {
            "cycles": totals_raw.get("cycles") or len(cycles),
            "distributed_usd": totals_raw.get("distributedUsd") or 0.0,
            "recipients": recipients,
        },
        "treasury": {
            "address": treasury_raw.get("address"),
            "eth": treasury_raw.get("eth"),
            "updated_at": treasury_raw.get("updatedAt"),
        },
        "cycles": cycles,
        "recent": recent[-12:],
        "payroll": (snap.get("payroll") or [])[:10],
        "recent_buys": (snap.get("recentBuys") or [])[-8:],
    }


@router.get("")
def get_distributions():
    """The distribution record. `live: false` until the feed exists — never faked."""
    global _CACHE
    now = time.time()
    if _CACHE and now - _CACHE[0] < _CACHE_TTL:
        return _CACHE[1]

    try:
        if FEED_URL:
            with httpx.Client(
                timeout=15.0,
                headers={"User-Agent": "agentindex-api", "Accept": "application/json"},
            ) as c:
                r = c.get(FEED_URL)
                r.raise_for_status()
                snap = r.json()
        else:
            # No explicit feed URL — read the local keeper-bot snapshot
            # (same VPS). Honest failure when the bot hasn't written yet.
            import json
            with open(LOCAL_FEED) as f:
                snap = json.load(f)
    except FileNotFoundError:
        return _EMPTY
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail=f"Distribution feed unreachable: {exc}"
        ) from exc

    payload = _normalize(snap)
    _CACHE = (now, payload)
    return payload
