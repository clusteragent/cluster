---
name: llm-gateway
description: The cluster LLM gateway — 24 models with per-token metering against a $5 free credit. Use when the user wants to chat with or route work to specific models (GPT-6 Astra, the model 4, GPT-5.6 Terra, Kimi K3, DeepSeek V4 Pro, Qwen, GLM, MiniMax, Gemini), enable extended thinking/reasoning for hard problems, pick the cheapest model for a task, check remaining credit, or integrate completions programmatically via REST or the Python SDK.
allowed-tools: Read, Bash(curl:*), Bash(pip:*)
license: MIT
metadata:
  author: clusteragent
  version: "1.0.0"
---

# Cluster LLM Gateway

24 models, one endpoint, metered per token against the wallet's credit ($5 free).
Same shape as [OI] — swap the base URL and key.

## Models

```bash
curl "https://HOST/api/chat/models"
```

```
→ { "models": [
    { "id": "openai/gpt-6-astra",     "label": "GPT-6 Astra",       "group": "Frontier",  "context": 400000 },
    { "id": "anthropic/…",            "label": "the model 4",       "group": "Reasoning", … },
    { "id": "openai/gpt-5.6-terra",   "label": "GPT-5.6 Terra",     "group": "Frontier",  … },
    { "id": "google/gemini-3.8-flash","label": "Gemini 3.8 Flash",  "group": "Fast",      … },
    { "id": "deepseek/deepseek-v4-pro","label": "DeepSeek V4 Pro",  "group": "Reasoning", … },
    { "id": "moonshot/kimi-k3",       "label": "Kimi K3",           … },
    { "id": "glm/glm-5.3-flash",      "label": "GLM 5.3 Flash",     … },  # cheapest
    … 24 total
]}
```

Pricing is USD per 1M tokens (in / out) — included in the models response. Pick
the cheapest model that handles the task; reserve Frontier models + `thinking`
for genuinely hard problems.

## Chat

```bash
curl -X POST "https://HOST/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "0xUSER",
    "model": "openai/gpt-6-astra",
    "thinking": true,
    "messages": [{"role":"user","content":"Analyze NVDA momentum for a swing entry"}]
  }'
```

Response:

```json
{ "reply": "…",
  "model": "openai/gpt-6-astra",
  "usage": { "prompt_tokens": 812, "completion_tokens": 640, "cost_usd": 0.0041 },
  "credit": { "remaining_usd": 4.9959 } }
```

## Thinking Mode

`"thinking": true` inserts a rigor directive and doubles the token budget — the
model works step-by-step, considers multiple approaches, self-checks before
answering. Use for: valuation, route analysis, multi-constraint decisions, code
that touches money. Skip for lookups and rewrites (2× cost, no benefit).

Auth: either a fresh wallet signature / 60-minute session token, or an API key
(`clst_...`) via the `api_key` field for external callers. Rate limit 30/min.

## Credits

```bash
curl "https://HOST/api/chat/credits?wallet=0xUSER"
```

Reserve-then-true-up accounting: worst-case cost is committed before the gateway
call so concurrent requests can't overdraw; actual usage reconciles after.
Top-ups not open yet — the $5 grant is the only credit source.

## Python SDK

```bash
pip install cluster-agent
```

```python
from cluster import Cluster
c = Cluster(api_url="https://HOST", api_key="clst_...")

r = c.chat(
    "Draft a one-page thesis on the PONS ecosystem",
    model="anthropic/…",
    thinking=True,
)
print(r["reply"], r["usage"]["cost_usd"])
```

## Conversation Memory

Pass `conversation_id` to group turns server-side (each project = one id):

```json
{ "wallet": "0x…", "conversation_id": "proj-1734", "messages": [...] }
```

Grouped turns are queryable via `GET /api/chat/conversations?wallet=…`
(wallet-authenticated — titles are derived from user content, so it's private).
For cross-session *knowledge* (not just transcripts), use the memory skill's
`memory_retain` / `memory_recall` — or the Hindsight backend for learning memory.

## Model Selection Guide

| Task | Model class |
|---|---|
| Quick lookups, formatting, rewrites | `glm/glm-5.3-flash` (cheapest) |
| Code, structured extraction | Terra / Kimi class |
| Financial analysis, multi-step reasoning | Frontier + `thinking: true` |
| Long documents (100k+) | models with 400k context |

Metering is per-token against the *wallet* — the same credit powers chat in the
app, MCP tool calls, and API-key integrations.
