---
name: cluster
description: Cluster — the runtime layer for agentic finance on Robinhood Chain. Trade tokenized stocks and crypto on chain 4663 with real Uniswap v3 swaps (client-side signing, non-custodial), get live quotes for 192 tokenized instruments plus native crypto (PONS, WETH, USDG, CLIPPY, KARMA), read the $CLST payout basket and distribution cycles, use persistent per-wallet memory, and reach a 24-model LLM gateway ($5 free credit). Use when the user wants tokenized stock or crypto prices, swap execution, portfolio/basket data, agent runs (Relay, Scout, Argus, Vault, Oracle and 12 more), memory storage, or LLM access. Install sub-skills for swap, trading, portfolio, memory, finance, social, monitor, crypto-intel, research, and the LLM gateway.
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

**fees in → basket out.** The runtime layer for agentic finance on Robinhood Chain
(EVM L2, chain id 4663). One MCP server + nine sub-skills. Self-hostable. Non-custodial.

## Install

### Skills CLI (any agent)

```bash
npx skills add clusteragent/cluster
```

Or install individual sub-skills:

```bash
npx skills add clusteragent/cluster --skill swap          # dedicated swap execution
npx skills add clusteragent/cluster --skill trading       # market data + trading context
npx skills add clusteragent/cluster --skill portfolio     # wallet valuation, DCA/TP-SL previews
npx skills add clusteragent/cluster --skill memory        # persistent memory
npx skills add clusteragent/cluster --skill finance       # payouts, ledger, metering
npx skills add clusteragent/cluster --skill social        # X links + tips
npx skills add clusteragent/cluster --skill monitor       # price/wallet/cycle/gas watch loops
npx skills add clusteragent/cluster --skill crypto-intel  # on-chain intelligence
npx skills add clusteragent/cluster --skill research      # market research agents
npx skills add clusteragent/cluster --skill llm-gateway   # 24-model chat
```

### Claude Code / plugin marketplace

```bash
/plugin marketplace add clusteragent/cluster
/plugin install cluster-core
```

### MCP server (recommended runtime)

```json
{
  "mcpServers": {
    "cluster": {
      "command": "npx",
      "args": ["-y", "@clusteragent/cluster-mcp"],
      "env": {
        "CLUSTER_API_URL": "https://your-cluster-host",
        "CLUSTER_API_KEY": "clst_...",
        "CLUSTER_WALLET": "0x..."
      }
    }
  }
}
```

### Python SDK

```bash
pip install cluster-agent
```

```python
from cluster import Cluster
c = Cluster(api_url="https://your-cluster-host", api_key="clst_...")

c.quotes(["NVDA", "PONS"])           # live quotes + daily closes
c.payout_basket()                    # the 19-name basket, weights sum to 100
c.quote_swap(token="0x...", side="buy", amount_wei=10**16)
c.chat("Analyze NVDA momentum", model="openai/gpt-6-astra", thinking=True)
c.memory.retain("User watches semis; largest position NVDA")
c.memory.recall("NVDA position")
```

## Getting an API Key

Every wallet starts with **$5 of inference credit**. The wallet is the account.

**In-app:** connect wallet → sign once → **API & Settings → Generate new key** →
copy `clst_...` (shown exactly once, stored as SHA-256).

**Headless:**

```bash
# 1. challenge
curl "https://HOST/api/auth/challenge?wallet=0xYOUR_ADDRESS"
# 2. sign the message (personal_sign), exchange for a 60-minute session
curl -X POST "https://HOST/api/auth/session" \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0xYOUR_ADDRESS","signature":"0xSIGNED"}'
# 3. mint a key
curl -X POST "https://HOST/api/keys" \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0xYOUR_ADDRESS","session_token":"...","name":"my-agent"}'
```

## Tool Map

| Domain | MCP tools | Sub-skill |
|---|---|---|
| Market data (192 stocks + crypto) | `get_quotes` `get_movers` `get_news` `get_chart` `compare_tokens` `sector_heat` `agent_quotes` `news_for_symbol` | trading |
| Swaps on 4663 (non-custodial) | `quote_swap` `token_safety` `trade_status` `wallet_balances` `dca_preview` `tpsl_preview` `gas_now` | swap |
| $CLST payouts | `get_payout_basket` `get_distributions` | finance |
| Portfolio & positions | `wallet_value` `basket_vs_wallet` `get_position` `get_portfolio` | portfolio |
| Social (X links + tips) | `social_profile` | social |
| Memory (built-in + Hindsight backend) | `memory_retain` `memory_recall` `memory_consolidate` | memory |
| LLM gateway (24 models, thinking mode) | `chat` `get_models` `get_credits` | llm-gateway |
| API keys & metering | `create_key` `key_usage` | finance |
| Agents (16 capabilities) | REST `/api/agents`, `/api/runs` | research |

## The Agents

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

## The Mechanism

```
fees in ──▶ vault ──▶ keeper bot buys the 19-name basket ──▶ $CLST holders paid pro-rata
```

Holding is the position — no staking, no claiming. Every cycle is public:
`GET /api/distributions`.

## Honesty by Construction

- Pre-launch payout data returns honest zeros — never fabricated rows
- Swaps never touch a private key on our side; the API quotes, your wallet signs
- API keys stored as SHA-256, shown exactly once
- A quote is a prediction; the receipt is the proof — parse Transfer logs to confirm
  what actually arrived

## Chain Reference

Robinhood Chain · **4663** · Uniswap v3 ·
Router `0xcaf681a6…5cb2` · QuoterV2 `0x33e885ed…a9e7` ·
WETH `0x0Bd7…AD73` · USDG `0x5fc5…d168`

## Credits & Limits

- Chat: 30 req/min per wallet
- $5 inference credit per wallet, metered per token per model
- Top-ups not open yet
