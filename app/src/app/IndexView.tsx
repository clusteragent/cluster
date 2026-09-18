import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, ShieldQuestion, ExternalLink, ArrowLeftRight, Search } from 'lucide-react'
import { api, type ApiIndex } from '@/lib/api'
import { useQuotes } from '@/lib/useQuotes'
import { StockIcon } from '@/components/StockIcon'

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * What $CLST represents: the basket of tokenized-stock instruments on
 * Robinhood Chain. $CLST itself is not deployed yet — this view is
 * honest about that (no fabricated balances, no fake "your share").
 * Once AGENTINDEX_CLST_TOKEN_ADDRESS is set server-side, the banner
 * and trade links activate automatically — zero code change needed.
 */
export function IndexView({ onTrade }: { onTrade: () => void }) {
  const [data, setData] = useState<ApiIndex | null>(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    api
      .getIndex()
      .then(setData)
      .catch(() => setError(true))
  }, [])

  const filtered = data?.stocks.filter(
    (s) => s.symbol.toLowerCase().includes(q.toLowerCase()) || s.name.toLowerCase().includes(q.toLowerCase()),
  )

  // live quotes for the first 20 symbols (shown inline in the table)
  const quoteSymbols = (data?.stocks ?? []).slice(0, 20).map((s) => s.symbol)
  const { quotes } = useQuotes(quoteSymbols)

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8 sm:py-10">
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="t-display max-w-[620px]"
      >
        What $CLST represents.
      </motion.h1>
      <p className="t-lead muted mt-4 max-w-[600px]">
        Hold $CLST, hold a proportional slice of this basket — tokenized equities and ETFs on Robinhood Chain.
      </p>

      {/* cooming-soon banner — honest, not softened */}
      <div className="card mt-8 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--line-bright)' }}>
        <div className="flex items-start gap-3">
          <ShieldQuestion size={20} style={{ color: 'var(--ink-soft)', marginTop: 2, flexShrink: 0 }} />
          <div>
            <p className="text-[14.5px] font-medium">$CLST is cooming soon</p>
            <p className="t-small muted mt-0.5">
              Nothing here is a live balance or price — it's the composition the index will track at launch.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 self-start sm:self-auto">
          <span className="pill pill-sm pill-outline-dark">Cooming soon</span>
          <button onClick={onTrade} className="pill pill-sm pill-surface flex items-center gap-1.5">
            <ArrowLeftRight size={13} /> Trade the basket
          </button>
        </div>
      </div>

      {error && <p className="t-small mt-6" style={{ color: 'var(--danger)' }}>Could not reach the index API. Is the backend running?</p>}

      {data && (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <p className="tile-figure text-[28px]">{data.stock_count}</p>
              <p className="t-small muted">instruments in the basket</p>
            </div>
            <div>
              <p className="tile-figure text-[28px]" style={{ color: 'var(--signal)' }}>{data.verified_on_chain_count}</p>
              <p className="t-small muted">confirmed live on-chain via RPC</p>
            </div>
            <div>
              <p className="tile-figure text-[28px]">{data.chain}</p>
              <p className="t-small muted">chain ID {data.chain_id}</p>
            </div>
          </div>

          <label className="card mt-8 flex w-full max-w-sm items-center gap-2 px-4 py-2.5">
            <Search size={15} style={{ color: 'var(--ink-soft)' }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a symbol or company"
              className="w-full bg-transparent text-[14px] outline-none"
            />
          </label>

          <div className="card mt-4 overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_2fr_auto_auto] gap-3 border-b px-4 py-2.5 text-[12px] font-medium" style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>
              <span />
              <span>Symbol</span>
              <span>Name</span>
              <span className="text-right">Quote</span>
              <span className="text-right">On-chain</span>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {filtered?.map((s) => {
                const quote = quotes[s.symbol]
                const up = (quote?.change_pct ?? 0) >= 0
                return (
                  <div
                    key={s.address}
                    className="grid grid-cols-[auto_1fr_2fr_auto_auto] items-center gap-3 border-b px-4 py-2.5 text-[13.5px] last:border-b-0"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <StockIcon symbol={s.symbol} size={24} />
                    <span className="t-mono font-medium">{s.symbol}</span>
                    <span className="truncate muted">{s.name}</span>
                    <span className="t-mono text-right text-[12.5px]">
                      {quote?.price != null ? (
                        <>
                          ${quote.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                          <span className={up ? 'delta-up' : 'delta-down'}>
                            {up ? '+' : ''}{quote.change_pct}%
                          </span>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </span>
                    <a
                      href={`https://explorer.mainnet.chain.robinhood.com/address/${s.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-end gap-1"
                      style={{ color: s.verified ? 'var(--signal)' : 'var(--ink-soft)' }}
                      title={s.verified ? 'symbol()/totalSupply() confirmed via RPC' : 'not yet independently confirmed on-chain'}
                    >
                      {s.verified ? <ShieldCheck size={15} /> : <ShieldQuestion size={15} />}
                      <ExternalLink size={12} className="opacity-50" />
                    </a>
                  </div>
                )
              })}
              {filtered?.length === 0 && <p className="t-small muted px-4 py-6 text-center">No match for "{q}"</p>}
            </div>
          </div>

          <p className="t-small muted mt-4 max-w-[640px]">
            These are "Robinhood Token" tokenized instruments, not direct equity shares. {data.verified_on_chain_count} of {data.stock_count} addresses were independently re-checked against Robinhood Chain RPC (symbol + non-zero supply); the rest are sourced from a third-party catalogue and shown as unverified.
          </p>
        </>
      )}
    </div>
  )
}
