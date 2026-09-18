---
name: cluster
description: Cluster — self-hostable index of AI financial agents. Trade tokenized stocks and crypto on Robinhood Chain (4663) with real Uniswap v3 swaps, get live quotes for 193 tokenized instruments, read the payout basket, check distribution cycles, use persistent memory per wallet, and chat with 24 LLM models. Use when the user wants tokenized stock or crypto prices, swap execution on Robinhood Chain, portfolio and basket data, agent run logs, persistent memory storage, or an LLM gateway — including agents like Relay (trading), Scout (research), Argus (on-chain analysis), Vault (treasury), and Oracle (price feeds). Supports the full 192-instrument tokenized stock universe plus native crypto (PONS, WETH, USDG, CLIPPY, KARMA and more).
metadata:
  {
    "clawdbot":
      {
        "emoji": "🧩",
        "homepage": "https://github.com/clusteragent/cluster",
        "requires": { "bins": [], "env": [] },
      },
  }
---

# Cluster

The runtime layer for agentic finance on Robinhood Chain. Persistent memory, live
market data over a 193-instrument tokenized stock universe, real Uniswap v3 swaps,
and a 24-model LLM gateway — one skill, every MCP runtime.

Two ways to run it:

1. **Hosted API (default)** — no install beyond this skill; point tools at the public
   cluster endpoint and authenticate with a cluster API key
2. **Self-hosted** — run the cluster backend yourself (Docker or bare Node/Python);
   all tools work identically against your own deployment

## Getting an API Key

Every wallet gets **$5 of inference credit** on first connect. Two ways:

**Option A: In-app (recommended)**

1. Open the cluster app and connect your wallet
2. Sign once — a session starts; no more prompts for 60 minutes
3. Go to **API & Settings → Generate new key**
4. Copy the key (`clst_<prefix>_<secret>`) — it is shown **exactly once**

**Option B: Headless (agents)**

```bash
# 1. Get a signing challenge for your wallet
curl "https://YOUR-CLUSTER-HOST/api/auth/challenge?wallet=0xYOUR_ADDRESS"

# 2. Sign the message with personal_sign (any EVM signer), then exchange it
curl -X POST "https://YOUR-CLUSTER-HOST/api/auth/session" \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0xYOUR_ADDRESS","signature":"0xSIGNED_MESSAGE"}'
# → { "session_token": "...", "expires_in": 3600 }

# 3. Create a key with the session token
curl -X POST "https://YOUR-CLUSTER-HOST/api/keys" \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0xYOUR_ADDRESS","session_token":"...","name":"my-agent"}'
# → { "key": "clst_...", ... }  — store it, it cannot be recovered
```

## Option 1: MCP Server (Recommended)

### Install

```bash
bunx @clusteragent/cluster-mcp          # run directly
# or
npm install -g @clusteragent/cluster-mcp
cluster-mcp                             # starts the MCP server on stdio
```

### Wire it into your runtime

```json
{
  "mcpServers": {
    "cluster": {
      "command": "npx",
      "args": ["-y", "@clusteragent/cluster-mcp"],
      "env": {
        "CLUSTER_API_URL": "https://YOUR-CLUSTER-HOST",
        "CLUSTER_API_KEY": "clst_your_key_here"
      }
    }
  }
}
```

`CLUSTER_API_URL` defaults to the hosted endpoint; set it to your own deployment for
self-hosting. `CLUSTER_API_KEY` is required for wallet-scoped tools (chat, memory,
keys); market data tools work without one.

## Option 2: REST API (Direct)

No MCP needed — call the API with curl, fetch, or any HTTP client.

### Authentication

Wallet-scoped requests accept either:

- `session_token` — from the sign-once session flow above (60 minutes)
- `X-API-Key: clst_...` — for external callers; usage is metered per request

Market data needs no auth.

### Endpoints Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/market/quotes?symbols=NVDA,TSLA` | GET | none | Batch quotes + ~1 month of daily closes |
| `/api/market/movers` | GET | none | Gainers, losers, sector heat (192 covered) |
| `/api/market/news` | GET | none | Yahoo Finance headlines |
| `/api/market/chart/{symbol}` | GET | none | Candles + series per timeframe |
| `/api/index` | GET | none | Index composition, on-chain verified count |
| `/api/index/payout-basket` | GET | none | The 19-name payout basket with weights |
| `/api/distributions` | GET | none | Distribution cycles, payroll, treasury |
| `/api/trade/quote` | GET | none | Uniswap v3 quote (token, side, amount in wei, via) |
| `/api/trade/status` | GET | none | Router, quoter, gas, ETH price |
| `/api/trade/wallet/{address}` | GET | none | On-chain balances: native ETH + all holdings |
| `/api/chat` | POST | wallet/key | One completion — 24 models, `thinking` flag for extended reasoning |
| `/api/chat/models` | GET | none | Model list with context windows and pricing |
| `/api/chat/credits` | GET | none | Credit balance for a wallet |
| `/api/memory/retain` | POST | wallet/key | Store a durable memory note (deduped) |
| `/api/memory/recall` | POST | wallet/key | Semantic-ish recall of stored notes |
| `/api/keys` | GET/POST | wallet/key | List / create API keys |
| `/api/keys/usage` | GET | wallet/key | Metered usage: requests, tokens, USD |

### Quick Examples

```bash
# Live quotes
curl "https://YOUR-CLUSTER-HOST/api/market/quotes?symbols=NVDA,SPY,PONS"

# The payout basket — 19 instruments, weights sum to 100
curl "https://YOUR-CLUSTER-HOST/api/index/payout-basket"

# Quote a swap: 0.01 ETH → NVDA (amount in wei)
curl "https://YOUR-CLUSTER-HOST/api/trade/quote?token=0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC&side=buy&amount=10000000000000000"

# Chat with extended reasoning
curl -X POST "https://YOUR-CLUSTER-HOST/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0xYOUR_ADDRESS","model":"openai/gpt-6-astra","thinking":true,"messages":[{"role":"user","content":"Analyze NVDA momentum"}]}'
```

### Executing Swaps (client-side, non-custodial)

Cluster never touches a private key. The API quotes and builds calldata; **your
wallet signs and broadcasts**:

1. `GET /api/trade/quote` — get the best route + `amountOut`
2. Build the tx: buy = `multicall([exactInput, refundETH])` with `msg.value`;
   sell = approve the router, then `multicall([exactInput, unwrapWETH9])`
3. Sign with your own signer (wagmi, ethers, viem) and broadcast
4. Poll `eth_getTransactionReceipt` — parse Transfer logs to confirm what actually
   arrived (a quote is a prediction; a receipt is proof)

Key addresses on Robinhood Chain (4663):

| Contract | Address |
|----------|---------|
| SwapRouter02 | `0xcaf681a66d020601342297493863e78c959e5cb2` |
| QuoterV2 | `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |

## The Agents

Sixteen agent capabilities, each with its own skill pack. Running one logs the
interaction to your wallet's history; after the $CLST token launch, fees from agent
work stream to holders through the payout basket.

| Agent | Ticker | Category | Trigger |
|-------|--------|----------|---------|
| Relay | RLY | Trading | Per swap |
| Scout | SCT | Research | Per report |
| Ledger | FIN | Finance | Per task |
| Argus | ARG | Analysis | Per query |
| Pivot | PVT | Trading | Per swap |
| Prism | PRSM | Analysis | Per query |
| Memoria | MEM | Memory | Per task |
| Sifter | SFT | Research | Per report |
| Remit | RMT | Finance | Per task |
| Nexus | NXS | Crypto | Per task |
| Echo | ECH | Memory | Per query |
| Census | CNS | Analysis | Per query |
| Vault | VLT | Crypto | Per task |
| Quill | QLL | Research | Per report |
| Oracle | ORC | Crypto | Per query |
| Margin | MRG | Finance | Per task |

## The Payout Mechanism

Fees in → basket out. Every agent action accrues fees in the vault; the keeper bot
sweeps the **19-name payout basket** at live market prices; $CLST holders are paid
pro-rata every cycle. No staking, no claiming — holding is the position. All
distribution data is public: `GET /api/distributions` returns every cycle, per
address, from the first one onward.

## Rate Limits & Credits

- Chat: 30 requests/minute per wallet
- Every wallet starts with **$5 of inference credit** — metered per token, per model
- API key calls are metered the same way and visible in realtime under `/api/keys/usage`
- Top-ups are not open yet; credit is the only gate
