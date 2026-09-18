"""Static agent catalogue — mirrors src/data/agents.ts on the frontend.

Single source of truth would ideally be a shared JSON file; kept as a
plain Python module for now so the backend has zero build step. If you
edit the frontend catalogue, mirror the change here (or, better, load
both sides from agents.json — see TODO below).
"""
from __future__ import annotations

AGENTS = [
    {"id": "relay",   "name": "Relay",   "ticker": "RLY",  "reward": 6, "category": "Trading",  "trigger": "Per swap",   "blurb": "DEX trading agent. Routes swaps across pools and shares fees with holders."},
    {"id": "scout",   "name": "Scout",   "ticker": "SCT",  "reward": 5, "category": "Research", "trigger": "Per report", "blurb": "Deep-research agent. Every commissioned report pays rewards to $CLST holders."},
    {"id": "ledger",  "name": "Ledger",  "ticker": "FIN",  "reward": 5, "category": "Finance",  "trigger": "Per task",   "blurb": "Bookkeeping and reconciliation agent. Settles in $CLST."},
    {"id": "argus",   "name": "Argus",   "ticker": "ARG",  "reward": 5, "category": "Analysis", "trigger": "Per query",  "blurb": "On-chain analysis agent watching flows, wallets and whales."},
    {"id": "pivot",   "name": "Pivot",   "ticker": "PVT",  "reward": 5, "category": "Trading",  "trigger": "Per swap",   "blurb": "Momentum trading agent for DEX markets. Fees stream back to holders."},
    {"id": "prism",   "name": "Prism",   "ticker": "PRSM", "reward": 4, "category": "Analysis", "trigger": "Per query",  "blurb": "Breaks any dataset into signals. Queries pay holders."},
    {"id": "memoria", "name": "Memoria", "ticker": "MEM",  "reward": 4, "category": "Memory",   "trigger": "Per task",   "blurb": "Long-term memory agent. Stores, recalls and pays for every recall."},
    {"id": "sifter",  "name": "Sifter",  "ticker": "SFT",  "reward": 4, "category": "Research", "trigger": "Per report", "blurb": "Literature and source sifting agent for evidence-grade answers."},
    {"id": "remit",   "name": "Remit",   "ticker": "RMT",  "reward": 4, "category": "Finance",  "trigger": "Per task",   "blurb": "Payments and invoicing agent. Each settled invoice drops rewards."},
    {"id": "nexus",   "name": "Nexus",   "ticker": "NXS",  "reward": 3, "category": "Crypto",   "trigger": "Per task",   "blurb": "Portfolio agent tracking wallets, positions and yield across chains."},
    {"id": "echo",    "name": "Echo",    "ticker": "ECH",  "reward": 3, "category": "Memory",   "trigger": "Per query",  "blurb": "Conversation memory agent. Remembers everything, rewards holders."},
    {"id": "census",  "name": "Census",  "ticker": "CNS",  "reward": 3, "category": "Analysis", "trigger": "Per query",  "blurb": "Market census agent. Counts, segments and ranks any market."},
    {"id": "vault",   "name": "Vault",   "ticker": "VLT",  "reward": 3, "category": "Crypto",   "trigger": "Per task",   "blurb": "Treasury agent compounding idle balances into holder rewards."},
    {"id": "quill",   "name": "Quill",   "ticker": "QLL",  "reward": 2, "category": "Research", "trigger": "Per report", "blurb": "Writing and synthesis agent for briefs, memos and summaries."},
    {"id": "oracle",  "name": "Oracle",  "ticker": "ORC",  "reward": 2, "category": "Crypto",   "trigger": "Per query",  "blurb": "Price and prediction feed agent. Every feed call pays a reward."},
    {"id": "margin",  "name": "Margin",  "ticker": "MRG",  "reward": 2, "category": "Finance",  "trigger": "Per task",   "blurb": "Risk and margin agent. Keeps books balanced, holders paid."},
]

AGENTS_BY_ID = {a["id"]: a for a in AGENTS}
