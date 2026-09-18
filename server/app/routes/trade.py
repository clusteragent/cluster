"""In-app trading routes — Uniswap v3 on Robinhood Chain (4663).

Why this module exists: the web app trades IN-PLACE. The browser cannot
always eth_call the public Robinhood RPC for quotes (cross-origin 403s,
same finding as Chronoa's /api/quote), so this server-side proxy does the
QuoterV2 call over raw JSON-RPC (no web3 dependency) and hands the
frontend a ready-to-sign path. The wallet stays in the browser — this
API never sees a private key and never broadcasts anything.

Contracts (verified on-chain, same set Chronoa + Kumo use):
  ROUTER   SwapRouter02  0xcaf681a66d020601342297493863e78c959e5cb2
  QUOTER   QuoterV2      0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7
  WETH                   0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
  USDG                   0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168

Execution patterns (encoded client-side in app/src/lib/swap.ts):
  buy   ETH -> token : multicall([exactInput, refundETH]) with msg.value
  sell  token -> ETH : multicall([exactInput(recipient=ROUTER), unwrapWETH9])
                       — requires approve(ROUTER, max) first
  The router pays the first WETH hop from msg.value; calling wrapETH
  first reverts with STF (see dex-pair-chart-embeds reference).

Honest failure: no route -> {"ok": false, "error": "no route"} (HTTP 200,
so the UI can render it); RPC down -> 502. Never a fabricated quote.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import httpx
from eth_abi import decode as abi_decode, encode as abi_encode
from eth_utils import keccak
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

RPC = "https://rpc.mainnet.chain.robinhood.com"
CHAIN_ID = 4663
WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73"
USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"
ROUTER_ADDR = "0xcaf681a66d020601342297493863e78c959e5cb2"
QUOTER = "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7"

# Short UA — the public RPC (and Yahoo) reject default/urllib agents.
_HEADERS = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}

# Route candidates — same proven set as Chronoa's quote function.
HOPS: list[tuple[int, int]] = [(100, 500), (500, 500), (100, 100), (500, 3000), (3000, 500)]
DIRECT = [500, 3000, 100, 10000]

_CACHE: dict[str, tuple[float, dict]] = {}
_TOKEN_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 30
_TOKEN_TTL = 600

_SEL_QUOTE = keccak(text="quoteExactInput(bytes,uint256)")[:4]
_SEL_DECIMALS = keccak(text="decimals()")[:4]
_SEL_SYMBOL = keccak(text="symbol()")[:4]
_SEL_BLOCK = keccak(text="eth_blockNumber")[:4]
_SEL_BALANCE_OF = keccak(text="balanceOf(address)")[:4]

# Multicall3 — verified deployed on Robinhood Chain (eth_getCode non-empty,
# 2026-09-16). Lets one RPC round-trip read all 193 stock-token balances.
MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11"
_SEL_AGGREGATE = keccak(text="aggregate((address,bytes)[])")[:4]

# Stock universe with on-chain addresses (193 entries, address+symbol+name).
_STOCKS_PATH = Path(__file__).resolve().parent.parent / "rh_stocks_raw.json"


def _stock_universe() -> list[dict]:
    if not hasattr(_stock_universe, "_cache"):
        with open(_STOCKS_PATH) as f:
            _stock_universe._cache = json.load(f)  # type: ignore[attr-defined]
    return _stock_universe._cache  # type: ignore[attr-defined]


def _balance_call(address: str, token: str) -> tuple[str, bytes]:
    """(address, calldata) for balanceOf(address) against `token` — the exact
    shape abi_encode("(address,bytes)[]") expects."""
    data = _SEL_BALANCE_OF + bytes(12) + bytes.fromhex(address[2:].lower())
    return (token, data)


def _decode_aggregate(raw_hex: str) -> list[int]:
    """Decode this chain's Multicall3 aggregate return.

    NOT standard eth_abi shape (decode() rejects it — same quirk as the
    QuoterV2 return). Empirically verified against the live RPC
    (values cross-checked 1:1 with direct balanceOf calls):
      head  = [block, offset=0x40, n, then n pointer words (stride 64)]
      tail  = n × [len(32), value(32)]  — no success flag word
      ptr_i is relative to the end of the n word; element i's payload
      sits at byte 96 + ptr_i; value = payload word 1 (only if len ≥ 32,
      else the call reverted → 0).
    """
    b = bytes.fromhex(raw_hex[2:])
    n = int.from_bytes(b[64:96], "big")
    out: list[int] = []
    for i in range(n):
        ptr = int.from_bytes(b[96 + i * 32 : 128 + i * 32], "big")
        base = 96 + ptr
        length = int.from_bytes(b[base : base + 32], "big")
        if length >= 32 and base + 64 <= len(b):
            out.append(int.from_bytes(b[base + 32 : base + 64], "big"))
        else:
            out.append(0)
    return out


def _rpc(method: str, params: list) -> dict:
    """One raw JSON-RPC call. Raises on transport / RPC-level error."""
    with httpx.Client(timeout=20.0, headers=_HEADERS) as c:
        r = c.post(RPC, content=json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}))
        r.raise_for_status()
        payload = r.json()
    if "error" in payload:
        raise RuntimeError(str(payload["error"])[:200])
    return payload


def _eth_call(to: str, data: str) -> str:
    payload = _rpc("eth_call", [{"to": to, "data": data}, "latest"])
    return payload.get("result") or ""


def _encode_path(token_in: str, fee: int, token_out: str) -> str:
    return token_in[2:].lower() + format(fee, "06x") + token_out[2:].lower()


def _quote_path(path_hex: str, amount_in: int) -> int | None:
    """QuoterV2.quoteExactInput — returns amountOut or None (no pool)."""
    try:
        data = "0x" + (_SEL_QUOTE + abi_encode(["bytes", "uint256"], [bytes.fromhex(path_hex), amount_in])).hex()
        raw = _eth_call(QUOTER, data)
        if not raw or raw == "0x":
            return None
        b = bytes.fromhex(raw[2:])
        # Correct return shape is 4 values; fall back for safety.
        for types in (
            ["uint256", "uint160[]", "uint32[]", "uint256"],
            ["uint256", "uint256"],
            ["uint256"],
        ):
            try:
                out = abi_decode(types, b)[0]
                return int(out) if int(out) > 0 else None
            except Exception:
                continue
        return None
    except Exception:
        return None


def _candidate_routes(token: str, side: str, via: str) -> list[tuple[str, str]]:
    """(path_hex, label) candidates — hopped-via-USDG first, then direct."""
    token = token.lower()
    routes: list[tuple[str, str]] = []
    if side == "buy":
        if via != "WETH":
            for a, b in HOPS:
                routes.append((_encode_path(WETH, a, USDG) + _encode_path(USDG, b, token)[40:], f"WETH/{a}/USDG/{b}"))
        for f in DIRECT:
            routes.append((_encode_path(WETH, f, token), f"WETH/{f}"))
        if via == "WETH":
            for a, b in HOPS:
                routes.append((_encode_path(WETH, a, USDG) + _encode_path(USDG, b, token)[40:], f"WETH/{a}/USDG/{b}"))
    else:
        if via != "WETH":
            for a, b in HOPS:
                routes.append((_encode_path(token, a, USDG) + _encode_path(USDG, b, WETH)[40:], f"{a}/USDG/{b}/WETH"))
        for f in DIRECT:
            routes.append((_encode_path(token, f, WETH), f"{f}/WETH"))
        if via == "WETH":
            for a, b in HOPS:
                routes.append((_encode_path(token, a, USDG) + _encode_path(USDG, b, WETH)[40:], f"{a}/USDG/{b}/WETH"))
    # dedupe, keep order
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for p, label in routes:
        if p in seen:
            continue
        seen.add(p)
        out.append((p, label))
    return out


def _token_meta(address: str) -> dict:
    """symbol()/decimals() for an arbitrary ERC-20, cached 10 min."""
    key = address.lower()
    hit = _TOKEN_CACHE.get(key)
    if hit and time.time() - hit[0] < _TOKEN_TTL:
        return hit[1]
    meta = {"address": address, "symbol": None, "decimals": 18}
    try:
        raw = _eth_call(address, "0x" + _SEL_SYMBOL.hex())
        if raw and raw != "0x":
            # string ABI: offset(32) + len(32) + data
            b = bytes.fromhex(raw[2:])
            length = int.from_bytes(b[32:64], "big")
            meta["symbol"] = b[64 : 64 + length].decode("utf-8", "replace")
    except Exception:
        pass
    try:
        raw = _eth_call(address, "0x" + _SEL_DECIMALS.hex())
        if raw and raw != "0x":
            meta["decimals"] = int(raw, 16)
    except Exception:
        pass
    _TOKEN_CACHE[key] = (time.time(), meta)
    return meta


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/status")
def trade_status():
    """Chain + gas + price context for the trade ticket. Real values only."""
    out: dict = {
        "chain_id": CHAIN_ID,
        "router": ROUTER_ADDR,
        "quoter": QUOTER,
        "weth": WETH,
        "usdg": USDG,
        "rpc_ok": False,
        "block": None,
        "gas_price_gwei": None,
        "eth_usd": None,
    }
    try:
        blk = _rpc("eth_blockNumber", []).get("result")
        out["block"] = int(blk, 16) if blk else None
        out["rpc_ok"] = True
    except Exception:
        return out
    try:
        gp = _rpc("eth_gasPrice", []).get("result")
        if gp:
            out["gas_price_gwei"] = round(int(gp, 16) / 1e9, 4)
    except Exception:
        pass
    try:
        with httpx.Client(timeout=8.0, headers={"User-Agent": "Mozilla/5.0"}) as c:
            r = c.get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd")
            r.raise_for_status()
            out["eth_usd"] = r.json().get("ethereum", {}).get("usd")
    except Exception:
        pass
    return out


@router.get("/token/{address}")
def token_meta(address: str):
    """ERC-20 symbol/decimals for any token (used to label arbitrary picks)."""
    if not (address.startswith("0x") and len(address) == 42):
        raise HTTPException(status_code=400, detail="bad address")
    return _token_meta(address)


@router.get("/quote")
def trade_quote(
    token: str = Query(..., description="token contract address"),
    side: str = Query("buy", pattern="^(buy|sell)$"),
    amount: str = Query(..., description="amount in wei of the input token"),
    via: str = Query("USDG", pattern="^(USDG|WETH)$"),
    dec: int = Query(18, ge=0, le=36, description="decimals of the OUTPUT token"),
):
    """Best available Uniswap v3 route for the requested swap.

    Returns 200 with {"ok": false, "error": "no route"} when no pool
    exists — the UI renders that verbatim. 502 only when the RPC itself
    is unreachable.
    """
    tok = token.lower()
    if not (tok.startswith("0x") and len(tok) == 42):
        raise HTTPException(status_code=400, detail="bad token")
    try:
        amount_wei = int(amount)
    except ValueError:
        raise HTTPException(status_code=400, detail="bad amount") from None
    if amount_wei <= 0:
        raise HTTPException(status_code=400, detail="bad amount")

    cache_key = f"{side}:{tok}:{amount_wei}:{via}:{dec}"
    hit = _CACHE.get(cache_key)
    if hit and time.time() - hit[0] < _CACHE_TTL:
        return hit[1]

    routes = _candidate_routes(tok, side, via)
    rpc_seen = False
    for path_hex, label in routes:
        out = _quote_path(path_hex, amount_wei)
        if out is None:
            continue
        rpc_seen = True
        payload = {
            "ok": True,
            "path": "0x" + path_hex,
            "label": label,
            "amountOut": str(out),
            "decimals": dec,
            "side": side,
            "token": tok,
        }
        _CACHE[cache_key] = (time.time(), payload)
        return payload

    # Distinguish "no pool" from "RPC down": probe a trivial call.
    try:
        _rpc("eth_blockNumber", [])
        rpc_seen = True
    except Exception:
        raise HTTPException(status_code=502, detail="Robinhood Chain RPC unreachable") from None

    return {"ok": False, "error": "no route", "side": side, "token": tok}


# ---------------------------------------------------------------------------
# Wallet balances — what the connected address actually holds, on-chain.
# One Multicall3.aggregate round-trip reads native ETH + all 193 stock
# tokens. Values are reported raw; the UI renders empty states when zero.
# ---------------------------------------------------------------------------

_WALLET_CACHE: dict[str, tuple[float, dict]] = {}
_WALLET_TTL = 20  # balances change on every trade — keep this short
_WALLET_BAD = 60  # cache failures longer so a dead RPC doesn't get hammered


@router.get("/wallet/{address}")
def wallet_balances(address: str):
    """Native ETH + every nonzero ERC-20 stock balance for one address.

    Honest shape: zero balances are omitted entirely (the UI shows
    'nothing here yet'); RPC failure is a 502, never a fabricated zero.
    """
    addr = address.strip()
    if not (addr.startswith("0x") and len(addr) == 42):
        raise HTTPException(status_code=400, detail="bad address")
    addr = addr.lower()

    now = time.time()
    hit = _WALLET_CACHE.get(addr)
    if hit:
        ts, payload = hit
        if now - ts < (_WALLET_TTL if payload.get("ok") else _WALLET_BAD):
            return payload

    universe = _stock_universe()
    calls: list[tuple[str, bytes]] = []
    for entry in universe:
        calls.append(_balance_call(addr, entry["address"]))

    try:
        call_data = "0x" + (
            _SEL_AGGREGATE + abi_encode(["(address,bytes)[]"], [calls])
        ).hex()
        raw = _eth_call(MULTICALL3, call_data)
        balances = _decode_aggregate(raw)
        eth_hex = _rpc("eth_getBalance", [addr, "latest"]).get("result") or "0x0"
        eth_wei = int(eth_hex, 16)
    except Exception:
        cached_fail = (now, {"ok": False, "error": "rpc_unreachable", "wallet": addr})
        _WALLET_CACHE[addr] = cached_fail
        raise HTTPException(status_code=502, detail="Robinhood Chain RPC unreachable") from None

    by_symbol: dict[str, str] = {}
    for entry, bal in zip(universe, balances):
        if bal > 0:
            by_symbol[entry["symbol"]] = str(bal)

    payload = {
        "ok": True,
        "wallet": addr,
        "chain_id": CHAIN_ID,
        "block": None,
        "eth_wei": str(eth_wei),
        "balances": by_symbol,
        "nonzero": len(by_symbol),
        "universe": len(universe),
    }
    _WALLET_CACHE[addr] = (now, payload)
    return payload
