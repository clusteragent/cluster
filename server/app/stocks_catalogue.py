"""Tokenized-stock catalogue on Robinhood Chain (chainId 4663).

Source & honesty note (important — read before trusting this data):
  - The (address, symbol, name) list originates from finchagentic's
    ROBINHOOD_STOCKS catalogue (third-party sourced from "ClawHood
    server.py").
  - Every one of the 193 entries has since been INDEPENDENTLY
    RE-VERIFIED by this project directly against Robinhood Chain RPC
    (symbol()/totalSupply() eth_call, see verify_stocks.py) — 192/193
    confirmed live on-chain with matching symbol and non-zero supply.
    Only BND (Vanguard Total Bond Market ETF) failed: its symbol()
    matches but totalSupply() returns 0, so it is marked unverified.
  - These are "Robinhood Token" tokenized instruments, NOT direct
    equity shares — keep that qualifier in any user-facing copy.

Re-run `./.venv/bin/python -m app.verify_stocks` any time to refresh
the on-chain check (writes rh_stocks_verify_result.json).
"""
from __future__ import annotations

import json
from pathlib import Path

_RAW_PATH = Path(__file__).parent / "rh_stocks_raw.json"
_VERIFY_RESULT_PATH = Path(__file__).parent / "rh_stocks_verify_result.json"


def _load_stocks() -> list[dict]:
    with open(_RAW_PATH) as f:
        raw = json.load(f)

    verified_symbols: set[str] = set()
    if _VERIFY_RESULT_PATH.exists():
        with open(_VERIFY_RESULT_PATH) as f:
            for entry in json.load(f):
                if entry.get("verified"):
                    verified_symbols.add(entry["symbol"])
    else:
        # Fallback if verify_stocks.py hasn't been run yet in this
        # deployment: the 19 symbols independently RPC-checked on
        # 2026-09-08 (see /root/robinhood_stock_tokens.json).
        verified_symbols = {
            "AAPL", "AMD", "AMZN", "BE", "COIN", "CRWV", "GOOGL", "INTC",
            "META", "MSFT", "MU", "NFLX", "NVDA", "ORCL", "PLTR", "SNDK",
            "SPCX", "TSLA", "USAR",
        }

    out = []
    for entry in raw:
        symbol = entry["symbol"]
        out.append(
            {
                "address": entry["address"],
                "symbol": symbol,
                "name": entry["name"],
                "verified": symbol in verified_symbols,
            }
        )
    return out


STOCKS: list[dict] = _load_stocks()
STOCKS_BY_SYMBOL: dict[str, dict] = {s["symbol"]: s for s in STOCKS}
VERIFIED_COUNT = sum(1 for s in STOCKS if s["verified"])

