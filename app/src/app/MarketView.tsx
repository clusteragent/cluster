import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, RefreshCw, Search, ArrowUpRight } from 'lucide-react'
import { api, type ApiMover, type ApiMovers, type ApiSector, type ApiQuote } from '@/lib/api'
import { useQuotes } from '@/lib/useQuotes'
import { StockIcon } from '@/components/StockIcon'
import { Sparkline } from '@/components/Sparkline'

const EASE = [0.22, 1, 0.36, 1] as const

const fmtPrice = (v: number | null | undefined) =>
  v == null ? '—' : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`)

/**
 * Market — the analysis surface across the whole tradeable universe:
 * a scrolling ticker tape with real marks, movers side by side, sector
 * heat as ranked bars, and a per-symbol chart with timeframes. Every
 * number comes from the market feed; empty/error states say so.
 */
export function MarketView({ onTrade }: { onTrade: (symbol?: string) => void }) {
  const [movers, setMovers] = useState<ApiMovers | null>(null)
  const [sectors, setSectors] = useState<ApiSector[]>([])
  const [moversError, setMoversError] = useState(false)
  const [selected, setSelected] = useState<string>('NVDA')
  const [tf, setTf] = useState('1mo')
  const [chart, setChart] = useState<(ApiQuote & { tf: string }) | null>(null)
  const [chartError, setChartError] = useState(false)

  const load = () => {
    setMoversError(false)
    api
      .getMovers(10)
      .then(setMovers)
      .catch(() => setMoversError(true))
    api
      .getSectors()
      .then((d) => setSectors(d.sectors))
      .catch(() => {})
  }

  useEffect(load, [])

  useEffect(() => {
    setChartError(false)
    setChart(null)
    api
      .getChart(selected, tf)
      .then(setChart)
      .catch(() => setChartError(true))
  }, [selected, tf])

  // ticker tape symbols — basket + movers, deduped
  const tapeSymbols = useMemo(() => {
    const base = ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AMD', 'NFLX', 'ORCL', 'COIN', 'PLTR']
    const extra = [...(movers?.gainers ?? []), ...(movers?.losers ?? [])].map((m) => m.symbol)
    return Array.from(new Set([...base, ...extra])).slice(0, 20)
  }, [movers])
  const { quotes: tapeQuotes } = useQuotes(tapeSymbols)

  const gainers = movers?.gainers ?? []
  const losers = movers?.losers ?? []
  const maxAbs = Math.max(
    0.01,
    ...sectors.map((s) => Math.abs(s.avg_change_pct)),
  )

  const renderMoverRow = (r: ApiMover, up: boolean) => (
    <button
      key={r.symbol}
      onClick={() => setSelected(r.symbol)}
      className="group flex w-full items-center gap-3 border-b px-5 py-2.5 text-left transition-colors hover:bg-[var(--surface-raised)] last:border-b-0"
      style={{ borderColor: 'var(--line)' }}
    >
      <StockIcon symbol={r.symbol} size={26} />
      <span className="t-mono w-[52px] shrink-0 text-[13px] font-semibold">{r.symbol}</span>
      <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: 'var(--ink-soft)' }}>
        {r.name}
      </span>
      <span className="t-mono w-[84px] text-right text-[13px] font-medium">{fmtPrice(r.price)}</span>
      <span
        className={`t-mono flex w-[76px] items-center justify-end gap-1 rounded-md px-1.5 py-0.5 text-[12.5px] font-medium ${up ? 'delta-up' : 'delta-down'}`}
        style={{ background: up ? 'var(--signal-dim)' : 'rgba(255,255,255,0.08)' }}
      >
        {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {fmtPct(r.change_pct)}
      </span>
    </button>
  )

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8 sm:py-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="t-display">
              Market
              <span className="block" style={{ color: 'var(--ink-soft)' }}>
                Live, across the whole universe.
              </span>
            </h1>
            <p className="t-lead muted mt-4 max-w-[600px]">
              Every instrument on Robinhood Chain we cover — quotes, movers, sector heat. Data straight from the
              market feed; the app shows nothing it can't source.
            </p>
          </div>
          {movers && (
            <span className="pill pill-sm pill-surface mt-2 hidden shrink-0 items-center gap-1.5 sm:flex" title={movers.fetched_at}>
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--signal)' }} />
              {movers.covered}/{movers.universe} live
            </span>
          )}
          <button onClick={load} className="icon-button shrink-0 sm:hidden" title="Refresh" style={{ color: 'var(--ink-soft)' }}>
            <RefreshCw size={15} />
          </button>
        </div>
      </motion.div>

      {/* ticker tape */}
      <div className="card mt-8 overflow-hidden">
        <div className="tape">
          <div className="tape-track">
            {[...tapeSymbols, ...tapeSymbols].map((sym, i) => {
              const q = tapeQuotes[sym]
              const up = (q?.change_pct ?? 0) >= 0
              return (
                <button
                  key={`${sym}-${i}`}
                  onClick={() => setSelected(sym)}
                  className="tape-item"
                  title={`Open ${sym}`}
                >
                  <StockIcon symbol={sym} size={20} eager />
                  <span className="t-mono text-[11.5px] font-semibold">{sym}</span>
                  <span className="t-mono text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>
                    {fmtPrice(q?.price)}
                  </span>
                  <span className={`t-mono text-[11.5px] font-medium ${up ? 'delta-up' : 'delta-down'}`}>
                    {fmtPct(q?.change_pct)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* movers — gainers & losers side by side */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
            <span className="flex items-center gap-2 text-[14px] font-semibold">
              <TrendingUp size={15} style={{ color: 'var(--signal)' }} /> Top gainers
            </span>
            <button onClick={load} className="icon-button" title="Refresh" style={{ color: 'var(--ink-soft)', width: 32, height: 32 }}>
              <RefreshCw size={13} />
            </button>
          </div>
          <div>
            {gainers.length === 0 && (
              <p className="t-small muted px-5 py-10 text-center">
                {moversError ? 'Market data unavailable — upstream feed unreachable.' : 'Loading market data…'}
              </p>
            )}
            {gainers.map((r) => renderMoverRow(r, true))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
            <span className="flex items-center gap-2 text-[14px] font-semibold">
              <TrendingDown size={15} style={{ color: 'var(--danger)' }} /> Top losers
            </span>
            <span className="t-small muted">{movers ? `${movers.covered} covered` : ''}</span>
          </div>
          <div>
            {losers.length === 0 && (
              <p className="t-small muted px-5 py-10 text-center">
                {moversError ? 'Market data unavailable — upstream feed unreachable.' : 'Loading market data…'}
              </p>
            )}
            {losers.map((r) => renderMoverRow(r, false))}
          </div>
        </div>
      </div>

      {/* sector heat — ranked monochrome bars */}
      <div className="card mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
          <span className="text-[14px] font-semibold">Sector heat</span>
          <span className="t-small muted">avg day change</span>
        </div>
        <div className="p-5">
          {sectors.length === 0 && <p className="t-small muted py-4 text-center">Loading sector data…</p>}
          <div className="flex flex-col gap-2.5">
            {/* column labels so the count column reads as "n symbols" */}
            <div className="flex items-center gap-3 pb-0.5">
              <span className="w-[110px] shrink-0" />
              <span className="t-mono min-w-0 flex-1 text-right text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
                bar = |avg day|
              </span>
              <span className="t-mono w-[56px] shrink-0 text-right text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
                day
              </span>
              <span className="t-mono w-[36px] shrink-0 text-right text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }} title="number of instruments in the sector">
                n
              </span>
            </div>
            {[...sectors]
              .sort((a, b) => b.avg_change_pct - a.avg_change_pct)
              .map((s) => {
                const up = s.avg_change_pct >= 0
                const w = Math.max(6, Math.round((Math.abs(s.avg_change_pct) / maxAbs) * 100))
                return (
                  <div key={s.sector} className="flex items-center gap-3">
                    <span className="w-[110px] shrink-0 truncate text-[12.5px] font-medium">{s.sector}</span>
                    <div className="relative h-[22px] min-w-0 flex-1 overflow-hidden rounded-md" style={{ background: 'var(--field-alt)' }}>
                      <div
                        className="absolute inset-y-0 rounded-md transition-all duration-500"
                        style={{
                          width: `${w}%`,
                          background: up ? 'var(--signal-dim)' : 'rgba(255,255,255,0.10)',
                          borderLeft: `2px solid ${up ? 'var(--signal)' : 'var(--danger)'}`,
                        }}
                      />
                    </div>
                    <span className={`t-mono w-[56px] shrink-0 text-right text-[12.5px] font-medium ${up ? 'delta-up' : 'delta-down'}`}>
                      {fmtPct(s.avg_change_pct)}
                    </span>
                    <span className="t-small muted w-[36px] shrink-0 text-right" title={`${s.advancers} up / ${s.decliners} down`}>
                      {s.count}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* chart */}
      <div className="card mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-3">
            <StockIcon symbol={selected} size={30} />
            <div>
              <p className="t-mono text-[14.5px] font-semibold">{selected}</p>
              <p className="t-small muted">{chart?.name ?? '—'}</p>
            </div>
            {chart?.price != null && (
              <div className="ml-2 flex items-baseline gap-2">
                <span className="t-mono text-[18px] font-semibold">{fmtPrice(chart.price)}</span>
                <span
                  className={`t-mono rounded-md px-1.5 py-0.5 text-[12.5px] font-medium ${(chart.change_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'}`}
                  style={{ background: (chart.change_pct ?? 0) >= 0 ? 'var(--signal-dim)' : 'rgba(255,255,255,0.08)' }}
                >
                  {fmtPct(chart.change_pct)}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {(['1d', '5d', '1mo', '3mo', '6mo', '1y'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTf(t)}
                className="pill pill-sm"
                style={{
                  background: tf === t ? 'var(--ink)' : 'transparent',
                  color: tf === t ? '#fff' : 'var(--ink-soft)',
                  boxShadow: tf === t ? 'none' : 'inset 0 0 0 1px var(--line)',
                  padding: '0 0.6rem',
                  height: '1.7rem',
                  fontSize: 11.5,
                }}
              >
                {t}
              </button>
            ))}
            <button onClick={() => onTrade(selected)} className="pill pill-sm pill-ink ml-1 flex items-center gap-1.5">
              <ArrowUpRight size={12} /> Trade {selected}
            </button>
          </div>
        </div>
        <div className="p-5">
          {chartError && <p className="t-small" style={{ color: 'var(--danger)' }}>Chart unavailable for {selected}.</p>}
          {!chartError && !chart && <p className="t-small muted">Loading chart…</p>}
          {chart && (
            <div className="w-full">
              <Sparkline
                series={chart.series}
                width={980}
                height={220}
                up={
                  chart.series && chart.series.length > 1
                    ? chart.series[chart.series.length - 1][1] >= chart.series[0][1]
                    : (chart.change_pct ?? 0) >= 0
                }
              />
            </div>
          )}
          {chart && chart.day_low != null && (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
              <span className="t-small muted">
                day low <span className="t-mono" style={{ color: 'var(--ink)' }}>{fmtPrice(chart.day_low)}</span>
              </span>
              <span className="t-small muted">
                day high <span className="t-mono" style={{ color: 'var(--ink)' }}>{fmtPrice(chart.day_high)}</span>
              </span>
              <span className="t-small muted">
                previous close <span className="t-mono" style={{ color: 'var(--ink)' }}>{fmtPrice(chart.previousClose)}</span>
              </span>
              <span className="t-small muted">
                source <span className="t-mono" style={{ color: 'var(--ink)' }}>{chart.source ?? 'yahoo'}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <p className="t-small muted mt-6 flex items-start gap-2">
        <Search size={13} className="mt-0.5 shrink-0" />
        Quotes come from the market feed (Yahoo spark proxy, same source the SPX500 app uses) and refresh every
        60 seconds. Movers cover the full tradeable universe; the payout basket is the curated 19-stock subset
        shown in Payouts.
      </p>
    </div>
  )
}
