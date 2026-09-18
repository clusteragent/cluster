---
name: crypto-intel
description: On-chain crypto intelligence on Robinhood Chain (4663). Use when the user wants wallet analysis (balances, positions, concentration), whale watching and flow analysis (Argus), live DEX token data for native tokens (PONS, SWOGE, RHAGENT, NOXA, CLIPPY, KARMA and the pons-ecosystem), liquidity and pool discovery via DexScreener, token verification against the canonical factory, or autonomous multi-agent scouting coordination. Covers the Argus (analysis), Nexus (portfolio), Oracle (price feeds), and Vault (treasury) agent workflows.
allowed-tools: Read, Write, Edit, Bash(curl:*), Bash(python:*)
license: MIT
metadata:
  author: clusteragent
  version: "1.0.0"
---

# Crypto Intelligence — Robinhood Chain

On-chain truth for chain 4663. Every claim below is verifiable against the
explorer: https://robinhoodchain.blockscout.com

## Wallet Analysis

```bash
# Full balance sheet — native ETH + every held token, one call
curl "https://HOST/api/trade/wallet/0xADDRESS"
```

- Values are raw on-chain reads via **Multicall3** (`0xcA11…CA11`, live on 4663) —
  one round-trip reads ETH + all token balances
- Report: total USD (× ETH price from `/api/trade/status`), per-token breakdown,
  concentration warnings (any single token > 40% = flag it)

## Token Universe

**Canonical V3 factory** (swap-able via SwapRouter02):

```
PONS    0x39dBED3a2bd333467115dE45665cC57F813C4571   liq ~$6.6M, pool 0x10cc…26ba
CLIPPY  0x85856f025bf13b8fd2aae2f6da458318744f1e18
KARMA   0xb47f4702deb124cb4eb6286be83c9d84277c6239
WETH    0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
USDG    0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
```

**Pons launchpad factory** (`0x1f7d7550…` — separate Uniswap V3 factory; not
routable by SwapRouter02, QuoterV2 reverts):

```
FINCH   0x879f29204a5ff842c66f0f65e0f2e422073acce7
SWOGE   0xdb87393727b666c43f5aecb03d8b419ba54d9b03
RHAGENT 0x894fac757250f8e02180e1856957274d84ac4ba3
NOXA    0x39e0d9057bd9039cd14590f54de20b9d3457c56e
PONSTR  0x4a76d884bb9cbbf2138fbe47e99584eb5168dde2
ARENA   0x14dad3f05f7e25ee79b780119db96baa6b30e7c0
IF      0x232cdfc415d10b673845d83dc02ba2eabe7e30d1
BUTTER  0xcdd50d73b45085d71cb05e2ca238d12c3bd7bebd
WALLET  0x0339f5459fc690ac85f1782e15782a151b4a9e1b
SQUEEZE 0xf444f3c77c77a33f7c8d8fcab8a1e88afb843da5
```

Verify a pool's factory yourself:

```bash
# factory() on the pool address — compare against the canonical factory
cast call 0xPOOL_ADDRESS "factory()(address)" --rpc-url https://rpc.mainnet.chain.robinhood.com
```

## Live DEX Data (DexScreener)

```bash
# One call, up to 30 token addresses — returns every robinhood-chain pair
curl "https://api.dexscreener.com/latest/dex/tokens/0x39dBED…4571,0x8585…1e18"
```

- Filter `chainId == "robinhood"`, sort by `liquidity.usd` for the deepest pool
- `priceUsd` is valid **when your token is the base side**; when it's the quote
  side the price refers to the other token
- `volume.h24`, `txns` (buys/sells) and `priceChange.h24` give momentum context

## Pool Forensics

For any V3 pool, read on-chain (no indexer needed):

```bash
# slot0 → sqrtPriceX96 (spot), tick
cast call 0xPOOL "slot0()(uint160,int24,uint16,uint16,uint16,uint8,bool)" \
  --rpc-url https://rpc.mainnet.chain.robinhood.com
# fee tier + liquidity
cast call 0xPOOL "fee()(uint24)" --rpc-url https://rpc.mainnet.chain.robinhood.com
cast call 0xPOOL "liquidity()(uint128)" --rpc-url https://rpc.mainnet.chain.robinhood.com
cast call 0xPOOL "factory()(address)" --rpc-url https://rpc.mainnet.chain.robinhood.com
```

Spot price from `sqrtPriceX96`: `price = (sqrtPriceX96 / 2^96)^2` (token1 per
token0, raw decimals — adjust). If `price` is implausible vs DexScreener, the pool
is likely a launchpad-factory pool with non-standard math — flag it.

## The Intelligence Agents

| Agent | Role | Workflow |
|---|---|---|
| **Argus** (ARG) | On-chain flows | Wallet forensics, whale movement, transfer watching via `/api/trade/wallet` + Blockscout |
| **Nexus** (NXS) | Portfolio | Cross-token positions + yield view from the wallet balance sheet |
| **Oracle** (ORC) | Price feeds | Quote-cache from `/api/market/quotes` + DexScreener; every feed call is metered |
| **Vault** (VLT) | Treasury | `distributions.treasury.eth` monitoring, accumulation reporting |

## Scout Swarm Pattern (OpenCatz-style)

Multi-agent monitoring with a consensus gate — N scouts each watch one domain and
report, an 80%-confidence gate blocks low-conviction calls:

1. **DEX scout** — new pools / liq changes via DexScreener polling (30s)
2. **Whale scout** — large transfers via Blockscout address tx feeds
3. **Price scout** — deviation alerts: |quote − spot| > threshold
4. **Risk scout** — concentration + drawdown checks per wallet
5. **Feed scout** — Yahoo news crosses (`/api/market/news`)

Each scout writes findings to `memory_retain` tagged `scout:<domain>`. A
coordinator agent recalls them (`memory_recall`) and only acts when ≥80% of
relevant scouts agree. This is the same shape as OpenCatz's swarm protocol,
implemented entirely with cluster primitives.

## Blockscout Notes

The Blockscout UI sits behind Cloudflare bot protection — API scraping with plain
curl gets 403. Prefer: raw RPC (`eth_call`) for everything state-based, DexScreener
for pricing, and the cluster API (which caches) for aggregates.
