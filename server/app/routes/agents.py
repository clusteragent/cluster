"""Agent catalogue routes: list & filter agents."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.agents_catalogue import AGENTS, AGENTS_BY_ID

router = APIRouter()


@router.get("")
def list_agents(
    category: str | None = Query(None, description="Filter by category, e.g. Finance"),
    q: str | None = Query(None, description="Search by name or ticker"),
):
    results = AGENTS
    if category and category.lower() != "all":
        results = [a for a in results if a["category"].lower() == category.lower()]
    if q:
        needle = q.lower()
        results = [a for a in results if needle in a["name"].lower() or needle in a["ticker"].lower()]
    return {"count": len(results), "agents": results}


@router.get("/{agent_id}")
def get_agent(agent_id: str):
    agent = AGENTS_BY_ID.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    return agent
