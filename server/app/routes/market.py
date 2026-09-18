"""Real market data routes.

Three real sources — nothing simulated, ever:

1. ``/quotes`` — batch quotes + ~1 month of daily closes for tokenized
   stock symbols, proxied from Yahoo Finance's public spark endpoint
   (with a per-symbol chart fallback). Same data source the SPX500 site
   (divvyfinance/spx500) uses. Batched (20 symbols per upstream call),
   cached 60s in-memory.
2. ``/agent-quotes`` + ``/quote/{symbol}`` — OpenBB/yfinance crypto spot
   data for the agents that have a real market analogue (Relay→ETH,
   Pivot→BTC, ...). Agents with no analogue are omitted — never mapped
   to a fabricated number.

Upstream failure returns a clean 502 — the frontend shows "market data
unavailable", never a made-up price.
"""
from __future__ import annotations

import time
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 60  # seconds — spot data refresh cadence

# NOTE: Yahoo throttles the long desktop UA string from datacenter IPs
# (429 "Too Many Requests" on every call). The SHORT "Mozilla/5.0" UA is
# accepted consistently — verified 6/6 and a full 20-symbol batch on this
# VPS. Keep it short.
_UA = "Mozilla/5.0"
_HEADERS = {"User-Agent": _UA, "Accept": "application/json"}


# ---------------------------------------------------------------------------
# Basket quotes — Yahoo spark (batched), chart fallback per symbol
# ---------------------------------------------------------------------------

def _num(v: Any) -> float | None:
    return round(float(v), 4) if isinstance(v, (int, float)) else None


def _parse_chart_result(sym: str, result: dict) -> dict:
    """Normalize one Yahoo chart/spark result into our quote shape."""
    meta = result.get("meta") or {}
    quote_block = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    closes_raw = quote_block.get("close") or []
    stamps = result.get("timestamp") or []

    series: list[list[float]] = []
    candles: list[dict] = []
    opens_raw = quote_block.get("open") or []
    highs_raw = quote_block.get("high") or []
    lows_raw = quote_block.get("low") or []
    for i, c in enumerate(closes_raw):
        if i >= len(stamps) or not isinstance(c, (int, float)):
            continue
        series.append([int(stamps[i]), round(float(c), 4)])
        o = opens_raw[i] if i < len(opens_raw) else None
        h = highs_raw[i] if i < len(highs_raw) else None
        lo = lows_raw[i] if i < len(lows_raw) else None
        if all(isinstance(v, (int, float)) for v in (o, h, lo)):
            candles.append({
                "t": int(stamps[i]),
                "o": round(float(o), 4), "h": round(float(h), 4),
                "l": round(float(lo), 4), "c": round(float(c), 4),
            })

    price = _num(meta.get("regularMarketPrice"))
    # NOTE: chartPreviousClose is the close BEFORE the range (e.g. ~1 month
    # ago for range=1mo) — NOT yesterday's close. Using it produced absurd
    # change percentages (MRNA read +127% when the real day move was -2%).
    # Priority: Yahoo's own regularMarketChangePercent (the authoritative
    # day change) → last two daily closes of the series → chartPreviousClose.
    change_pct = _num(meta.get("regularMarketChangePercent"))
    prev: float | None = None
    if len(series) >= 2:
        prev = series[-2][1]
    if prev is None:
        prev = _num(meta.get("previousClose")) or _num(meta.get("chartPreviousClose"))
    if change_pct is None and price is not None and prev:
        change_pct = round((price - prev) / prev * 100, 2)
    change = round(price - prev, 4) if price is not None and prev is not None else None

    return {
        "symbol": sym,
        "name": meta.get("shortName") or meta.get("longName") or sym,
        "currency": meta.get("currency") or "USD",
        "exchange": meta.get("fullExchangeName") or meta.get("exchangeName"),
        "price": price,
        "previousClose": prev,
        "change": change,
        "change_pct": change_pct,
        "day_high": _num(meta.get("regularMarketDayHigh")),
        "day_low": _num(meta.get("regularMarketDayLow")),
        "market_time": meta.get("regularMarketTime"),
        "series": series[-22:],
        "candles": candles[-90:],
    }


def _fetch_spark(symbols: list[str]) -> dict[str, dict]:
    """Yahoo spark — batch endpoint, up to 20 symbols per call."""
    with httpx.Client(timeout=20.0, headers=_HEADERS) as c:
        r = c.get(
            "https://query1.finance.yahoo.com/v7/finance/spark",
            params={"symbols": ",".join(symbols), "range": "1mo", "interval": "1d"},
        )
        r.raise_for_status()
        payload = r.json()

    out: dict[str, dict] = {}
    for item in ((payload.get("spark") or {}).get("result") or []):
        sym = item.get("symbol")
        resp = (item.get("response") or [{}])[0]
        if not sym:
            continue
        out[sym.upper()] = _parse_chart_result(sym.upper(), resp)
    return out


def _fetch_chart(symbol: str) -> dict | None:
    """Per-symbol fallback when spark returns nothing for a symbol."""
    try:
        with httpx.Client(timeout=15.0, headers=_HEADERS) as c:
            r = c.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
                params={"range": "1mo", "interval": "1d"},
            )
            r.raise_for_status()
            payload = r.json()
        results = ((payload.get("chart") or {}).get("result") or [])
        if not results:
            return None
        return _parse_chart_result(symbol.upper(), results[0])
    except Exception:
        return None


def _fetch_yfinance(symbols: list[str]) -> dict[str, dict]:
    """Last-resort fallback: yfinance (already in this venv via OpenBB).

    Only used when the spark batch fails for symbols — same underlying
    data, slower, one symbol at a time. Never fabricates values.
    """
    out: dict[str, dict] = {}
    try:
        import yfinance as yf  # lazy — heavy import
    except Exception:
        return out
    for sym in symbols:
        try:
            h = yf.Ticker(sym).history(period="1mo", interval="1d")
            if h is None or len(h) < 2:
                continue
            closes = [float(v) for v in h["Close"].tolist()]
            stamps = [int(ts.timestamp()) for ts in h.index]
            price = closes[-1]
            prev = closes[-2]
            series = [[stamps[i], round(closes[i], 4)] for i in range(len(closes))]
            out[sym.upper()] = {
                "symbol": sym.upper(),
                "name": sym.upper(),
                "currency": "USD",
                "exchange": None,
                "price": round(price, 4),
                "previousClose": round(prev, 4),
                "change": round(price - prev, 4),
                "change_pct": round((price - prev) / prev * 100, 2) if prev else None,
                "day_high": None,
                "day_low": None,
                "market_time": stamps[-1] if stamps else None,
                "series": series[-22:],
                "source": "yfinance",
            }
        except Exception:
            continue
    return out


@router.get("/quotes")
def get_quotes(
    symbols: str = Query(..., description="Comma-separated symbols, e.g. AAPL,NVDA,MSFT"),
):
    """Batch quotes + sparkline series (1mo daily closes). Cached 60s.

    Honest failure mode: if the upstream is unreachable for every symbol,
    this returns 502 — it never invents a price.
    """
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not syms:
        raise HTTPException(status_code=400, detail="no symbols given")
    if len(syms) > 60:
        raise HTTPException(status_code=400, detail="too many symbols (max 60)")

    now = time.time()
    out: dict[str, Any] = {}
    missing: list[str] = []
    for s in syms:
        cached = _CACHE.get(f"spark:{s}")
        if cached and now - cached[0] < _CACHE_TTL:
            out[s] = cached[1]
        else:
            missing.append(s)

    if missing:
        fetched: dict[str, dict] = {}
        try:
            for i in range(0, len(missing), 20):
                fetched.update(_fetch_spark(missing[i : i + 20]))
        except Exception:
            fetched = {}

        # Per-symbol chart fallback for whatever spark didn't return.
        for s in missing:
            if s in fetched:
                continue
            one = _fetch_chart(s)
            if one:
                fetched[s] = one

        # Last resort: yfinance direct (slower, same data).
        still_missing = [s for s in missing if s not in fetched]
        if still_missing:
            fetched.update(_fetch_yfinance(still_missing))

        if not fetched and missing:
            raise HTTPException(
                status_code=502,
                detail="Market data unavailable — upstream returned nothing for the requested symbols.",
            )
        for s, q in fetched.items():
            _CACHE[f"spark:{s}"] = (now, q)
            out[s] = q

    return {
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "count": len(out),
        "quotes": out,
    }


# ---------------------------------------------------------------------------
# Movers + sectors + chart — the market-analysis surface (SPX500 pattern)
# ---------------------------------------------------------------------------

_MOVERS_CACHE: tuple[float, dict] | None = None
_MOVERS_TTL = 120


@router.get("/movers")
def get_movers(limit: int = Query(8, ge=1, le=25)):
    """Top gainers/losers across the whole tradeable universe.

    Fetches every symbol in the catalogue (batched, parallel), then
    sorts by day change. Cached 2 min — this is the slowest endpoint by
    design (it covers all ~193 instruments), never fabricated.
    """
    global _MOVERS_CACHE
    now = time.time()
    if _MOVERS_CACHE and now - _MOVERS_CACHE[0] < _MOVERS_TTL:
        payload = _MOVERS_CACHE[1]
    else:
        from concurrent.futures import ThreadPoolExecutor

        from app.stocks_catalogue import STOCKS

        syms = [s["symbol"] for s in STOCKS]
        fetched: dict[str, dict] = {}

        def _batch(chunk: list[str]) -> dict[str, dict]:
            try:
                return _fetch_spark(chunk)
            except Exception:
                return {}

        chunks = [syms[i : i + 20] for i in range(0, len(syms), 20)]
        with ThreadPoolExecutor(max_workers=6) as pool:
            for part in pool.map(_batch, chunks):
                fetched.update(part)

        # Fill gaps per-symbol (bounded — skip if too many failed)
        gaps = [s for s in syms if s not in fetched]
        if gaps and len(gaps) <= 40:
            with ThreadPoolExecutor(max_workers=6) as pool:
                for s, q in zip(gaps, pool.map(_fetch_chart, gaps)):
                    if q:
                        fetched[s] = q

        rows = []
        for sym, q in fetched.items():
            if q.get("price") is None or q.get("change_pct") is None:
                continue
            rows.append(
                {
                    "symbol": sym,
                    "name": q.get("name") or sym,
                    "price": q.get("price"),
                    "change_pct": q.get("change_pct"),
                }
            )
        rows.sort(key=lambda r: r["change_pct"])
        payload = {
            "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "universe": len(syms),
            "covered": len(rows),
            "gainers": list(reversed(rows[-limit:])),
            "losers": rows[:limit],
        }
        for s, q in fetched.items():
            _CACHE[f"spark:{s}"] = (now, q)
        _MOVERS_CACHE = (now, payload)

    return payload


@router.get("/sectors")
def get_sectors():
    """Day change aggregated by sector across the tradeable universe."""
    global _MOVERS_CACHE
    now = time.time()
    if not _MOVERS_CACHE or now - _MOVERS_CACHE[0] >= _MOVERS_TTL:
        get_movers(limit=8)  # warms the shared cache
    if not _MOVERS_CACHE:
        raise HTTPException(status_code=502, detail="Market data unavailable")

    try:
        from app.sector_map import SECTORS
    except ImportError:
        # sector_map ships with the repo; if a partial checkout lacks it
        # fall back to a single bucket rather than 500ing the endpoint.
        SECTORS = {}

    buckets: dict[str, list[float]] = {}
    for row in _MOVERS_CACHE[1]["gainers"] + _MOVERS_CACHE[1]["losers"]:
        sec = SECTORS.get(row["symbol"], "Other")
        buckets.setdefault(sec, []).append(row["change_pct"])

    # For a full sector table we need every covered row, not just movers.
    # Re-derive from the quote cache (already warmed by get_movers).
    all_rows: dict[str, list[float]] = {}
    for key, (ts, q) in list(_CACHE.items()):
        if not key.startswith("spark:") or q.get("change_pct") is None:
            continue
        sym = key.split(":", 1)[1]
        sec = SECTORS.get(sym, "Other")
        all_rows.setdefault(sec, []).append(q["change_pct"])

    sectors = [
        {
            "sector": sec,
            "count": len(vals),
            "avg_change_pct": round(sum(vals) / len(vals), 2),
            "advancers": sum(1 for v in vals if v > 0),
            "decliners": sum(1 for v in vals if v < 0),
        }
        for sec, vals in all_rows.items()
    ]
    sectors.sort(key=lambda s: s["avg_change_pct"], reverse=True)
    return {"fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "sectors": sectors}


@router.get("/chart/{symbol}")
def get_chart(
    symbol: str,
    tf: str = Query("1mo", pattern="^(1d|5d|1mo|3mo|6mo|1y|5y)$"),
):
    """OHLC-ish close series for one symbol (Yahoo v8 chart proxy).

    tf=1d -> 5-minute bars; everything else -> daily bars. Honest 502 on
    upstream failure.
    """
    interval = "5m" if tf == "1d" else "1d"
    try:
        with httpx.Client(timeout=20.0, headers=_HEADERS) as c:
            r = c.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol.upper()}",
                params={"range": tf, "interval": interval},
            )
            r.raise_for_status()
            payload = r.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Chart unavailable: {exc}") from exc

    results = ((payload.get("chart") or {}).get("result") or [])
    if not results:
        raise HTTPException(status_code=502, detail=f"No chart data for {symbol}")
    parsed = _parse_chart_result(symbol.upper(), results[0])
    parsed["tf"] = tf
    parsed["source"] = "yahoo-chart"
    return parsed


# ---------------------------------------------------------------------------
# Agent quotes — OpenBB (crypto spot) for agents with a market analogue
# ---------------------------------------------------------------------------

# Maps AgentIndex tickers with a natural real-world analogue to a
# tradeable symbol. Agents without a real market instrument (Ledger,
# Memoria, Quill, ...) simply aren't included here — no fake mapping.
SYMBOL_MAP = {
    "relay": "ETH-USD",   # DEX router — tracks ETH
    "pivot": "BTC-USD",   # momentum trader — tracks BTC
    "nexus": "SOL-USD",   # portfolio/yield across chains — tracks SOL
    "vault": "ETH-USD",   # treasury compounding — tracks ETH
    "oracle": "BTC-USD",  # price/prediction feed — tracks BTC
}


def _fetch_quote(symbol: str) -> dict:
    cached = _CACHE.get(symbol)
    if cached and time.time() - cached[0] < _CACHE_TTL:
        return cached[1]

    from openbb import obb  # imported lazily — slow to init, avoid at module load

    result = obb.crypto.price.historical(symbol, provider="yfinance", interval="1d")
    df = result.to_dataframe().tail(2)
    if len(df) < 2:
        raise HTTPException(status_code=502, detail=f"Not enough data for {symbol}")

    prev_close = float(df.iloc[-2]["close"])
    last_close = float(df.iloc[-1]["close"])
    change_pct = round((last_close - prev_close) / prev_close * 100, 2)

    payload = {
        "symbol": symbol,
        "price": round(last_close, 2),
        "change_pct": change_pct,
        "volume": float(df.iloc[-1]["volume"]),
        "as_of": str(df.index[-1]),
    }
    _CACHE[symbol] = (time.time(), payload)
    return payload


@router.get("/quote/{symbol}")
def get_quote(symbol: str):
    """Real spot price + 24h change for a symbol (e.g. BTC-USD, ETH-USD)."""
    try:
        return _fetch_quote(symbol.upper())
    except HTTPException:
        raise
    except Exception as exc:  # OpenBB/network errors — surface, don't fake data
        raise HTTPException(status_code=502, detail=f"Market data unavailable: {exc}") from exc


@router.get("/agent-quotes")
def get_agent_quotes():
    """Real quotes for every agent that has a market analogue.

    Agents without a mapped symbol are simply omitted — the frontend
    falls back to the static reward rate for those, never a fabricated
    number.
    """
    out = {}
    for agent_id, symbol in SYMBOL_MAP.items():
        try:
            out[agent_id] = _fetch_quote(symbol)
        except Exception as exc:
            out[agent_id] = {"error": str(exc)}
    return {"quotes": out}

# ---------------------------------------------------------------------------
# News — Yahoo Finance RSS (real headlines, no key required)
# ---------------------------------------------------------------------------

@router.get("/news")
def news(count: int = Query(18, ge=1, le=40)) -> dict:
    """Market news headlines from Yahoo Finance's public RSS feed.
    Parsed server-side; cached 120s. Returns publisher, title, link,
    published time. Nothing simulated."""
    import re as _re
    import urllib.request
    import xml.etree.ElementTree as ET
    from datetime import datetime as _dt

    key = f"news:{count}"
    cached = _CACHE.get(key)
    if cached and time.time() - cached[0] < 120:
        return cached[1]

    url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": _UA})
        with urllib.request.urlopen(req, timeout=12) as res:
            body = res.read()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"news feed unreachable: {exc}") from exc

    items = []
    try:
        root = ET.fromstring(body)
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub = (item.findtext("pubDate") or "").strip()
            desc = (item.findtext("description") or "").strip()
            # strip html tags from description
            desc = _re.sub(r"<[^>]+>", "", desc)[:280]
            published = None
            if pub:
                try:
                    from email.utils import parsedate_to_datetime
                    published = parsedate_to_datetime(pub).isoformat()
                except Exception:
                    published = pub
            if title:
                items.append({
                    "title": title, "link": link, "publisher": "Yahoo Finance",
                    "published": published, "summary": desc,
                })
            if len(items) >= count:
                break
    except ET.ParseError as exc:
        raise HTTPException(status_code=502, detail=f"news feed malformed: {exc}") from exc

    payload = {"items": items, "count": len(items)}
    _CACHE[key] = (time.time(), payload)
    return payload
