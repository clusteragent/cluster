---
name: monitor
description: Watch-and-react monitoring on Robinhood Chain (4663): price alerts, wallet movement watch, keeper-bot feed watch, and gas tracking. Use when the user wants to be notified when a token crosses a price, when a wallet moves funds, when the keeper bot completes a cycle, or when gas is cheap/expensive. Cluster has no push engine — this skill defines the poll loop (cron or scheduler calling MCP tools) with state-file patterns so monitors survive restarts.
allowed-tools: Read, Write, Bash(curl:*), Bash(python:*)
license: MIT
metadata:
  author: clusteragent
  version: "1.0.0"
---

# Cluster Monitor

No push engine exists — monitoring = a poll loop over MCP/REST tools, usually
from cron. State lives in a JSON file so monitors survive restarts.

## Price Watch

Poll `get_quotes` (stocks) or DexScreener (crypto), compare against thresholds.

```bash
# stocks: batch quotes, check each symbol server-side fresh
curl "https://HOST/api/market/quotes?symbols=NVDA,PONS"
# crypto single token:
curl "https://api.dexscreener.com/latest/dex/tokens/0xTOKEN"
```

Alert rule: `price >= above` OR `price <= below` → notify once, then set
`triggered: true` in state (no repeat spam). Optional re-arm below the band.

## Wallet Watch

```bash
curl "https://HOST/api/trade/wallet/0xADDRESS"
```

Store last-seen balances per token; on change beyond a dust threshold, report
deltas (in/out per token + ETH). Native ETH moves include gas — mention that so
small ETH-only drifts aren't misread as transfers.

## Cycle Watch (keeper bot feed)

```bash
curl "https://HOST/api/distributions"
```

Track `totals.cycles` + `updated_at`; a new cycle = report distributed USD,
recipients, and per-cycle assets. Pre-launch the feed returns `live: false` —
watch for the flip, then announce the first cycle.

## Gas Watch

```bash
# MCP: gas_now  → { gas_gwei, eth_usd, chain_id }
```

Cheap/expensive bands are user-defined (e.g. alert when gas < 0.05 gwei for
batching swaps). Gas on 4663 is normally near-zero — a spike is itself news.

## Poll Loop Pattern

```python
# every N minutes (cron):
# 1. load state.json { watches: [...] }
# 2. for each watch: fetch fresh value via MCP/REST
# 3. evaluate rule → notify (stdout / webhook) on transition only
# 4. save state.json
```

- Evaluate on **transitions**, not levels (no repeat alerts)
- Persist `last_value` + `triggered` per watch; survive restarts
- Keep intervals ≥ 60s for market data (server caches: quotes 60s, movers 2min,
  distributions 45s)
- Never store private keys or session tokens in state files — monitors are
  read-only by design
