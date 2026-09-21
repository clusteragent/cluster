# Changelog — @clusteragent/cluster-mcp

## 1.0.11
- `agent_run` gains `idempotency_key` — safe retries, no duplicate queued runs.
- New `get_run_status` tool: poll a queued/running/completed/failed run.
- Backend `RunEvent` now persists `attempts`, `started_at`, `finished_at`.
- Public `GET /api/status` version/capability endpoint referenced by docs.

## 1.0.10
- `agent_run` becomes a durable queue entry (`queued → running → completed/failed`)
  instead of a synchronous fire-and-forget log line.
- Finance runs (`ledger`, `remit`, `margin`) attach a cited market snapshot
  (`sources: ["/api/market/quotes"]`) instead of a bare acknowledgement.

## 1.0.9 and earlier
- See git history: https://github.com/clusteragent/cluster/commits/main
