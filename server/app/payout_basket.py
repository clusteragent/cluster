"""The payout basket — the 19 instruments $CLST holders are paid in.

Modeled on Kumo's governance basket (same 19 symbols, same weights,
summing to 100). This is deliberately NOT the full 193-instrument
universe: the full universe exists for TRADING and MARKET ANALYSIS only.
Holders are paid from this curated, weighted basket.

Every address here is the same tokenized-stock contract used across the
app (Robinhood Chain, chainId 4663) and is RPC-verified in
stocks_catalogue.py.

Keep weights in sync with the keeper bot's config when $CLST ships.
"""
from __future__ import annotations

from app.stocks_catalogue import STOCKS_BY_SYMBOL

# symbol -> governance weight (percent, sums to 100)
WEIGHTS: dict[str, float] = {
    "NVDA": 14.2, "AAPL": 11.6, "MSFT": 10.3, "AMZN": 8.4, "GOOGL": 7.1,
    "META": 6.8, "TSLA": 6.2, "AMD": 5.4, "NFLX": 4.7, "ORCL": 4.1,
    "COIN": 3.6, "PLTR": 3.2, "CRWV": 2.8, "INTC": 2.6, "MU": 2.3,
    "BE": 2.1, "SPCX": 1.9, "SNDK": 1.4, "USAR": 1.3,
}


def _build() -> list[dict]:
    out = []
    for symbol, weight in WEIGHTS.items():
        stock = STOCKS_BY_SYMBOL.get(symbol)
        if not stock:
            continue
        out.append(
            {
                "symbol": symbol,
                "name": stock["name"],
                "address": stock["address"],
                "weight": weight,
                "verified": stock["verified"],
            }
        )
    return out


PAYOUT_BASKET: list[dict] = _build()
PAYOUT_BASKET_COUNT = len(PAYOUT_BASKET)
