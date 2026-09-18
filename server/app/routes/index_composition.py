"""Index composition routes — what $CLST represents.

AgentIndex's model: hold $CLST, and (once the token is live) you hold a
proportional claim on the underlying basket of tokenized-stock
instruments below. This endpoint serves that basket — it is real data
(on-chain addresses, RPC-verified) independent of whether $CLST itself
has been deployed yet.

$CLST is NOT deployed on any chain as of this codebase — there is no
contract address. Every response here is explicit about that; nothing
in this module fabricates a token balance, a price, or a "your share"
number. The frontend must render an honest pre-launch state (see
app/src/lib/aix.ts) until AGENTINDEX_CLST_TOKEN_ADDRESS is set.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Query

from app.stocks_catalogue import STOCKS, VERIFIED_COUNT
from app.basket_math import compute_basket_positions
from app.payout_basket import PAYOUT_BASKET, PAYOUT_BASKET_COUNT

router = APIRouter()

# Unset until $CLST is actually deployed. Deliberately NOT hardcoded to
# any address — see skill:web3/evm-wallet-auth pre-launch pattern: the
# frontend reads this same "unset" state and renders "Pre-launch"
# badges instead of fabricated numbers, then activates automatically
# once this env var (and its frontend equivalent) is filled in.
CLST_TOKEN_ADDRESS = os.environ.get("AGENTINDEX_CLST_TOKEN_ADDRESS", "")


@router.get("")
def get_index():
    return {
        "clst_token_address": CLST_TOKEN_ADDRESS or None,
        "clst_deployed": bool(CLST_TOKEN_ADDRESS),
        "stock_count": len(STOCKS),
        "verified_on_chain_count": VERIFIED_COUNT,
        "chain": "Robinhood Chain",
        "chain_id": 4663,
        "note": (
            "$CLST has not been deployed yet. This basket shows what the "
            "index will represent once it is live — holding $CLST will "
            "give a proportional claim on these tokenized-stock "
            "instruments, not a reward for running an agent."
        ),
        "stocks": STOCKS,
    }


@router.get("/payout-basket")
def get_payout_basket():
    """The curated basket holders are actually paid in (19 weighted
    instruments), as opposed to the full tradeable universe. Weights
    mirror the keeper bot's config; every address is RPC-verified."""
    return {
        "count": PAYOUT_BASKET_COUNT,
        "weight_sum": round(sum(b["weight"] for b in PAYOUT_BASKET), 1),
        "universe_count": len(STOCKS),
        "note": (
            "Holders are paid from this curated basket. The full "
            f"{len(STOCKS)}-instrument universe exists for trading and "
            "market analysis."
        ),
        "basket": PAYOUT_BASKET,
    }


@router.get("/position")
def get_position(clst_balance: float | None = Query(None), clst_total_supply: float | None = Query(None)):
    """Compute a wallet's implied basket exposure from REAL on-chain
    inputs (never fabricated). Pattern ported from maybe-finance/maybe's
    Holding model — see app/basket_math.py docstring.

    Until $CLST is deployed, or if the caller doesn't supply a real
    clst_balance/clst_total_supply pair, every position comes back with
    implied_qty=None / implied_value_usd=None — only basket_weight_pct
    (equal-weight composition) is ever populated unconditionally.
    """
    pairs = [(s["symbol"], s["address"]) for s in STOCKS]
    positions = compute_basket_positions(pairs, clst_balance, clst_total_supply)
    return {
        "clst_deployed": bool(CLST_TOKEN_ADDRESS),
        "weighting_scheme": "equal_weight",
        "positions": [p.__dict__ for p in positions],
    }
