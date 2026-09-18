---
name: research
description: Market research and analysis workflows for cluster agents. Use when the user wants a commissioned research report (Scout), literature/source sifting (Sifter), writing and synthesis (Quill), dataset-to-signal analysis (Prism), market census and ranking (Census), or financial data integration via OpenBB (equities fundamentals, historical prices, econ data). Covers the research agent roster, report structure, the OpenBB Python integration for institutional-grade data, and how research findings persist to cluster memory.
allowed-tools: Read, Write, Edit, Bash(curl:*), Bash(pip:*), Bash(python:*)
license: MIT
metadata:
  author: clusteragent
  version: "1.0.0"
---

# Cluster Research

Four research agents, one data platform. Research findings persist to cluster
memory so reports compound — session N cites session N−1.

## The Research Roster

| Agent | Ticker | Craft |
|---|---|---|
| **Scout** (SCT) | Deep research | Commissioned reports: thesis, evidence, risk, verdict |
| **Sifter** (SFT) | Source sifting | Evidence-grade filtering: primary sources, cross-checking, bias flags |
| **Quill** (QLL) | Writing | Briefs, memos, summaries — synthesis of stored findings |
| **Census** (CNS) | Market census | Count, segment, rank any market (e.g. "all RWA chains by TVL") |

**Prism** (PRSM, Analysis) breaks any dataset into signals — pairs with Census for
market structure work.

## The Report Format (Scout)

```
# <Question as title>
**Verdict:** <one sentence, up front>
**Confidence:** high | medium | low — and WHY

## Findings
- fact 1 (source, date)
- fact 2 (source, date)
…

## Counter-evidence
- what would falsify this thesis

## Sources
- [1] …
```

Rules: verdict first, every fact carries a source and date, counter-evidence is
mandatory, no unsourced claims. After delivery, persist the conclusion:

```bash
curl -X POST "https://clusteragent.dev/api/memory/retain" \
  -H "Content-Type: application/json" \
  -d '{"bank_id":"0xUSER","content":"Scout 2026-09: NVDA momentum positive — supply constraints ease Q4, consensus at $240. Confidence: medium.","tags":["research","NVDA"],"session_token":"…"}'
```

## Market Data Workflows (cluster API)

```bash
curl "https://clusteragent.dev/api/market/quotes?symbols=NVDA,AMD,MU"   # price + 1mo closes
curl "https://clusteragent.dev/api/market/news?limit=12"                 # headlines
curl "https://clusteragent.dev/api/market/sectors"                       # sector heat
curl "https://clusteragent.dev/api/market/movers?limit=10"               # flow of the day
```

Use these for market *state*; use OpenBB below for fundamentals, options and
macro. Cite which system each number came from.

## OpenBB — institutional data platform

[OpenBB](https://github.com/OpenBB-finance/OpenBB) is the open-source "connect
once, consume everywhere" data platform: 100s of providers, one Python interface,
plus an MCP server for AI agents.

```bash
pip install openbb
```

```python
from openbb import obb

# fundamentals & history (the research layer cluster doesn't ship)
df = obb.equity.price.historical("NVDA").to_dataframe()
fund = obb.equity.fundamental.income("NVDA").to_dataframe()
est = obb.equity.estimate.consensus("NVDA").to_dataframe()
```

### OpenBB MCP (agents)

OpenBB exposes an MCP server — combine with cluster's for fundamentals + execution
in one agent:

```json
{ "mcpServers": { "openbb": {
    "command": "python", "args": ["-m", "openbb_mcp"],
    "env": { "OPENBB_PAT": "…" }
}}}
```

### Division of labor

| Question type | Source |
|---|---|
| "What's NVDA doing right now?" | cluster `/api/market/quotes` |
| "Is NVDA overvalued?" | OpenBB fundamentals + your analysis |
| "What happened at the last NVDA earnings?" | OpenBB + web research (Sifter verifies) |
| "What's in the payout basket?" | cluster `/api/index/payout-basket` |

## Persistence Loop

1. Recall before researching: `memory_recall(bank_id, "NVDA prior findings")`
2. Research (Scout/Sifter) — cite sources
3. Deliver (Quill formats)
4. Retain the conclusion + confidence + date — the next session starts smarter

That loop is the whole point: an agent that re-researches from scratch every time
is a search engine, not an analyst.
