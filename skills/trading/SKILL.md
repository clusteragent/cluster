---
name: trading
description: Trade tokenized stocks and crypto on Robinhood Chain (4663) through the cluster API. Use when the user wants live quotes for tokenized stocks (NVDA, SPY, TSLA, 192 instruments) or crypto (PONS, WETH, USDG, CLIPPY, KARMA), gainers/losers and sector heat, swap quotes and execution, on-chain wallet balances, chart data, or gas and route status. Covers the full swap lifecycle — quote, route selection, calldata building, signing in the user's own wallet, and receipt parsing to prove what actually arrived.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm:*), Bash(npx:*), Bash(curl:*), Bash(python:*)
license: MIT
metadata:
  author: clusteragent
  version: "1.0.0"
---

# Trading on Robinhood Chain

Tokenized stocks (192 instruments — NVDA is the deepest pool) and native crypto,
quoted through the cluster API and executed **non-custodially**: the API quotes and
builds calldata, the user's wallet signs and broadcasts. Cluster never touches a
private key.

## Chain Reference

| Contract | Address |
|----------|---------|
| Chain | Robinhood Chain, id **4663** |
| SwapRouter02 | `0xcaf681a66d020601342297493863e78c959e5cb2` |
| QuoterV2 | `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| Explorer | https://robinhoodchain.blockscout.com |

Fee tiers in use: **100 / 500 / 3000 / 10000** (0.01% / 0.05% / 0.3% / 1%).

## Known Crypto Tokens

Verified addresses (from the cluster registry — on-chain checked):

```
PONS        0x39dBED3a2bd333467115dE45665cC57F813C4571   (pool 0x10cc…26ba, WETH/500 → USDG/3000)
WETH        0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
USDG        0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
CLIPPY      0x85856f025bf13b8fd2aae2f6da458318744f1e18
KARMA       0xb47f4702deb124cb4eb6286be83c9d84277c6239
FINCH       0x879f29204a5ff842c66f0f65e0f2e422073acce7   (launchpad factory — see note)
SWOGE       0xdb87393727b666c43f5aecb03d8b419ba54d9b03   (launchpad factory — see note)
RHAGENT     0x894fac757250f8e02180e1856957274d84ac4ba3   (launchpad factory — see note)
```

> **Factory caveat** — tokens marked *launchpad factory* have pools on a separate
> Uniswap V3 factory. SwapRouter02 (canonical factory) cannot route them: QuoterV2
> reverts. For those, either use the pons launchpad UI or the V4 Universal Router
> (`0x8876789976decbfcbbbe364623c63652db8c0904`) with Permit2. Always quote first —
> a `no route` response means the pool is not on the canonical factory.

## Step 1 — Quote

```bash
curl "https://clusteragent.dev/api/trade/quote?token=0xNVDA&side=buy&amount=10000000000000000&via=WETH"
```

```json
{ "ok": true, "path": "0x0bd7…300001f4d060…", "label": "WETH/500",
  "amountOut": "111528000000000000", "decimals": 18, "side": "buy" }
```

- `amount` is **wei of the input token** (buy: ETH; sell: the token)
- Route candidates are tried in order: hopped WETH→USDG→token, then direct
  WETH→token across fee tiers. First pool with a quote wins.
- Route labels decode as `WETH/500` = WETH→token through the 0.05% pool.

## Step 2 — Build Calldata

**Buy (ETH in, token out)** — router pays the first WETH hop from `msg.value`.
Do NOT wrap first (reverts with STF):

```
multicall([
  exactInput({ path, recipient: user, amountIn, amountOutMinimum }),
  refundETH()
])  →  to: ROUTER, value: amountIn
```

**Sell (token in, ETH out)** — two transactions:

1. `approve(ROUTER, amount)` on the token (check `allowance` first — if it already
   covers `amount`, skip)
2. `multicall([ exactInput({ path, recipient: ROUTER, amountIn, amountOutMinimum }),
   unwrapWETH9(minOut, user) ])` → value 0

`amountOutMinimum = quote × (10000 − slippageBps) / 10000`. Cluster default: 2%
(200 bps) — equity and thin-crypto pools move.

## Step 3 — Sign & Broadcast (user's wallet)

wagmi:

```ts
const hash = await sendTransactionAsync({ to: ROUTER, data, value, chainId: 4663 })
```

ethers:

```ts
const tx = await signer.sendTransaction({ to: ROUTER, data, value })
```

## Step 4 — Receipt Proof (a quote is a prediction; a receipt is proof)

Poll `eth_getTransactionReceipt` every ~4s until present. Then verify what
**actually** arrived:

- **Buy** — sum `Transfer(from, user, value)` logs emitted by the bought token
  (topic0 = `0xddf252ad…b3ef`, topic2 = user address). Report the sum.
- **Sell** — ETH balance delta = `balanceAfter − balanceBefore + gasBurned`.

Report "actually received" next to the quoted amount. If they diverge materially,
the route moved — that is the user's real fill.

## Market Data

```bash
curl "https://clusteragent.dev/api/market/quotes?symbols=NVDA,SPY,PONS"   # batch + daily closes
curl "https://clusteragent.dev/api/market/movers?limit=10"                 # gainers/losers/sectors
curl "https://clusteragent.dev/api/market/chart/NVDA?tf=1mo"               # series + candles
curl "https://clusteragent.dev/api/trade/status"                           # gas, ETH price, router
curl "https://clusteragent.dev/api/trade/wallet/0xADDRESS"                 # on-chain balances
```

## Safety Rules

1. **Always quote first.** Never build a swap from a stale or assumed price.
2. **Never exceed the user's stated amount.** `MAX` means the wallet's full ETH
   balance minus gas headroom, confirmed with the user.
3. **Default slippage 2%.** Raise only with the user's explicit ask; the pool may
   revert at `amountOutMinimum`.
4. **Show the route.** Users see `WETH/500 → USDG/3000` style labels before signing.
5. **Sell requires approval.** Check `allowance(user, ROUTER) ≥ amount` before
   building the swap tx; if not, the approval tx comes first, separately.
6. **`no route` is an answer.** It means the pool is on the launchpad factory — do
   not retry forever, tell the user.
