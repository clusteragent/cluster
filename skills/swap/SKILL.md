---
name: swap
description: Dedicated swap execution skill for Robinhood Chain (4663). Use when the user says "swap", "buy", "sell", "trade PONS/NVDA/any token", "exchange ETH for", "DCA into", "take profit", "stop loss", or wants order automation (DCA plans, bracket orders). Covers the full non-custodial lifecycle — token safety scan, quote, route decoding, allowance management, calldata building, signing in the user's wallet, receipt proof — plus DCA and TP/SL order patterns and the safety engine.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm:*), Bash(npx:*), Bash(curl:*), Bash(python:*)
license: MIT
metadata:
  author: clusteragent
  version: "1.1.0"
---

# Swap — Robinhood Chain

Non-custodial swaps on chain 4663: the cluster API quotes and builds calldata,
**the user's wallet signs**. No private keys ever touch the server.

## Decision Flow

```
user wants to swap
  ├── token known? ──no──▶ resolve: quotes / DexScreener search / ask user for CA
  ├── safety check (token_safety tool) ──▶ HIGH RISK? warn + confirm before proceeding
  ├── quote (quote_swap tool) ──▶ "no route"? see Factory Caveat
  ├── show: route, min received @slippage, price impact
  ├── allowance check (sell only) ──▶ insufficient? approval tx FIRST, separately
  ├── build calldata (below) ──▶ user signs ──▶ broadcast
  └── receipt proof ──▶ report ACTUAL received, not the quote
```

## Chain Constants

| Contract | Address |
|----------|---------|
| SwapRouter02 | `0xcaf681a66d020601342297493863e78c959e5cb2` |
| QuoterV2 | `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| V4 Universal Router | `0x8876789976decbfcbbbe364623c63652db8c0904` |

Fee tiers: **100 / 500 / 3000 / 10000**.

## Token Safety Scan (always first for unknown tokens)

Use the `token_safety` MCP tool (or replicate):

```bash
curl "https://api.dexscreener.com/latest/dex/tokens/0xTOKEN"   # liq + txn flow
```

Scoring heuristics (from finchagentic's risk engine):

| Signal | Score | Flag |
|---|---|---|
| Liquidity < $1k | +30 | 🔴 Very low liquidity |
| Liquidity < $25k | +12 | 🟠 Thin liquidity |
| buys > 10 AND sells == 0 (24h) | +40 | 🔴 Honeypot heuristic |
| Contract unverified (explorer) | +20 | 🔴 Not verified |
| Holder count < 25 | +25 | 🔴 Concentration / rug risk |
| Contract name has mint/blacklist/tax/pausable | +14 | 🟠 Owner privileges |

Tier: `score ≥ 40` = HIGH RISK, `≥ 15` = CAUTION, else OK. **HIGH RISK = ask the
user to explicitly confirm before quoting.** Not an audit — heuristic only.

## Factory Caveat (critical on 4663)

Two V3 factories live on this chain:

- **Canonical** — pools routable by SwapRouter02. Quotes work. ✔
- **Pons launchpad factory** (`0x1f7d7550b1b028f7571e69a784071f0205fd2efa`) — most
  pons-ecosystem tokens (SWOGE, FINCH, RHAGENT, NOXA, PONSTR, ARENA, …). QuoterV2
  reverts; SwapRouter02 **cannot** route these.

If `quote_swap` returns `"no route"`: check `factory()` on the token's DexScreener
pool. Launchpad-factory tokens need the **V4 Universal Router + Permit2** (or the
pons launchpad UI). Do not retry forever.

## Quote → Calldata

```bash
# buy: 0.01 ETH → token (amount in wei)
curl "https://HOST/api/trade/quote?token=0xTOKEN&side=buy&amount=10000000000000000"
# → { "ok": true, "path": "0x…", "label": "WETH/500/USDG/3000", "amountOut": "…" }
```

**Buy** (ETH in — router pays the first WETH hop from msg.value; wrapping first
reverts with STF):

```
multicall([ exactInput({ path, recipient: USER, amountIn, amountOutMinimum }),
            refundETH() ])
→ { to: ROUTER, value: amountIn }
```

**Sell** (token in → ETH out): approval first if `allowance(USER, ROUTER) < amount`,
then:

```
multicall([ exactInput({ path, recipient: ROUTER, amountIn, amountOutMinimum }),
            unwrapWETH9(minOut, USER) ])
→ { to: ROUTER, value: 0 }
```

`amountOutMinimum = quote × (10000 − bps) / 10000`. Default slippage **200 bps**;
thin crypto pools need more. Python one-liner: `c.build_swap_calldata(...)` in the
`cluster-agent` SDK.

## Receipt Proof

A quote is a prediction; the receipt is proof. After broadcast:

1. Poll `eth_getTransactionReceipt` (~4s interval, 3min timeout)
2. `status == 0x1`? else report revert — usually slippage
3. **Buy**: sum `Transfer(_, user, value)` logs from the bought token
   (topic0 `0xddf252ad…b3ef`, topic2 = user). That sum = actually received.
4. **Sell**: `balanceAfter − balanceBefore + gasBurned` = actually received.
5. Report **both** quote and actual. Divergence = real fill information.

## DCA & Bracket Orders (automation pattern)

Cluster's MCP has no order engine yet — automate it yourself from the skill, or
run a scheduler. The proven shape (finchagentic rh-orders):

**DCA plan**: buy a fixed ETH amount every N hours, hard cap on total ETH spent.

```python
# every tick: if due and total_spent < cap → quote_swap → build → (dry-run | sign)
```

**Bracket (TP/SL)**: on a token you HOLD — watch DexScreener price; take-profit
above entry, stop-loss below; sell `pct_of_balance` on trigger (default 100%).

**Tick loop** rules (learned the hard way):

- Quote fresh at execution time — never reuse a stored quote
- Dry-run by default; real broadcast only behind an explicit confirm flag
- Nonce: `eth_getTransactionCount(addr, "pending")` so sequential swaps don't collide
- Persist orders to disk; survive restarts; cancel = stop future ticks only

## Safety Rules

1. Safety scan before quoting unknown tokens; HIGH RISK needs explicit user confirm
2. Never exceed the user's stated amount; MAX = balance minus gas, confirmed
3. Show route + min received + price impact BEFORE signing
4. Sell: check allowance first; approval is its own transaction
5. `no route` = factory mismatch — report it, don't hammer
6. Report actual received from the receipt, every time
