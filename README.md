# cluster

<p align="center">
  <a href="https://github.com/clusteragent/cluster"><img src="https://img.shields.io/badge/chain-Robinhood%20%234663-7b5cff.svg?style=flat-square" alt="Chain"></a>
  <a href="https://www.npmjs.com/package/@clusteragent/cluster-mcp"><img src="https://img.shields.io/npm/v/@clusteragent/cluster-mcp.svg?style=flat-square" alt="npm"></a>
  <img src="https://img.shields.io/badge/license-MIT-yellow.svg?style=flat-square" alt="MIT">
</p>

**The runtime layer for agentic finance on Robinhood Chain.** Self-hostable index
of AI financial agents — 192 tokenized stocks + native crypto, real Uniswap v3
swaps (non-custodial), persistent memory, and a 24-model LLM gateway.

```
npx @clusteragent/cluster-mcp
```

```bash
npx skills add clusteragent/cluster        # any skills-CLI agent
pip install cluster-agent                  # Python SDK
```

## Repo Layout

```
├── SKILL.md                    main installer skill (any agent)
├── index.mjs                   MCP server — 17 tools (@clusteragent/cluster-mcp)
├── skills/
│   ├── trading/                quotes, swap lifecycle, receipt proof (4663)
│   ├── memory/                 built-in memory + Hindsight backend
│   ├── finance/                portfolio, payouts, keys & metering, Maybe fork
│   ├── crypto-intel/           wallet forensics, pool forensics, scout swarm
│   ├── research/               Scout/Sifter/Quill/Census + OpenBB integration
│   └── llm-gateway/            24 models, thinking mode, credit accounting
├── python/                     cluster-agent PyPI SDK
├── server/                     FastAPI backend (self-hostable, SQLite default)
├── app/                        React/Vite frontend (landing, dashboard, docs)
├── bot/                        keeper bot (DRY default; --confirm-real-money for live)
└── docs/self-hosting.md        full deployment guide
```

## Quick Start

**Agent users** — see [SKILL.md](./SKILL.md). MCP config:

```json
{ "mcpServers": { "cluster": {
    "command": "npx", "args": ["-y", "@clusteragent/cluster-mcp"],
    "env": { "CLUSTER_API_URL": "https://your-host", "CLUSTER_API_KEY": "clst_...", "CLUSTER_WALLET": "0x..." }
}}}
```

**Self-hosters** — see [docs/self-hosting.md](./docs/self-hosting.md). Backend +
frontend + keeper bot, all local, SQLite default, zero external services except
one LLM key for chat.

**Python** — see [python/](./python):

```python
from cluster import Cluster
c = Cluster(api_url="https://your-host", api_key="clst_...")
c.quotes(["NVDA", "PONS"]); c.payout_basket(); c.chat("hi", thinking=True)
```

## The Mechanism

```
fees in ──▶ vault ──▶ keeper bot buys the 19-name basket ──▶ $CLST holders paid pro-rata
```

Holding is the position. Every cycle is public: `GET /api/distributions`.

## Integrations

| Project | Role | Guide |
|---|---|---|
| [Hindsight](https://github.com/vectorize-io/hindsight) | learning memory backend (observations, mental models) | `skills/memory/` |
| [OpenBB](https://github.com/OpenBB-finance/OpenBB) | institutional market data (fundamentals, macro) via MCP/Python | `skills/research/` |
| [Maybe](https://github.com/maybe-finance/maybe) | self-hosted personal finance UI (AGPLv3 — rename your fork) | `skills/finance/` |
| [OpenCatz](https://github.com/dizcorvus/opencatz-ai-robinhood-chain) | multi-agent scout swarm pattern on 4663 | `skills/crypto-intel/` |
| [Uniswap AI](https://github.com/Uniswap/uniswap-ai) | skills architecture this repo follows | structure |

## The Agents

**Trading** Relay · Pivot — **Research** Scout · Sifter · Quill — **Analysis** Argus ·
Prism · Census — **Finance** Ledger · Remit · Margin — **Memory** Memoria · Echo —
**Crypto** Nexus · Vault · Oracle

## Honesty by Construction

- Pre-launch payout data = honest zeros, never fabricated
- Swaps: API quotes, your wallet signs — no private keys server-side
- Keys: SHA-256 at rest, shown once
- Quote = prediction; receipt = proof (parse the Transfer logs)

## License

MIT. Backend and skills are original work. The Maybe Finance fork note applies if
you self-host that integration (AGPLv3, trademark rules in `skills/finance/`).
