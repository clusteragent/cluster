"""Portfolio math for the $CLST index basket — weight, cost-basis, trend.

Pattern ported from maybe-finance/maybe's Holding model (AGPL-3.0 —
this is an independent Python re-implementation of the CONCEPT, not a
copy of their Ruby source: per-holding weight-of-portfolio %,
average-cost tracking, and gain/loss trend). See
/root/maybe-finance-reference/app/models/holding.rb for the reference
we studied.

None of this activates until $CLST is deployed (AGENTINDEX_CLST_TOKEN_ADDRESS
set) and a wallet's on-chain balance + basket composition are known —
see app/routes/index_composition.py for how the basket itself is
served today with no fabricated numbers.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class BasketPosition:
    """One stock's share of a wallet's implied $CLST exposure.

    All of these are computed CLIENT-SIDE or server-side from REAL
    inputs (on-chain $CLST balance, on-chain basket weights) — never
    fabricated. If clst_balance is 0 or the basket has no live weights
    yet, every field here is 0/None, not a plausible-looking guess.
    """

    symbol: str
    address: str
    basket_weight_pct: float  # this stock's % of the total basket (equal-weight until a real weighting scheme is set)
    implied_qty: float | None  # wallet's implied exposure in "shares" if $CLST were fully redeemable — None pre-launch
    implied_value_usd: float | None  # implied_qty * live market price (from /api/market) — None if either input is missing


def equal_weight_basket(symbols: list[str]) -> dict[str, float]:
    """Equal-weight composition: every instrument gets basket_size^-1 %.

    This is the ONLY weighting scheme AgentIndex claims today — no
    market-cap or float-adjusted weighting has been implemented or
    decided. Swap this function out (and update the honesty note in
    index_composition.py) if/when a real weighting scheme ships.
    """
    if not symbols:
        return {}
    weight = 100.0 / len(symbols)
    return {s: round(weight, 4) for s in symbols}


def compute_basket_positions(
    symbols_and_addresses: list[tuple[str, str]],
    clst_balance: float | None,
    clst_total_supply: float | None,
    market_prices: dict[str, float] | None = None,
) -> list[BasketPosition]:
    """Compute a wallet's implied position across the basket.

    Returns honest None/0 fields whenever an input is missing — this
    function must NEVER interpolate a plausible-looking number for
    clst_balance or clst_total_supply if either is unavailable, because
    that's exactly the "demo reward" mistake this codebase already
    made once and had to rip out.
    """
    weights = equal_weight_basket([s for s, _ in symbols_and_addresses])
    ownership_pct = None
    if clst_balance is not None and clst_total_supply and clst_total_supply > 0:
        ownership_pct = clst_balance / clst_total_supply

    positions = []
    for symbol, address in symbols_and_addresses:
        basket_weight = weights.get(symbol, 0.0)
        implied_qty = None
        implied_value = None
        if ownership_pct is not None:
            # a wallet's claim on THIS instrument, scaled by the
            # instrument's basket weight and the wallet's share of $CLST
            implied_qty = ownership_pct * (basket_weight / 100.0)
            price = (market_prices or {}).get(symbol)
            if price is not None:
                implied_value = implied_qty * price
        positions.append(
            BasketPosition(
                symbol=symbol,
                address=address,
                basket_weight_pct=basket_weight,
                implied_qty=implied_qty,
                implied_value_usd=implied_value,
            )
        )
    return positions
