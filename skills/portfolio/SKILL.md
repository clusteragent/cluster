---
name: portfolio
description: Wallet portfolio and position tracking on Robinhood Chain (4663). Use when the user wants their wallet's USD valuation, holdings breakdown with concentration analysis, $CLST index position and implied basket exposure, DCA plan previews, take-profit/stop-loss bracket previews, or a comparison of their holdings against the 19-name payout basket. All values are computed from live on-chain balances × live quotes — never fabricated; pre-launch positions return honest nulls.
allowed-tools: Read, Bash(curl:*)
license: MIT
metadata:
  author: clusteragent
  version: "1.0.0"
---

# Cluster Portfolio

Wallet truth: on-chain balances × live quotes. The wallet's real $CLST position
is its **token balance read on-chain** — until $CLST deploys, position fields
return honest nulls, never invented rows.

## Wallet Valuation

```bash
curl "https://clusteragent.dev/api/trade/wallet/0xADDRESS"
# → native ETH + every held token (Multicall3.aggregate, raw values)
```

MCP shortcut: `wallet_value` (balances + ETH/USD in one call), `wallet_balances`
(raw balances).

## Index Position

```bash
curl "https://clusteragent.dev/api/index/position?clst_balance=100&clst_total_supply=1000000000"
# → per-instrument implied qty + USD from REAL inputs you supply;
# omit the params (or pre-launch) → implied_* = null, only weights populated
```

Holding $CLST is the position — no staking, no claiming. MCP: `get_position`.

## Basket vs Wallet

Which of the 19 payout-basket names a wallet already holds vs is missing:

```bash
# MCP: basket_vs_wallet { address }
```

Answers "how index-aligned is this wallet" without touching keys.

## DCA Preview (dry-run)

Quote N equal buys of X ETH into a token at current prices — no txs, no orders
stored. Real execution = sign each buy with your wallet (see the `swap` skill).

```bash
# MCP: dca_preview { token, eth_per_buy: "0.01", buys: 4 }
```

Rules when automating DCA from this preview:

- Quote fresh at execution time — never reuse a stored quote
- Hard cap on total ETH spent; stop when reached
- `eth_getTransactionCount(addr, "pending")` for nonces so sequential swaps
  don't collide

## TP/SL Bracket Preview (dry-run)

Current DexScreener price for a held token, TP/SL target prices and position
values at those levels. No orders stored.

```bash
# MCP: tpsl_preview { token, amount_tokens (wei), tp_pct: 20, sl_pct: 10 }
```

## Concentration

Flag when one holding dominates: value share > 50% of wallet USD = concentrated;
> 80% = extreme. Report per-holding USD share alongside the raw balances so the
user sees it, not just a label.
