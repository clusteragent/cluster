"""cluster — Python SDK for the cluster agentic finance runtime.

Robinhood Chain (4663) · tokenized stocks + crypto · Uniswap v3 ·
persistent memory · 24-model LLM gateway.

Zero private keys: swap methods quote and build calldata; you sign with
your own signer (ethers/viem/web3).
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

__version__ = "1.0.0"

WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73"
USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"
ROUTER = "0xcaf681a66d020601342297493863e78c959e5cb2"
QUOTER_V2 = "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7"
CHAIN_ID = 4663
EXPLORER = "https://robinhoodchain.blockscout.com"

PONS = "0x39dBED3a2bd333467115dE45665cC57F813C4571"
CLIPPY = "0x85856f025bf13b8fd2aae2f6da458318744f1e18"
KARMA = "0xb47f4702deb124cb4eb6286be83c9d84277c6239"


class ClusterError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(f"HTTP {status}: {detail}")
        self.status = status
        self.detail = detail


class Memory:
    """Persistent per-wallet memory (retain/recall)."""

    def __init__(self, client: "Cluster"):
        self._c = client

    def retain(self, content: str, title: str | None = None, tags: list[str] | None = None,
               bank_id: str | None = None, force: bool = False) -> dict:
        """Store a durable note (max 4000 chars). Deduped unless force=True."""
        return self._c._post("/api/memory/retain", {
            "bank_id": bank_id or self._c.wallet, "wallet": self._c.wallet,
            "content": content, "title": title, "tags": tags, "force": force,
            "session_token": self._c.session_token, "api_key": self._c.api_key,
        })

    def recall(self, query: str, limit: int = 10, bank_id: str | None = None) -> dict:
        """Recall notes scored by recency-decay match."""
        return self._c._post("/api/memory/recall", {
            "bank_id": bank_id or self._c.wallet, "wallet": self._c.wallet,
            "query": query, "limit": limit,
            "session_token": self._c.session_token, "api_key": self._c.api_key,
        })


class Cluster:
    """Client for a cluster backend (hosted or self-hosted)."""

    def __init__(self, api_url: str = "https://clusteragent.dev", api_key: str | None = None,
                 wallet: str | None = None, session_token: str | None = None, timeout: float = 60.0):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.wallet = wallet or ""
        self.session_token = session_token
        self.timeout = timeout
        self.memory = Memory(self)

    # ── transport ────────────────────────────────────────────────────────────
    def _request(self, method: str, path: str, body: dict | None = None) -> dict:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(
            f"{self.api_url}{path}", data=data, method=method,
            headers={"Content-Type": "application/json", "Accept": "application/json",
                     **({"X-API-Key": self.api_key} if self.api_key else {})},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                return json.loads(res.read().decode())
        except urllib.error.HTTPError as e:
            detail = e.read().decode()[:300]
            raise ClusterError(e.code, detail) from None

    def _get(self, path: str) -> dict:
        return self._request("GET", path)

    def _post(self, path: str, body: dict) -> dict:
        return self._request("POST", path, body)

    # ── health ───────────────────────────────────────────────────────────────
    def health(self) -> dict:
        return self._get("/health")

    # ── market data (no auth) ────────────────────────────────────────────────
    def quotes(self, symbols: list[str]) -> dict:
        """Batch quotes + ~1 month of daily closes. Symbols: NVDA, SPY, PONS, …"""
        return self._get(f"/api/market/quotes?symbols={','.join(symbols)}")

    def movers(self, limit: int = 10) -> dict:
        """Gainers, losers, sector heat across the 192-instrument universe."""
        return self._get(f"/api/market/movers?limit={limit}")

    def news(self, limit: int = 12) -> dict:
        """Yahoo Finance headlines."""
        return self._get(f"/api/market/news?limit={limit}")

    def chart(self, symbol: str, tf: str = "1mo") -> dict:
        """Series + candles for a symbol."""
        return self._get(f"/api/market/chart/{symbol}?tf={tf}")

    # ── index & payouts (no auth) ────────────────────────────────────────────
    def index(self) -> dict:
        """Index composition: 193 instruments, on-chain verified count, $CLST status."""
        return self._get("/api/index")

    def payout_basket(self) -> dict:
        """The 19-name payout basket with weights (sum = 100)."""
        return self._get("/api/index/payout-basket")

    def distributions(self) -> dict:
        """Cycles, payroll, treasury — the public payout record."""
        return self._get("/api/distributions")

    # ── trading ──────────────────────────────────────────────────────────────
    def quote_swap(self, token: str, side: str, amount_wei: int, via: str | None = None) -> dict:
        """Uniswap v3 route + amountOut. amount_wei is WEI of the input token.

        side: 'buy' (ETH -> token) or 'sell' (token -> ETH).
        Non-custodial: this quotes; build the tx and sign with YOUR signer.
        """
        qs = f"?token={token}&side={side}&amount={amount_wei}"
        if via:
            qs += f"&via={via}"
        return self._get(f"/api/trade/quote{qs}")

    def trade_status(self) -> dict:
        """Router, quoter, WETH, USDG, gas, ETH price."""
        return self._get("/api/trade/status")

    def wallet_balances(self, address: str) -> dict:
        """On-chain balances: native ETH + every held token (no auth)."""
        return self._get(f"/api/trade/wallet/{address}")

    def build_swap_calldata(self, path: str, amount_in: int, min_out: int,
                            recipient: str, side: str) -> dict:
        """Build SwapRouter02 multicall calldata for the quote's path.

        Returns {'to': ROUTER, 'data': hex, 'value': int} — sign this with your
        own signer. Buy: value = amount_in. Sell: approve ROUTER first, value = 0.
        """
        from eth_abi.abi import encode as abi_encode  # optional dep

        sel_multicall = bytes.fromhex("ac9650d8")  # multicall(bytes[])
        sel_exact_input = bytes.fromhex("048c7e16")  # exactInput((bytes,address,uint256,uint256))
        sel_refund = bytes.fromhex("12210e8a")
        sel_unwrap = bytes.fromhex("2c994c30")  # unwrapWETH9(uint256,address)

        exact_input = sel_exact_input + abi_encode(
            ["bytes", "address", "uint256", "uint256"],
            [bytes.fromhex(path[2:]), recipient if side == "buy" else ROUTER, amount_in, min_out],
        )
        if side == "buy":
            inner = [exact_input, sel_refund]
        else:
            inner = [exact_input, sel_unwrap + abi_encode(["uint256", "address"], [min_out, recipient])]
        data = sel_multicall + abi_encode(["bytes[]"], [inner])
        return {"to": ROUTER, "data": "0x" + data.hex(), "value": amount_in if side == "buy" else 0}

    # ── LLM gateway ──────────────────────────────────────────────────────────
    def models(self) -> dict:
        """24-model list with context windows and USD pricing per 1M tokens."""
        return self._get("/api/chat/models")

    def chat(self, messages: list[dict] | str, model: str = "glm/glm-5.3-flash",
             thinking: bool = False, conversation_id: str | None = None,
             wallet: str | None = None) -> dict:
        """One completion. thinking=True = extended reasoning pass (2x budget)."""
        if isinstance(messages, str):
            messages = [{"role": "user", "content": messages}]
        body: dict[str, Any] = {
            "wallet": wallet or self.wallet, "model": model, "thinking": thinking,
            "messages": messages, "api_key": self.api_key,
        }
        if conversation_id:
            body["conversation_id"] = conversation_id
        return self._post("/api/chat", body)

    def credits(self, wallet: str | None = None) -> dict:
        """Credit balance: granted / used / remaining ($5 free per wallet)."""
        return self._get(f"/api/chat/credits?wallet={wallet or self.wallet}")

    # ── keys ─────────────────────────────────────────────────────────────────
    def create_key(self, name: str = "default", wallet: str | None = None,
                   session_token: str | None = None) -> dict:
        """Mint an API key (clst_...) — raw key shown exactly once."""
        return self._post("/api/keys", {
            "wallet": wallet or self.wallet, "name": name,
            "session_token": session_token or self.session_token,
            "api_key": self.api_key,
        })

    def usage(self, wallet: str | None = None) -> dict:
        """Metered usage per key: requests, tokens, USD."""
        w = wallet or self.wallet
        auth = f"&session_token={self.session_token}" if self.session_token else ""
        return self._get(f"/api/keys/usage?wallet={w}{auth}")

    # ── agents ───────────────────────────────────────────────────────────────
    def agents(self) -> dict:
        """The 16 agent capabilities catalogue."""
        return self._get("/api/agents")

    def run_agent(self, agent_id: str, label: str | None = None, wallet: str | None = None) -> dict:
        """Log an agent interaction to the wallet history (audit trail)."""
        return self._post("/api/runs", {
            "agent_id": agent_id, "wallet": wallet or self.wallet, "label": label,
            "session_token": self.session_token, "api_key": self.api_key,
        })
