# cluster

**The runtime layer for agentic finance on Robinhood Chain.** Self-hostable index of
AI financial agents — tokenized stocks + crypto, real Uniswap v3 swaps, persistent
memory, and a 24-model LLM gateway in one MCP server.

```bash
npx @clusteragent/cluster-mcp
```

## What it does

| Capability | Tools |
|---|---|
| Live market data — 192 tokenized stocks/ETFs + native crypto (PONS, WETH, USDG, CLIPPY, KARMA, …) | `get_quotes` `get_movers` `get_news` `get_chart` |
| Real swaps on Robinhood Chain (4663) — quoted here, **signed by your wallet** (non-custodial) | `quote_swap` `trade_status` `wallet_balances` |
| Payout basket & distributions — the public record of every $CLST cycle | `get_payout_basket` `get_distributions` |
| Persistent memory per wallet — deduped, recency-scored, survives sessions | `memory_retain` `memory_recall` |
| LLM gateway — 24 models incl. GPT-6 Astra, Claude, GLM; `thinking` mode for deep reasoning | `chat` `get_models` `get_credits` |
| API keys with per-request metering (requests / tokens / USD) | `create_key` `key_usage` |

## Install

### MCP (Claude, Codex, Hermes, OpenClaw, any MCP runtime)

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

### Skill

Copy [SKILL.md](./SKILL.md) into your agent's skills directory — it teaches the
agent the full flow: key creation, market data, swap building, receipt proof.

### Self-host the backend

```bash
git clone https://github.com/clusteragent/cluster
cd cluster/server
cp .env.example .env          # set LLM gateway key etc.
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

Then point `CLUSTER_API_URL` at it. Market data works out of the box; the LLM
gateway needs your own provider key.

## The mechanism

```
fees in ──▶ vault ──▶ keeper bot buys the 19-name basket ──▶ $CLST holders paid pro-rata
```

Every agent action accrues fees. The keeper bot sweeps the payout basket at live
market prices. Holding is the position — no staking, no claiming. Every cycle is
public: `GET /api/distributions`.

## The agents

Sixteen capabilities, each with its own skill pack:

**Trading** Relay · Pivot — **Research** Scout · Sifter · Quill — **Analysis** Argus · Prism · Census — **Finance** Ledger · Remit · Margin — **Memory** Memoria · Echo — **Crypto** Nexus · Vault · Oracle

## Honesty by construction

- No fabricated numbers: pre-launch payout data returns honest zeros, never invented rows
- Swaps never touch a private key on our side — the API quotes, your wallet signs
- API keys are stored as SHA-256 hashes and shown exactly once
- A quote is a prediction; the receipt is the proof — parse Transfer logs to see what actually arrived

## Chain info

Robinhood Chain · chain id **4663** · Uniswap v3 ·
Router `0xcaf681a6…5cb2` · QuoterV2 `0x33e885ed…a9e7`

## License

MIT
