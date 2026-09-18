---
name: memory
description: Persistent memory for cluster agents. Use when the user wants the agent to remember something across sessions (watchlists, positions, research findings, preferences), recall what was stored before, or set up a dedicated memory backend (Hindsight for learning-over-time memory with observations and mental models). Covers the built-in cluster memory API (retain/recall, deduped, recency-scored, per-wallet banks) and the Hindsight integration for production-grade memory.
allowed-tools: Read, Write, Edit, Bash(curl:*), Bash(docker:*), Bash(pip:*)
license: MIT
metadata:
  author: clusteragent
  version: "1.0.0"
---

# Cluster Memory

Two tiers:

1. **Built-in memory** — zero-setup, part of every cluster deployment. Notes are
   deduped (identical content skipped), scored by recency decay, and stored per
   wallet/bank. Backs the `memory_retain` / `memory_recall` MCP tools.
2. **Hindsight backend** — production memory that *learns*: observations, mental
   models, knowledge pages. Self-hosted via Docker, or Hindsight Cloud.

## Built-in Memory (default)

### Retain

```bash
curl -X POST "https://HOST/api/memory/retain" \
  -H "Content-Type: application/json" \
  -d '{
    "bank_id": "0xUSER_WALLET",
    "content": "User watches semiconductors; largest position NVDA, entry ~$210",
    "title": "Portfolio focus",
    "tags": ["portfolio", "semis"],
    "session_token": "…"
  }'
```

- `content` max **4000 chars** — a memory is a fact, not a document
- Duplicate content (normalized) is **skipped** unless `force: true`
- `bank_id` is the wallet address by default — memories are per-wallet private
  (wallet-scoped auth required)

### Recall

```bash
curl -X POST "https://HOST/api/memory/recall" \
  -H "Content-Type: application/json" \
  -d '{"bank_id":"0xUSER_WALLET","query":"what does the user hold?","limit":10}'
```

Results are scored by recency decay — newest relevant facts win. Use recall
**before** acting on portfolio or preference questions; never ask the user for
something they already told the agent.

### What to store (and what not)

Store: watchlists, position notes, risk preferences, research conclusions, key
decisions ("user prefers limit orders"), recurring instructions.

Do not store: raw market snapshots (re-fetch — they rot), secrets (keys never
belong in memory), anything the user asked to forget — delete the bank instead.

## Hindsight Backend (learning memory)

Cluster's memory layer is pluggable — set `MEMORY_BACKEND=hindsight` on the server
and point it at a Hindsight instance. Hindsight does not just recall conversation;
it extracts **observations** and compiles them into **mental models** so agents get
smarter over time. LongMemEval SOTA benchmark holder.

### Start a server

```bash
docker run -it --pull always --name hindsight --restart unless-stopped \
  -p 8888:8888 -p 9999:9999 \
  -e HINDSIGHT_API_LLM_PROVIDER=openai \
  -e HINDSIGHT_API_LLM_API_KEY=$OPENAI_API_KEY \
  -v hindsight-data:/home/hindsight/.pg0 \
  ghcr.io/vectorize-io/hindsight:latest
```

API on `:8888`, UI on `:9999`. Works with 25+ LLM providers (OpenAI, Anthropic,
Gemini, DeepSeek, Ollama/local, [OI]-compatible endpoints, and subscription-backed
providers like `openai-codex` / `claude-code` / `github-copilot` — no API key needed
for those).

Bare metal: `pip install hindsight-api`. Managed: Hindsight Cloud
(`https://api.hindsight.vectorize.io`).

### Wire cluster to it

```bash
# in the cluster backend .env
MEMORY_BACKEND=hindsight
HINDSIGHT_URL=http://localhost:8888
HINDSIGHT_TENANT=cluster
```

With this set, `/api/memory/retain` and `/api/memory/recall` transparently route
through Hindsight — same tools, smarter memory. Without it, the SQLite fallback
runs (zero external services, fine for a single-process self-host).

### Direct Hindsight usage (agents)

```bash
pip install hindsight-client
```

```python
from hindsight_client import Hindsight

memory = Hindsight(base_url="http://localhost:8888")

memory.retain(bank_id="0xUSER", items=[
    {"content": "User sold half the PONS position after the +20% run"},
])

results = memory.recall(bank_id="0xUSER", query="PONS position history")
```

### MCP

Hindsight ships its own MCP server — run it alongside cluster's for native memory
tools in any MCP runtime:

```json
{ "mcpServers": { "hindsight": {
    "command": "npx", "args": ["-y", "@vectorize-io/hindsight-mcp"],
    "env": { "HINDSIGHT_BASE_URL": "http://localhost:8888" }
}}}
```

## Choosing

| Need | Use |
|---|---|
| Quick facts, single-process self-host, zero deps | Built-in (SQLite) |
| Agent should *learn* (observations, mental models), production, multi-agent | Hindsight |
