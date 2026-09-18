import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Receipt, Landmark, HandCoins, ShieldCheck, ExternalLink, RefreshCw, BookOpen, ArrowRight } from 'lucide-react'
import { api, type ApiDistributions, type ApiPayoutBasket } from '@/lib/api'
import { StockIcon } from '@/components/StockIcon'

const EASE = [0.22, 1, 0.36, 1] as const

const STEPS = [
  {
    icon: <Receipt size={19} strokeWidth={1.8} />,
    t: 'Fees settle',
    d: 'Every agent capability prices its work — per swap, per report, per query. Fees land in the index vault.',
  },
  {
    icon: <Landmark size={19} strokeWidth={1.8} />,
    t: 'The vault buys the basket',
    d: 'Pooled fees buy the whole basket of tokenized stocks — every instrument, not a rotation.',
  },
  {
    icon: <HandCoins size={19} strokeWidth={1.8} />,
    t: 'Holders are paid pro rata',
    d: 'Each cycle pushes every holder their slice, sized by balance. No claim screen, no timer, no lockup.',
  },
]

const ago = (t: number) => {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/**
 * Distribution — the public record of every cycle that paid holders.
 * Reads the keeper bot's published feed via /api/distributions. Until
 * $CLST launches there are no cycles, and the view says exactly that
 * (no placeholder rows, no invented numbers).
 */
export function DistributionView({ onDocs }: { onDocs: () => void }) {
  const [data, setData] = useState<ApiDistributions | null>(null)
  const [basket, setBasket] = useState<ApiPayoutBasket | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    setRefreshing(true)
    try {
      const d = await api.getDistributions()
      setData(d)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'feed unavailable')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
    api.getPayoutBasket().then(setBasket).catch(() => {})
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const live = !!data?.live
  const cycles = data?.cycles ?? []
  const payroll = (data?.payroll ?? []) as { wallet: string; amount?: number; usd?: number }[]
  const buys = (data?.recent_buys ?? []) as { symbol?: string; amount?: number; usd?: number }[]
  const recent = (data?.recent ?? []) as { wallet?: string; address?: string; usd?: number; amount?: number }[]
  const [tab, setTab] = useState<'payouts' | 'leaderboard' | 'buys'>('payouts')
  const feedRows: Record<string, unknown>[] = tab === 'payouts' ? recent : tab === 'leaderboard' ? payroll : buys

  return (
    <div className="mx-auto w-full max-w-[980px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <h1 className="t-display max-w-[560px]">
            Distribution
            <span className="block" style={{ color: 'var(--ink-soft)' }}>Every cycle, on-chain.</span>
          </h1>
          <p className="t-lead muted mt-4 max-w-[540px]">
            Fees from agent work buy the basket and stream back to $CLST holders — pro rata, automatically.
            Each cycle is one batched payout. This table is the public record.
          </p>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
          onClick={load}
          whileTap={{ scale: 0.96 }}
          className="pill pill-surface pill-sm flex items-center gap-1.5"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </motion.button>
      </div>

      {/* status + totals */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.12 }}
        className="card mt-8 overflow-hidden"
      >
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--line)', background: 'var(--surface-raised)' }}>
          <span className="flex items-center gap-2 text-[13.5px] font-medium">
            {live ? <span className="live-dot" /> : <ShieldCheck size={14} style={{ color: 'var(--ink-soft)' }} />}
            {live ? 'Feed live' : 'Cooming soon'}
          </span>
          <span className="t-mono text-[11px]" style={{ color: 'var(--ink-soft)' }}>
            {data?.updated_at ? `UPDATED ${new Date(data.updated_at).toISOString().slice(0, 16).replace('T', ' ')}Z` : 'ROBINHOOD CHAIN · 4663'}
          </span>
        </div>
        <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'var(--line)' }}>
          {[
            { v: data?.totals.cycles ?? 0, l: 'cycles paid' },
            { v: `$${(data?.totals.distributed_usd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, l: 'distributed' },
            { v: (data?.totals.recipients ?? 0).toLocaleString(), l: 'recipients' },
          ].map((s) => (
            <div key={s.l} className="px-5 py-4" style={{ borderColor: 'var(--line)' }}>
              <p className="tile-figure text-[26px]">{s.v}</p>
              <p className="t-small muted">{s.l}</p>
            </div>
          ))}
        </div>
        {!live && data?.detail && (
          <p className="border-t px-5 py-3.5 t-small muted" style={{ borderColor: 'var(--line)' }}>
            {data.detail}
          </p>
        )}
      </motion.div>

      {error && <p className="t-small mt-4" style={{ color: 'var(--danger)' }}>{error}</p>}

      {/* how a cycle works */}
      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.t}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.15 + i * 0.07 }}
            className="card h-full p-5"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: 'var(--surface-raised)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
                {s.icon}
              </span>
              <span className="t-mono text-[12px]" style={{ color: 'var(--signal)' }}>0{i + 1}</span>
            </div>
            <p className="mt-4 text-[15.5px] font-medium">{s.t}</p>
            <p className="t-small muted mt-1.5">{s.d}</p>
          </motion.div>
        ))}
      </div>

      {/* realtime feed: payouts / leaderboard / basket buys */}
      <div className="card mt-8 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
          <span className="text-[13.5px] font-semibold">Realtime feed</span>
          <div className="flex items-center gap-1.5">
            {(['payouts', 'leaderboard', 'buys'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className="inline-flex items-center rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-all"
                style={tab === t
                  ? { background: 'var(--accent)', color: 'var(--field)', borderColor: 'transparent' }
                  : { background: 'var(--field)', color: 'var(--ink-soft)', borderColor: 'var(--line)' }}>
                {t === 'payouts' ? 'Payouts' : t === 'leaderboard' ? 'Leaderboard' : 'Basket buys'}
              </button>
            ))}
          </div>
        </div>
        <div className="p-5">
          {feedRows.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center" style={{ borderColor: 'var(--line)' }}>
              <p className="t-small muted">
                {tab === 'leaderboard'
                  ? 'No $CLST holders yet — the leaderboard fills in from the first cycle, ranked by payout. Hold $CLST once it launches and you are on it.'
                  : tab === 'buys'
                  ? 'No basket buys yet — every keeper bot purchase lands here with its tx, realtime.'
                  : 'Cooming soon — nothing settles until $CLST launches. Every payout lands here per address, the moment the first cycle runs.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {feedRows.slice(0, 12).map((r, i) => {
                const addr = String((r as { wallet?: string; address?: string }).wallet ?? (r as { address?: string }).address ?? '—')
                const rank = tab === 'leaderboard' ? ((i + 1) / Math.max(feedRows.length, 1)) * 100 : null
                return (
                  <div key={i} className="flex items-center gap-3 py-2.5" style={{ borderBottom: i < Math.min(feedRows.length, 12) - 1 ? '1px solid var(--line)' : undefined }}>
                    {tab === 'leaderboard' && <span className="t-mono w-7 shrink-0 text-[12px]" style={{ color: 'var(--ink-dim)' }}>#{i + 1}</span>}
                    {tab === 'buys' && (r as { symbol?: string }).symbol
                      ? <span className="t-mono w-14 shrink-0 text-[12.5px] font-semibold">{String((r as { symbol?: string }).symbol)}</span>
                      : <span className="t-mono min-w-0 flex-1 truncate text-[12.5px]" style={{ color: 'var(--ink-soft)' }}>{addr.slice(0, 8)}…{addr.slice(-6)}</span>}
                    {tab === 'buys'
                      ? <span className="min-w-0 flex-1 text-right text-[12px]" style={{ color: 'var(--ink-soft)' }}>{(r as { amount?: number }).amount != null ? `${(r as { amount?: number }).amount} shares` : ''}</span>
                      : rank != null
                      ? <span className="min-w-0 flex-1" style={{ height: 4, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
                          <span style={{ display: 'block', height: '100%', width: `${rank}%`, background: 'linear-gradient(90deg, #8caaff, #ffb45a)' }} />
                        </span>
                      : <span className="flex-1" />}
                    <span className="t-mono w-20 shrink-0 text-right text-[12.5px] font-semibold" style={{ fontVariantNumeric: 'tabular-nums', color: tab === 'buys' ? 'var(--ink)' : 'var(--signal)' }}>
                      {(r as { usd?: number }).usd != null ? `$${(r as { usd?: number }).usd?.toFixed(2)}` : (r as { amount?: number }).amount != null ? `${(r as { amount?: number }).amount}` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* cycles table */}
      <div className="card mt-8 overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
          <span className="text-[13.5px] font-medium">Cycle history</span>
          <span className="t-mono text-[11px]" style={{ color: 'var(--ink-soft)' }}>{cycles.length} CYCLES</span>
        </div>
        {cycles.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: 'var(--surface-raised)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
              <HandCoins size={20} style={{ color: 'var(--ink-soft)' }} />
            </span>
            <p className="mt-4 text-[15.5px] font-medium">Payouts are cooming soon</p>
            <p className="t-small muted mt-1.5 max-w-[420px]">
              $CLST launches soon — the first cycle runs right after. This table fills in automatically, every row a
              real on-chain payout verifiable on the explorer.
            </p>
            <button onClick={onDocs} className="pill pill-surface pill-sm mt-5 flex items-center gap-1.5">
              <BookOpen size={13} /> Read how cycles work <ArrowRight size={12} />
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[13.5px]">
              <thead>
                <tr className="border-b t-mono text-[11px]" style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>
                  <th className="px-5 py-3 text-left font-medium">TIME</th>
                  <th className="px-5 py-3 text-left font-medium">CYCLE</th>
                  <th className="px-5 py-3 text-right font-medium">RECIPIENTS</th>
                  <th className="px-5 py-3 text-right font-medium">PAID</th>
                  <th className="px-5 py-3 text-right font-medium">ASSETS</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((c, i) => (
                  <tr key={`${c.cycle_index}-${i}`} className="border-b last:border-b-0" style={{ borderColor: 'var(--line)' }}>
                    <td className="t-mono px-5 py-3">{c.at ? ago(c.at) : '—'}</td>
                    <td className="t-mono px-5 py-3">#{c.cycle_index ?? '—'}</td>
                    <td className="t-mono px-5 py-3 text-right">{c.recipients.toLocaleString()}</td>
                    <td className="t-mono px-5 py-3 text-right">${(c.usd ?? 0).toFixed(2)}</td>
                    <td className="px-5 py-3 text-right">
                      {c.assets.length > 0 ? (
                        <span className="t-mono text-[12px]">{c.assets.map((a) => `${a.amount} ${a.symbol}`).join(' · ')}</span>
                      ) : (
                        <span className="t-mono text-[12px]" style={{ color: 'var(--ink-soft)' }}>{c.transfers ?? 0} transfers</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* payout basket — the curated 19, NOT the full 193 universe */}
      <div className="card mt-8 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
          <span className="text-[13.5px] font-medium">The payout basket</span>
          <span className="t-mono text-[11px]" style={{ color: 'var(--ink-soft)' }}>
            {basket ? `${basket.count} INSTRUMENTS · WEIGHTS SUM TO ${basket.weight_sum}` : 'ROBINHOOD CHAIN · 4663'}
          </span>
        </div>
        <p className="t-small muted border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
          Holders are paid from this curated, weighted basket — not the full tradeable universe. The other instruments
          exist for trading and market analysis in the Market tab.
        </p>
        <div className="grid gap-x-6 gap-y-1 p-5 sm:grid-cols-2">
          {(basket?.basket ?? []).map((b) => (
            <div key={b.symbol} className="flex items-center gap-2.5 py-1.5">
              <StockIcon symbol={b.symbol} size={24} />
              <span className="t-mono w-[52px] text-[13px] font-medium">{b.symbol}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: 'var(--ink-soft)' }}>{b.name}</span>
              <span className="t-mono text-[12.5px] font-medium">{b.weight}%</span>
            </div>
          ))}
          {!basket && <p className="t-small muted col-span-full py-4 text-center">Loading basket…</p>}
        </div>
      </div>

      <p className="t-small muted mt-6 flex items-start gap-2">
        <ExternalLink size={13} className="mt-0.5 shrink-0" />
        When live, every cycle links to its batched transaction on Robinhood Chain Blockscout. The keeper bot that runs
        the cycle is open — see Docs for the feed contract and how to verify a payout yourself.
      </p>
    </div>
  )
}
