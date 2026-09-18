import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeftRight,
  ArrowDown,
  ShieldQuestion,
  Search,
  TrendingUp,
  TrendingDown,
  BookOpen,
  ArrowRight,
  Landmark,
  Check,
  Loader2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import { api, type ApiIndex, type ApiStock } from '@/lib/api'
import { useQuotes } from '@/lib/useQuotes'
import { StockIcon } from '@/components/StockIcon'
import { Sparkline } from '@/components/Sparkline'
import { encodeApprove, encodeBuyTx, encodeSellTx, fetchQuote, fetchTradeStatus, waitForReceipt, explorerTx, type TradeStatus } from '@/lib/swap'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useSendTransaction, useReadContract } from 'wagmi'
import { erc20Abi, ROUTER } from '@/lib/swap'
import { formatUnits, parseUnits } from 'viem'

const EASE = [0.22, 1, 0.36, 1] as const

type Side = 'buy' | 'sell'
type Phase = 'idle' | 'quoting' | 'ready' | 'approving' | 'swapping' | 'success' | 'error'

/**
 * Trade — fully IN-APP. Quotes come from our backend (QuoterV2 proxy),
 * the transaction is built here and signed by the user's wallet, and the
 * receipt is polled manually (wagmi's receipt hook misses 4663). No
 * redirect to an external DEX UI — the swap happens on this page.
 */
export function TradeView({ onDocs, initialSymbol }: { onDocs: () => void; initialSymbol?: string }) {
  const { address, isConnected } = useAppKitAccount()
  const { open } = useAppKit()
  const { sendTransactionAsync } = useSendTransaction()
  const account = (address ?? '') as `0x${string}`

  const [index, setIndex] = useState<ApiIndex | null>(null)
  const [status, setStatus] = useState<TradeStatus | null>(null)
  const [side, setSide] = useState<Side>('buy')
  const [selected, setSelected] = useState<ApiStock | null>(null)
  const [amount, setAmount] = useState('0.01')
  const [q, setQ] = useState('')

  const [phase, setPhase] = useState<Phase>('idle')
  const [quoteOut, setQuoteOut] = useState<string | null>(null)
  const [quotePath, setQuotePath] = useState<`0x${string}` | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [needsApproval, setNeedsApproval] = useState(false)

  useEffect(() => {
    api.getIndex().then(setIndex).catch(() => {})
    fetchTradeStatus().then(setStatus).catch(() => {})
  }, [])

  // pick default symbol once the index loads (or honor initialSymbol from Market)
  useEffect(() => {
    if (!index || selected) return
    const want = initialSymbol ? index.stocks.find((s) => s.symbol === initialSymbol) : null
    setSelected(want ?? index.stocks.find((s) => s.symbol === 'NVDA') ?? index.stocks[0] ?? null)
  }, [index, initialSymbol, selected])

  const top = useMemo(() => (index?.stocks ?? []).slice(0, 20), [index])
  const { quotes } = useQuotes(useMemo(() => top.map((s) => s.symbol), [top]))

  const filtered = useMemo(
    () =>
      (index?.stocks ?? []).filter(
        (s) => s.symbol.toLowerCase().includes(q.toLowerCase()) || s.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [index, q],
  )

  const token = selected?.address as `0x${string}` | undefined
  const decimalsIn = side === 'buy' ? 18 : 18
  const decimalsOut = side === 'buy' ? 18 : 18

  // allowance check (sell side needs approve first)
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: account && token ? [account, ROUTER] : undefined,
    query: { enabled: !!account && !!token && side === 'sell' },
  })

  useEffect(() => {
    if (side !== 'sell' || allowance == null || !amount) {
      setNeedsApproval(false)
      return
    }
    try {
      const amtWei = parseUnits(amount, decimalsIn)
      setNeedsApproval((allowance as bigint) < amtWei)
    } catch {
      setNeedsApproval(false)
    }
  }, [side, allowance, amount, decimalsIn])

  const requestQuote = async () => {
    if (!token || !amount) return
    setPhase('quoting')
    setQuoteError(null)
    setQuoteOut(null)
    setQuotePath(null)
    try {
      const amtWei = parseUnits(amount, decimalsIn)
      const res = await fetchQuote({
        token,
        side,
        amountWei: amtWei.toString(),
        decimalsOut,
      })
      if (!res.ok || !res.path || !res.amountOut) {
        setQuoteError(res.error === 'no route' ? 'No Uniswap pool found for this pair — try another instrument.' : res.error ?? 'Quote failed')
        setPhase('error')
        return
      }
      setQuoteOut(res.amountOut)
      setQuotePath(res.path)
      setPhase('ready')
    } catch (e) {
      setQuoteError((e as Error).message)
      setPhase('error')
    }
  }

  const execute = async () => {
    if (!token || !quotePath || !quoteOut || !account) return
    setTxError(null)
    try {
      const amtWei = parseUnits(amount, decimalsIn)
      const outWei = BigInt(quoteOut)
      // 1% slippage floor — same default as the wallet script.
      const minOut = (outWei * 99n) / 100n

      if (side === 'sell' && needsApproval) {
        setPhase('approving')
        const app = encodeApprove(token)
        const h = await sendTransactionAsync({ to: app.to, data: app.data, value: app.value })
        const r = await waitForReceipt(h as `0x${string}`)
        if (r !== 'success') {
          setTxError('Approval did not confirm. Nothing was swapped.')
          setPhase('error')
          return
        }
        await refetchAllowance()
      }

      setPhase('swapping')
      const tx = side === 'buy' ? encodeBuyTx(quotePath, amtWei, minOut, account) : encodeSellTx(quotePath, amtWei, minOut, account)
      const hash = await sendTransactionAsync({ to: tx.to, data: tx.data, value: tx.value })
      setTxHash(hash as string)
      const r = await waitForReceipt(hash as `0x${string}`)
      if (r === 'success') {
        setPhase('success')
      } else if (r === 'reverted') {
        setTxError('Transaction reverted on-chain. Your funds are unchanged apart from gas.')
        setPhase('error')
      } else {
        setTxError('Timed out waiting for confirmation — check the explorer link.')
        setPhase('error')
      }
    } catch (e) {
      const msg = (e as Error).message || ''
      setTxError(msg.includes('User rejected') ? 'Rejected in wallet.' : msg.slice(0, 220))
      setPhase('error')
    }
  }

  const reset = () => {
    setPhase('idle')
    setQuoteOut(null)
    setQuotePath(null)
    setQuoteError(null)
    setTxError(null)
    setTxHash(null)
  }

  const outHuman = quoteOut ? Number(formatUnits(BigInt(quoteOut), decimalsOut)).toLocaleString(undefined, { maximumFractionDigits: 6 }) : null

  const aixAddress = index?.clst_token_address ?? null
  const aixLive = !!index?.clst_deployed && !!aixAddress

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8 sm:py-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <h1 className="t-display max-w-[620px]">
          Trade
          <span className="block" style={{ color: 'var(--ink-soft)' }}>right here, in the app.</span>
        </h1>
        <p className="t-lead muted mt-4 max-w-[600px]">
          Swap any covered instrument on Robinhood Chain without leaving the page. Quotes come from our own
          routing API; your wallet signs; you keep custody the whole way through.
        </p>
      </motion.div>

      {/* $CLST panel — Cooming soon, auto-activates when the CA lands */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.08 }}
        className="card mt-8 overflow-hidden"
      >
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--line)', background: 'var(--surface-raised)' }}>
          <span className="flex items-center gap-2 text-[13.5px] font-medium">
            <ArrowLeftRight size={15} /> $CLST
          </span>
          <span className="pill pill-sm pill-outline-dark" style={{ height: '1.4rem', padding: '0 0.6rem', fontSize: 10.5 }}>
            {aixLive ? 'LIVE' : 'Cooming soon'}
          </span>
        </div>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldQuestion size={20} style={{ color: 'var(--ink-soft)', marginTop: 2, flexShrink: 0 }} />
            <div>
              <p className="text-[14.5px] font-medium">{aixLive ? 'Token is live' : '$CLST is cooming soon'}</p>
              <p className="t-small muted mt-0.5 max-w-[520px]">
                {aixLive
                  ? 'Holding $CLST is a proportional claim on the payout basket. Swap it right here.'
                  : 'The contract address lands at launch and this panel turns into a live swap — no code change needed. Meanwhile the whole basket below is tradeable in-app.'}
              </p>
            </div>
          </div>
          {aixLive && aixAddress ? (
            <button
              onClick={() => {
                const s = index?.stocks.find((x) => x.address.toLowerCase() === aixAddress.toLowerCase())
                if (s) setSelected(s)
              }}
              className="pill pill-ink pill-sm flex shrink-0 items-center gap-1.5 self-start sm:self-auto"
            >
              Trade $CLST <ArrowRight size={12} />
            </button>
          ) : (
            <button onClick={onDocs} className="pill pill-surface pill-sm flex shrink-0 items-center gap-1.5 self-start sm:self-auto">
              <BookOpen size={13} /> How launch works <ArrowRight size={12} />
            </button>
          )}
        </div>
      </motion.div>

      {/* ---- the swap ticket ---- */}
      <div className="mt-8 grid gap-5 lg:grid-cols-[420px_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.12 }}
          className="card h-fit overflow-hidden"
        >
          <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--line)', background: 'var(--surface-raised)' }}>
            <span className="text-[13.5px] font-medium">Swap</span>
            {status && (
              <span className="t-small muted">
                gas {status.gas_price_gwei?.toFixed(4) ?? '—'} gwei{status.eth_usd ? ` · ETH $${status.eth_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ''}
              </span>
            )}
          </div>

          <div className="p-5">
            {/* side toggle */}
            <div className="flex gap-1.5">
              {(['buy', 'sell'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSide(s)
                    reset()
                  }}
                  className="flex-1 rounded-full py-2 text-[13px] font-medium capitalize transition-colors"
                  style={{
                    background: side === s ? 'var(--ink)' : 'var(--surface)',
                    color: side === s ? '#fff' : 'var(--ink-soft)',
                    boxShadow: side === s ? 'none' : 'inset 0 0 0 1px var(--line)',
                  }}
                >
                  {s === 'buy' ? 'Buy with ETH' : 'Sell for ETH'}
                </button>
              ))}
            </div>

            {/* token picker */}
            <label className="card mt-4 flex items-center gap-2 px-3.5 py-2.5">
              <Search size={14} style={{ color: 'var(--ink-soft)' }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search symbol or company"
                className="w-full bg-transparent text-[13.5px] outline-none"
              />
            </label>
            <div className="mt-2 max-h-[168px] overflow-y-auto rounded-xl" style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }}>
              {(q ? filtered : (index?.stocks ?? []).slice(0, 24)).map((s) => {
                const quote = quotes[s.symbol]
                const isSel = selected?.address === s.address
                return (
                  <button
                    key={s.address}
                    onClick={() => {
                      setSelected(s)
                      setQ('')
                      reset()
                    }}
                    className="flex w-full items-center gap-2.5 border-b px-3 py-2 text-left transition-colors hover:bg-[var(--surface-raised)] last:border-b-0"
                    style={{ borderColor: 'var(--line)', background: isSel ? 'var(--surface-raised)' : undefined }}
                  >
                    <StockIcon symbol={s.symbol} size={22} />
                    <span className="t-mono text-[12.5px] font-medium">{s.symbol}</span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>{s.name}</span>
                    {quote?.price != null && <span className="t-mono text-[11.5px]">${quote.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}
                    {isSel && <Check size={13} style={{ color: 'var(--signal)' }} />}
                  </button>
                )
              })}
            </div>

            {/* amount */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="t-small muted">{side === 'buy' ? 'You pay' : 'You sell'}</span>
                <span className="t-small muted">{side === 'buy' ? 'ETH' : selected?.symbol ?? ''}</span>
              </div>
              <input
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  reset()
                }}
                inputMode="decimal"
                className="t-mono mt-1.5 w-full rounded-xl px-3.5 py-3 text-[16px] outline-none"
                style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--line)' }}
                placeholder="0.0"
              />
            </div>

            <div className="my-3 flex justify-center">
              <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
                <ArrowDown size={13} style={{ color: 'var(--ink-soft)' }} />
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="t-small muted">{side === 'buy' ? 'You receive' : 'You get'}</span>
              <span className="t-small muted">{side === 'buy' ? selected?.symbol ?? '' : 'ETH'}</span>
            </div>
            <div className="t-mono mt-1.5 rounded-xl px-3.5 py-3 text-[16px]" style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
              {phase === 'quoting' ? '…' : outHuman ?? '—'}
            </div>

            {quoteError && (
              <p className="t-small mt-3 flex items-start gap-1.5" style={{ color: 'var(--danger)' }}>
                <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {quoteError}
              </p>
            )}
            {txError && (
              <p className="t-small mt-3 flex items-start gap-1.5" style={{ color: 'var(--danger)' }}>
                <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {txError}
              </p>
            )}
            {phase === 'success' && txHash && (
              <p className="t-small mt-3 flex items-center gap-1.5" style={{ color: 'var(--signal)' }}>
                <Check size={13} /> Swap confirmed.{' '}
                <a href={explorerTx(txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
                  explorer <ExternalLink size={10} />
                </a>
              </p>
            )}

            {/* actions */}
            <div className="mt-4">
              {phase === 'ready' || phase === 'success' || phase === 'swapping' || phase === 'approving' ? (
                !isConnected ? (
                  <button onClick={() => open()} className="pill pill-ink w-full justify-center py-2.5">
                    Connect wallet to trade
                  </button>
                ) : (
                  <button
                    onClick={phase === 'success' ? reset : execute}
                    disabled={phase === 'swapping' || phase === 'approving'}
                    className="pill pill-ink w-full justify-center py-2.5 disabled:opacity-60"
                  >
                    {phase === 'success'
                      ? 'New swap'
                      : phase === 'approving'
                        ? 'Approving…'
                        : phase === 'swapping'
                          ? 'Swapping…'
                          : needsApproval && side === 'sell'
                            ? 'Approve & sell'
                            : side === 'buy'
                              ? `Buy ${selected?.symbol ?? ''}`
                              : `Sell ${selected?.symbol ?? ''}`}
                  </button>
                )
              ) : (
                <button
                  onClick={requestQuote}
                  disabled={!selected || !amount || phase === 'quoting'}
                  className="pill pill-ink w-full justify-center py-2.5 disabled:opacity-60"
                >
                  {phase === 'quoting' ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Getting quote…
                    </span>
                  ) : (
                    'Get quote'
                  )}
                </button>
              )}
            </div>
            {(phase === 'approving' || phase === 'swapping') && (
              <p className="t-small muted mt-2 flex items-center justify-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                {phase === 'approving' ? 'Confirm approval in your wallet…' : 'Confirm swap in your wallet…'}
              </p>
            )}

            <p className="t-small muted mt-4">
              Router {ROUTER.slice(0, 6)}…{ROUTER.slice(-4)} · Uniswap v3 · Robinhood Chain. First sell of a token needs
              a one-time approval. 1% slippage floor.
            </p>
          </div>
        </motion.div>

        {/* basket grid */}
        <div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[19px] font-medium">The basket</h2>
              <p className="t-small muted mt-1">Live quotes + one-click in-app trade. Every address verifiable on-chain.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {top.map((s, i) => {
              const quote = quotes[s.symbol]
              const up = (quote?.change_pct ?? 0) >= 0
              return (
                <motion.div
                  key={s.address}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: EASE, delay: Math.min(i * 0.03, 0.3) }}
                  className="card flex flex-col p-4"
                >
                  <div className="flex items-center gap-2.5">
                    <StockIcon symbol={s.symbol} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="t-mono text-[13px] font-medium">{s.symbol}</p>
                      <p className="truncate text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>{s.name}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="t-mono text-[16px] font-medium">
                      {quote?.price != null ? `$${quote.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </span>
                    {quote?.change_pct != null && (
                      <span className={`t-mono flex items-center gap-0.5 text-[12px] ${up ? 'delta-up' : 'delta-down'}`}>
                        {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {up ? '+' : ''}{quote.change_pct}%
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5">
                    <Sparkline series={quote?.series} up={up} width={120} height={30} />
                  </div>
                  <button
                    onClick={() => {
                      setSelected(s)
                      reset()
                    }}
                    className="mt-3 flex items-center justify-center gap-1.5 rounded-full border py-1.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-raised)]"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    Trade {s.symbol}
                  </button>
                </motion.div>
              )
            })}
          </div>

          <p className="t-small muted mt-6 flex items-start gap-2">
            <Landmark size={13} className="mt-0.5 shrink-0" />
            Quotes refresh every 60 seconds from the index API. Swaps route through Uniswap v3 on Robinhood Chain —
            your wallet, your keys, no custody. These are "Robinhood Token" tokenized instruments, not direct equity
            shares. Only the curated 19-stock basket pays distributions; the full universe is here for trading.
          </p>
        </div>
      </div>
    </div>
  )
}
