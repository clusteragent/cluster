"""Independently verify stock tokens on Robinhood Chain via direct RPC.

Calls symbol()/name()/totalSupply() on each contract address in
rh_stocks_raw.json and checks the on-chain symbol matches what we have
on file. Updates stocks_catalogue.RPC_VERIFIED_SYMBOLS-equivalent by
writing a fresh verified-symbols list you can paste back in.

Usage:
  cd server && ./.venv/bin/python -m app.verify_stocks [--limit N] [--workers 8]

Rate-limited and resumable-in-spirit: prints progress as it goes so a
partial run still gives you real signal. No API key needed — Robinhood
Chain public RPC.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
from pathlib import Path

import httpx

RPC_URL = "https://rpc.mainnet.chain.robinhood.com"

# ERC-20 selectors: symbol(), name(), totalSupply()
SEL_SYMBOL = "0x95d89b41"
SEL_TOTAL_SUPPLY = "0x18160ddd"


def _eth_call(client: httpx.Client, to: str, data: str) -> str | None:
    try:
        r = client.post(
            RPC_URL,
            json={"jsonrpc": "2.0", "id": 1, "method": "eth_call", "params": [{"to": to, "data": data}, "latest"]},
            timeout=10,
        )
        result = r.json().get("result")
        if not result or result == "0x":
            return None
        return result
    except Exception:
        return None


def _decode_string(hex_result: str) -> str | None:
    try:
        raw = bytes.fromhex(hex_result[2:])
        # dynamic ABI string: offset(32) + length(32) + data
        length = int.from_bytes(raw[32:64], "big")
        return raw[64 : 64 + length].decode("utf-8", errors="ignore").strip("\x00")
    except Exception:
        return None


def verify_one(client: httpx.Client, entry: dict) -> dict:
    address = entry["address"]
    symbol_result = _eth_call(client, address, SEL_SYMBOL)
    total_supply_result = _eth_call(client, address, SEL_TOTAL_SUPPLY)

    on_chain_symbol = _decode_string(symbol_result) if symbol_result else None
    has_supply = total_supply_result is not None and int(total_supply_result, 16) > 0

    verified = bool(on_chain_symbol) and on_chain_symbol.upper() == entry["symbol"].upper() and has_supply
    return {**entry, "on_chain_symbol": on_chain_symbol, "has_supply": has_supply, "verified": verified}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()

    raw_path = Path(__file__).parent / "rh_stocks_raw.json"
    entries = json.load(open(raw_path))
    if args.limit:
        entries = entries[: args.limit]

    results = []
    with httpx.Client() as client:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(verify_one, client, e): e for e in entries}
            for i, fut in enumerate(concurrent.futures.as_completed(futures), 1):
                r = fut.result()
                results.append(r)
                status = "OK" if r["verified"] else "FAIL"
                print(f"[{i}/{len(entries)}] {status} {r['symbol']:8s} onchain={r['on_chain_symbol']}")

    verified_symbols = sorted(r["symbol"] for r in results if r["verified"])
    print(f"\n{len(verified_symbols)}/{len(entries)} verified on-chain")
    out_path = Path(__file__).parent / "rh_stocks_verify_result.json"
    json.dump(results, open(out_path, "w"), indent=1)
    print(f"Full results written to {out_path}")
    print("\nVerified symbols (paste into stocks_catalogue.RPC_VERIFIED_SYMBOLS if satisfied):")
    print(verified_symbols)


if __name__ == "__main__":
    main()
