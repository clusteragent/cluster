/**
 * In-app Uniswap v3 trading on Robinhood Chain (4663).
 *
 * The quote comes from our own backend (/api/trade/quote) because the
 * browser can't always eth_call the public Robinhood RPC (cross-origin
 * 403 — same finding as Chronoa). The TRANSACTION is built here and
 * signed in the user's wallet — this app never touches a private key.
 *
 * Execution patterns (verified on-chain, same as Chronoa + Kumo):
 *   buy   ETH -> token : multicall([exactInput, refundETH]) with msg.value
 *   sell  token -> ETH : multicall([exactInput(recipient=ROUTER), unwrapWETH9])
 *                        requires approve(ROUTER, max) first — separate tx
 * The router pays the first WETH hop from msg.value; a separate wrapETH
 * first reverts with STF.
 */
import { encodeFunctionData, type Hex } from 'viem'

export const WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' as const
export const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' as const
export const ROUTER = '0xcaf681a66d020601342297493863e78c959e5cb2' as const
export const QUOTERV2 = '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7' as const
export const CHAIN_ID = 4663
export const EXPLORER = 'https://robinhoodchain.blockscout.com'

const ROUTER_ABI = [
  {
    name: 'exactInput',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'path', type: 'bytes' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'multicall',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'data', type: 'bytes[]' }],
    outputs: [{ name: 'results', type: 'bytes[]' }],
  },
  {
    name: 'refundETH',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'unwrapWETH9',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountMinimum', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [],
  },
] as const

export const erc20Abi = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export interface SwapQuote {
  ok: boolean
  path?: `0x${string}`
  label?: string
  amountOut?: string
  decimals?: number
  error?: string
}

export interface TradeStatus {
  chain_id: number
  router: string
  quoter: string
  weth: string
  usdg: string
  rpc_ok: boolean
  block: number | null
  gas_price_gwei: number | null
  eth_usd: number | null
}

/** Server-side quote (browser CORS workaround). Returns {ok:false} on no route. */
export async function fetchQuote(params: {
  token: string
  side: 'buy' | 'sell'
  amountWei: string
  via?: 'USDG' | 'WETH'
  decimalsOut: number
}): Promise<SwapQuote> {
  const qs = new URLSearchParams({
    token: params.token,
    side: params.side,
    amount: params.amountWei,
    via: params.via ?? 'USDG',
    dec: String(params.decimalsOut),
  })
  const r = await fetch(`/api/trade/quote?${qs}`)
  if (!r.ok) throw new Error(`quote failed: ${r.status}`)
  return r.json()
}

export async function fetchTradeStatus(): Promise<TradeStatus> {
  const r = await fetch('/api/trade/status')
  if (!r.ok) throw new Error(`status failed: ${r.status}`)
  return r.json()
}

/** Build the buy tx: ETH in, token out. value = amountInWei. */
export function encodeBuyTx(
  path: `0x${string}`,
  amountInWei: bigint,
  minOut: bigint,
  account: `0x${string}`,
): { to: `0x${string}`; data: Hex; value: bigint } {
  const swap = encodeFunctionData({
    abi: ROUTER_ABI,
    functionName: 'exactInput',
    args: [{ path, recipient: account, amountIn: amountInWei, amountOutMinimum: minOut }],
  })
  const refund = encodeFunctionData({ abi: ROUTER_ABI, functionName: 'refundETH' })
  const data = encodeFunctionData({ abi: ROUTER_ABI, functionName: 'multicall', args: [[swap, refund]] })
  return { to: ROUTER, data, value: amountInWei }
}

/** Build the sell tx: token in, ETH out (unwrapWETH9 straight to wallet). */
export function encodeSellTx(
  path: `0x${string}`,
  amountIn: bigint,
  minOut: bigint,
  account: `0x${string}`,
): { to: `0x${string}`; data: Hex; value: bigint } {
  const swap = encodeFunctionData({
    abi: ROUTER_ABI,
    functionName: 'exactInput',
    args: [{ path, recipient: ROUTER, amountIn, amountOutMinimum: minOut }],
  })
  const unwrap = encodeFunctionData({
    abi: ROUTER_ABI,
    functionName: 'unwrapWETH9',
    args: [minOut, account],
  })
  const data = encodeFunctionData({ abi: ROUTER_ABI, functionName: 'multicall', args: [[swap, unwrap]] })
  return { to: ROUTER, data, value: 0n }
}

/** Infinite approval for the router — the standard Uniswap pattern. */
export function encodeApprove(token: `0x${string}`): { to: `0x${string}`; data: Hex; value: bigint } {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [ROUTER, 2n ** 256n - 1n],
  })
  return { to: token, data, value: 0n }
}

/**
 * Poll for a tx receipt manually. wagmi's useWaitForTransactionReceipt
 * misses receipts on 4663 (documented in dex-pair-chart-embeds
 * reference) — manual polling is the reliable path.
 */
export interface SwapReceipt {
  status: 'success' | 'reverted' | 'timeout'
  gasUsed?: string
  /** Actual amount received, parsed from Transfer logs (buys) or ETH delta (sells). */
  received?: string
}

const KECCAK_TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

/**
 * A quote is a prediction; a receipt is proof. Parse what ACTUALLY arrived:
 * buys — sum Transfer(_, me, value) logs emitted by the bought token;
 * sells — native ETH balance delta + gas refunded into the math.
 * (Pattern: finchagentic confirmRhSwap.)
 */
export async function waitForReceipt(
  hash: `0x${string}`,
  timeoutMs = 180_000,
  ctx?: { wallet: string; token?: string | null; decimals?: number; side?: 'buy' | 'sell'; ethBefore?: bigint },
): Promise<SwapReceipt> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch('https://rpc.mainnet.chain.robinhood.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getTransactionReceipt',
          params: [hash],
        }),
      })
      const j = await r.json()
      if (j.result) {
        const receipt = j.result
        const base: SwapReceipt = {
          status: receipt.status === '0x1' ? 'success' : 'reverted',
          gasUsed: typeof receipt.gasUsed === 'string' ? BigInt(receipt.gasUsed).toString() : undefined,
        }
        if (base.status !== 'success' || !ctx) return base

        if (ctx.side === 'buy' && ctx.token) {
          const me = ctx.wallet.toLowerCase()
          let total = 0n
          for (const log of receipt.logs ?? []) {
            if ((log.address ?? '').toLowerCase() !== ctx.token.toLowerCase()) continue
            if ((log.topics?.[0] ?? '').toLowerCase() !== KECCAK_TRANSFER) continue
            const dest = '0x' + (log.topics[2] ?? '').slice(-40)
            if (dest.toLowerCase() !== me) continue
            try { total += BigInt(log.data) } catch { /* skip malformed */ }
          }
          if (total > 0n) base.received = formatUnits(total, ctx.decimals ?? 18)
        } else if (ctx.side === 'sell') {
          // ETH delta = balanceAfter - balanceBefore + gas burned
          try {
            const balRes = await fetch('https://rpc.mainnet.chain.robinhood.com', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [ctx.wallet, 'latest'] }),
            })
            const bj = await balRes.json()
            const gas = BigInt(receipt.gasUsed ?? 0n) * BigInt(receipt.effectiveGasPrice ?? 0n)
            // balanceAfter already includes the sale proceeds minus gas — report it minus gas
            // relative to what the wallet had BEFORE the swap isn't tracked here; the caller
            // supplies ethBefore via ctx when it wants exact delta. Without it, report raw.
            if (ctx.ethBefore != null) {
              const delta = BigInt(bj.result) - BigInt(ctx.ethBefore) + gas
              if (delta > 0n) base.received = formatUnits(delta, 18)
            }
          } catch { /* optional */ }
        }
        return base
      }
    } catch {
      // transient — keep polling
    }
    await new Promise((res) => setTimeout(res, 4000))
  }
  return { status: 'timeout' }
}

export const explorerTx = (hash: string) => `${EXPLORER}/tx/${hash}`
