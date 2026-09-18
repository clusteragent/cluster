---
name: finance
description: Portfolio, ledger and payout finance operations for cluster. Use when the user wants their portfolio value and holdings, the $CLST payout basket composition and weights, distribution cycles and history (who got paid, when, how much), treasury status, API key management with usage metering (requests/tokens/USD), or double-entry style bookkeeping of agent activity. Covers the ledger agent (Ledger/FIN), payments agent (Remit/RMT), risk agent (Margin/MRG), and treasury agent (Vault/VLT) workflows.
allowed-tools: Read, Write, Edit, Bash(curl:*)
license: MIT
metadata:
  author: clusteragent
  version: "1.0.0"
---

# Cluster Finance

Portfolio truth, payout records, and metering. Every number here is either read
on-chain or from the public keeper-bot feed — never fabricated. Pre-launch payout
data returns honest zeros by design.

## Portfolio

```bash
# Portfolio + history (wallet-scoped, auth required)
curl "https://HOST/api/portfolio?wallet=0xUSER&session_token=…"
curl "https://HOST/api/portfolio/history?wallet=0xUSER&session_token=…"
```

- The real "position" is the wallet's **$CLST token balance**, read on-chain
  (`AGENTINDEX_CLST_TOKEN_ADDRESS` / `AGENTINDEX_CLST_TOKEN_ADDRESS` env on the server)
- Before $CLST deploys, portfolio is honest zeros with a note — no invented rows
- On-chain balances for any address, no auth needed:

```bash
curl "https://HOST/api/trade/wallet/0xADDRESS"
# → native ETH + every held token, raw values from Multicall3.aggregate
```

## The Payout Basket

19 curated instruments, weights sum to 100. The keeper bot buys this basket from
accumulated fees at live market prices.

```bash
curl "https://HOST/api/index/payout-basket"
```

```json
{ "count": 19, "weight_sum": 100.0, "universe_count": 193,
  "note": "Holders are paid from this curated basket. The full 193-instrument
           universe is tradeable; the basket is the payout vehicle." }
```

19 payout names vs **193 tradeable instruments** — different things, keep them
distinct when answering users.

## Distributions — the public record

```bash
curl "https://HOST/api/distributions"
```

```json
{ "live": true, "mode": "dry",
  "totals": { "cycles": 0, "distributed_usd": 0.0, "recipients": 0 },
  "treasury": { "address": "0xcdfc…8827", "eth": 0.004169 },
  "cycles": [], "payroll": [], "recent_buys": [] }
```

- `mode: "dry"` = keeper bot running without settling; `live` = real cycles
- `payroll` = holder leaderboard (ranked by payout, from cycle 1 onward)
- `recent_buys` = every keeper basket purchase with tx
- `treasury.eth` = live vault balance, refreshed ~60s

## API Keys & Metering

```bash
# create (raw key shown ONCE — SHA-256 stored)
curl -X POST "https://HOST/api/keys" -H "Content-Type: application/json" \
  -d '{"wallet":"0xUSER","session_token":"…","name":"prod"}'

# list
curl "https://HOST/api/keys?wallet=0xUSER&session_token=…"

# usage: requests, tokens, USD per key
curl "https://HOST/api/keys/usage?wallet=0xUSER&session_token=…"
```

Limits: 20 active keys per wallet. Keys are wallet-bound — a key can never touch
another wallet's data.

## Credit Accounting

Every wallet gets **$5 inference credit**. Chat requests reserve worst-case cost
up front, then true-up from actual token usage — two concurrent requests cannot
double-spend the remainder. Rate limit: 30 chat requests/minute.

```bash
curl "https://HOST/api/chat/credits?wallet=0xUSER"
# → { "granted_usd": 5.0, "used_usd": 0.0, "remaining_usd": 5.0 }
```

## The Finance Agents

| Agent | Role | Workflow |
|---|---|---|
| **Ledger** (FIN) | Bookkeeping & reconciliation | Log every agent interaction to the wallet history; settle in $CLST post-launch |
| **Remit** (RMT) | Payments & invoicing | Record tip intents between wallets (`POST /api/social/tip`, self-tip blocked, 0x-address validated) |
| **Margin** (MRG) | Risk & margin | Track exposure across holdings (`/api/trade/wallet`), flag concentration, keep books balanced |
| **Vault** (VLT) | Treasury | Monitor `distributions.treasury.eth`, report vault accumulation, compound idle balances post-launch |

## Maybe Finance (self-hosted personal finance UI)

For a full double-entry personal finance UI on top of cluster data, self-host
[Maybe](https://github.com/maybe-finance/maybe) (AGPLv3, unmaintained upstream —
fork under the license terms: keep the LICENSE, state the fork is not affiliated
with Maybe Finance Inc., do not use the "Maybe" trademark or logo):

```bash
git clone https://github.com/maybe-finance/maybe
cd maybe
# Docker self-host
docker compose up -d
```

Maybe's account/transaction model maps well: cluster wallet = Maybe "account",
keeper-bot distributions = "transactions", the payout basket = an investment
"portfolio". Pull cluster data into it via the REST API.

> Trademark note: rename the deployment (e.g. "Cluster Ledger") in any user-facing
> surface.
