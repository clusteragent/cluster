# Self-Hosting cluster

Run the entire stack on your own machine. Market data works out of the box; the
LLM gateway needs one provider key.

## 1. Backend API (Python / FastAPI)

The backend ships as a Docker image:

```bash
docker run -d --name cluster-api -p 8000:8000 \
  -e AGENTINDEX_LLM_API_KEY=sk-… \
  -e AGENTINDEX_LLM_BASE_URL=https://your-gateway/v1 \
  ghcr.io/clusteragent/cluster-api:latest
# → health: http://localhost:8000/health
```

(Currently distributed to verified self-hosters — the operational stack, including
the keeper bot that signs treasury transactions, is kept out of this public repo
on purpose. Open an issue to request access.)

What runs without any external service: quotes, movers, sectors, news, index,
payout basket, distributions feed (local keeper-bot snapshot), swap quotes +
routes (raw RPC to Robinhood Chain), wallet balances (Multicall3), memory
(SQLite), credits, keys. Only `/api/chat` needs the gateway key.

## 2. Frontend

Ships in the same image behind the API (single container). Or run the React app
separately and set `AGENTINDEX_CORS_ORIGINS` to its origin.

## 3. Keeper bot (payout mechanism)

Runs inside the API container (supervised), DRY mode by default — reads the vault,
prices the basket, publishes the feed, settles nothing. LIVE mode requires an
explicit `--confirm-real-money` flag AND a `TREASURY_PRIVATE_KEY`, which only the
operator holds. Distribution data is public via `/api/distributions` regardless.

- DRY mode is the default and is safe: it exercises the full loop (vault read →
  basket pricing → feed publish) without moving funds
- The bot publishes `bot/latest.json` (~60s cadence) which `/api/distributions`
  reads from disk — zero network hop
- Point `AGENTINDEX_FEED_URL` at a public snapshot URL for multi-instance setups

## 4. Optional: Hindsight memory backend

```bash
docker run -it --pull always --name hindsight --restart unless-stopped \
  -p 8888:8888 -p 9999:9999 \
  -e HINDSIGHT_API_LLM_PROVIDER=openai \
  -e HINDSIGHT_API_LLM_API_KEY=$OPENAI_API_KEY \
  -v hindsight-data:/home/hindsight/.pg0 \
  ghcr.io/vectorize-io/hindsight:latest
```

```bash
# server/.env
MEMORY_BACKEND=hindsight
HINDSIGHT_URL=http://localhost:8888
```

See `skills/memory/SKILL.md` for the full comparison.

## 5. Optional: public exposure

```bash
cloudflared tunnel --url http://127.0.0.1:8000
# or any reverse proxy; then set CLUSTER_API_URL for skill/MCP clients
```

## Environment Reference (server/.env)

| Variable | Purpose |
|---|---|
| `AGENTINDEX_LLM_API_KEY` | LLM gateway key (chat) |
| `AGENTINDEX_LLM_BASE_URL` | [OI]-compatible endpoint |
| `AGENTINDEX_CORS_ORIGINS` | Comma-separated frontend origins (never `*` with real auth) |
| `AGENTINDEX_DB_PATH` | SQLite path (default `server/cluster.db`) |
| `AGENTINDEX_FEED_URL` | Public distribution snapshot URL (optional; local disk default) |
| `AGENTINDEX_CLST_TOKEN_ADDRESS` | $CLST contract once deployed |
| `AGENTINDEX_DEV_AUTH_BYPASS` | `1` = local curl testing ONLY — never in production |
| `MEMORY_BACKEND` | `sqlite` (default) or `hindsight` |
| `HINDSIGHT_URL` / `HINDSIGHT_TENANT` | Hindsight connection |

## Security Notes

- Wallet auth: single-use challenge → signature → 60-min session token; fail-closed
- API keys: SHA-256 at rest, raw shown once, wallet-bound, 20/wallet cap
- Chat credit: reserve-then-true-up (concurrent-safe), 30 req/min/wallet
- The API never holds private keys; swap txs are built server-side but signed
  client-side by the user's wallet
- CORS defaults to localhost dev origins — set explicit origins in production
