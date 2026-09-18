/**
 * MarketsView — Trade + Market + Index combined into one surface.
 * Three tabs: Market (live quotes/movers/sectors/chart), Trade (in-app swap),
 * Index (basket composition). A live news/movers feed runs at the top always.
 */
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bitcoin,
  TrendingUp, TrendingDown, RefreshCw, Search, ArrowUpRight,
  ArrowLeftRight, ShieldCheck, ShieldQuestion, ExternalLink,
  BarChart3, Layers, Activity, Loader2, Check, AlertTriangle, BookOpen, ChevronDown,
} from 'lucide-react'
import {
  api, type ApiMover, type ApiMovers, type ApiSector, type ApiQuote,
  type ApiIndex, type ApiStock, type ApiNews,
} from '@/lib/api'
import { useQuotes } from '@/lib/useQuotes'
import { DexChart } from '@/components/DexChart'
import { ASSETS as RH_ASSETS } from '@/lib/rhRegistry'
import { CRYPTO_ASSETS } from '@/lib/cryptoRegistry'
import { StockIcon } from '@/components/StockIcon'
import { Sparkline } from '@/components/Sparkline'
import { CandleChart, type Candle } from '@/components/CandleChart'
import {
  encodeApprove, encodeBuyTx, encodeSellTx, fetchQuote, fetchTradeStatus,
  waitForReceipt, explorerTx, type TradeStatus, erc20Abi, ROUTER,
} from '@/lib/swap'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useSendTransaction, useReadContract, useBalance, usePublicClient } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'

const EASE = [0.22, 1, 0.36, 1] as const
type Tab = 'market' | 'trade' | 'index'
type Side = 'buy' | 'sell'
type Phase = 'idle' | 'quoting' | 'ready' | 'approving' | 'swapping' | 'success' | 'error'

const fmtPrice = (v: number | null | undefined) =>
  v == null ? '—' : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`)

/* ─── live movers feed strip (top of all tabs) ─── */
function MoversStrip({ movers }: { movers: ApiMovers | null }) {
  if (!movers) return null
  const all = [...movers.gainers.slice(0, 6), ...movers.losers.slice(0, 6)]
  return (
    <div className="tape overflow-hidden border-b" style={{ borderColor: 'var(--line)' }}>
      <div className="tape-track flex w-max items-center">
        {[...all, ...all].map((m, i) => {
          const up = m.change_pct >= 0
          return (
            <span key={`${m.symbol}-${i}`} className="tape-item flex items-center gap-1.5">
              <StockIcon symbol={m.symbol} size={16} eager />
              <span className="t-mono text-[11px] font-medium">{m.symbol}</span>
              <span className="t-mono text-[11px]" style={{ color: 'var(--ink-soft)' }}>{fmtPrice(m.price)}</span>
              <span className={`t-mono text-[11px] font-medium ${up ? 'delta-up' : 'delta-down'}`}>{fmtPct(m.change_pct)}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ─── news panel (real headlines, Yahoo Finance RSS) ─── */
function NewsPanel() {
  const [news, setNews] = useState<ApiNews | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => { api.getNews(12).then(setNews).catch(() => setErr(true)) }, [])
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-2.5 sm:px-5" style={{ borderColor: 'var(--line)' }}>
        <span className="flex items-center gap-1.5 text-[13px] font-semibold"><BookOpen size={13} style={{ color: 'var(--ink-soft)' }} /> Market News</span>
        <span className="t-small muted">Yahoo Finance · real headlines</span>
      </div>
      <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        {err && <p className="t-small muted px-4 py-6">News feed unreachable.</p>}
        {!err && !news && <p className="t-small muted px-4 py-6">Loading…</p>}
        {(news?.items ?? []).map((n, i) => (
          <a key={i} href={n.link} target="_blank" rel="noreferrer"
            className="flex flex-col gap-1.5 border-b px-4 py-3 transition-colors hover:bg-[var(--surface-raised)] sm:border-r"
            style={{ borderColor: 'var(--line)', textDecoration: 'none' }}>
            <span className="line-clamp-2 text-[12.5px] font-medium leading-snug" style={{ color: 'var(--ink)' }}>{n.title}</span>
            <span className="t-mono text-[10px]" style={{ color: 'var(--ink-dim)' }}>
              {n.publisher}{n.published ? ` · ${new Date(n.published).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}


/* ─── crypto spot panel (RH Chain natives, DexScreener live) ─── */
function useCryptoQuotes() {
  const [rows, setRows] = useState<{ s: string; n: string; price: number | null; change: number | null; liq: number | null }[]>([])
  useEffect(() => {
    let alive = true
    const load = () => {
      // one batched call — dexscreener accepts up to 30 comma-separated addresses
      const addrs = CRYPTO_ASSETS.map((c) => c.a).join(',')
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${addrs}`, { headers: { Accept: 'application/json' } })
        .then((r) => r.json())
        .then((d) => {
          const pairs = (d?.pairs ?? []).filter((p: { chainId: string }) => p.chainId === 'robinhood')
          const rows = CRYPTO_ASSETS.map((c) => {
            const me = c.a.toLowerCase()
            const mine = pairs.filter((p: { baseToken?: { address?: string }; quoteToken?: { address?: string } }) =>
              (p.baseToken?.address ?? '').toLowerCase() === me || (p.quoteToken?.address ?? '').toLowerCase() === me)
            const best = mine.sort((a: { liquidity?: { usd?: number } }, b: { liquidity?: { usd?: number } }) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
            // priceUsd is only valid when our token is the BASE side of the pair.
            // WETH/USDG borrow stats from the shared pair — their own 24h change is
            // meaningless there (same pool, same %), so suppress it. USDG = $1 peg.
            let price: number | null = null
            let change: number | null = best?.priceChange?.h24 ?? null
            const isBase = best ? (best.baseToken?.address ?? '').toLowerCase() === me : false
            if (best?.priceUsd != null && isBase) price = Number(best.priceUsd)
            if (c.s === 'USDG') { price = 1; change = null }
            if (c.s === 'WETH') change = null
            return { s: c.s, n: c.n, price, change, liq: best?.liquidity?.usd ?? null }
          })
          if (alive) setRows(rows)
        })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 30_000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  return rows
}

function CryptoPanel({ onTrade }: { onTrade: (sym: string) => void }) {
  const all = useCryptoQuotes()
  const rows = [...all].sort((a, b) => (b.liq ?? 0) - (a.liq ?? 0)).slice(0, 8)
  if (rows.length === 0) return null
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-2.5 sm:px-5" style={{ borderColor: 'var(--line)' }}>
        <span className="flex items-center gap-1.5 text-[13px] font-semibold">
          <Bitcoin size={13} style={{ color: 'var(--ink-soft)' }} /> Crypto · Robinhood Chain
        </span>
        <span className="t-small muted">dexscreener live · 30s</span>
      </div>
      {rows.map((r) => {
        const asset = CRYPTO_ASSETS.find((c) => c.s === r.s)
        return (
          <div key={r.s} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0 sm:px-5" style={{ borderColor: 'var(--line)' }}>
            <span className="grid size-6 shrink-0 place-items-center rounded-full text-[9px] font-bold" style={{ background: 'linear-gradient(135deg, #8caaff, #ffb45a)', color: '#000' }}>{r.s.slice(0, 2)}</span>
            <span className="t-mono w-20 shrink-0 text-[12.5px] font-semibold">{r.s}</span>
            <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--ink-soft)' }}>{r.n}</span>
            {r.liq != null && <span className="t-mono hidden text-[11px] sm:block" style={{ color: 'var(--ink-dim)' }}>liq ${r.liq >= 1e6 ? `${(r.liq / 1e6).toFixed(1)}M` : r.liq >= 1e3 ? `${(r.liq / 1e3).toFixed(0)}K` : Math.round(r.liq)}</span>}
            <span className="t-mono w-24 text-right text-[12.5px] font-medium">{r.price == null ? '—' : r.price < 1 ? `$${r.price.toFixed(6)}` : `$${r.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
            <span className={`t-mono hidden w-[68px] items-center justify-end rounded-md px-1.5 py-0.5 text-[11.5px] font-medium sm:flex ${(r.change ?? 0) >= 0 ? 'delta-up' : 'delta-down'}`}
              style={{ background: (r.change ?? 0) >= 0 ? 'var(--signal-dim)' : 'rgba(255,255,255,0.08)' }}>
              {fmtPct(r.change)}
            </span>
            <button onClick={() => onTrade(r.s)}
              title={asset?.swapable === false ? 'V4 router swap coming soon' : `Swap ${r.s}`}
              className="t-mono shrink-0 rounded-md px-2 py-1 text-[10.5px] font-semibold transition-colors"
              style={{
                background: 'var(--field-alt)',
                color: asset?.swapable === false ? 'var(--ink-dim)' : 'var(--ink)',
                boxShadow: 'inset 0 0 0 1px var(--line)',
              }}>
              {asset?.swapable === false ? 'soon' : 'swap'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* ─── market tab ─── */
function MarketTab({ onTrade, movers, sectors, moversError, load, tokenAddresses }: {
  onTrade: (sym: string) => void
  movers: ApiMovers | null
  sectors: ApiSector[]
  moversError: boolean
  load: () => void
  tokenAddresses: Map<string, string>
}) {
  const [selected, setSelected] = useState('NVDA')
  const [selectedKind, setSelectedKind] = useState<'stock' | 'crypto'>('stock')
  const [tf, setTf] = useState('1mo')
  const [chart, setChart] = useState<(ApiQuote & { tf: string; candles?: Candle[] }) | null>(null)
  const [chartError, setChartError] = useState(false)
  const [pairOpen, setPairOpen] = useState(false)
  const [pairQ, setPairQ] = useState('')
  const [pairs, setPairs] = useState<ApiStock[]>([])

  const dexPair = useMemo(() => {
    if (selectedKind === 'crypto') {
      const c = CRYPTO_ASSETS.find((a) => a.s === selected)
      return c ? (c.p ?? c.a) : null
    }
    return RH_ASSETS.find((a) => a.s === selected)?.p ?? null
  }, [selected, selectedKind])

  // live crypto price + CHECKSUMMED pair from DexScreener API (embed requires checksum)
  const [cryptoPrice, setCryptoPrice] = useState<{ price: number | null; change: number | null } | null>(null)
  const [checksumPair, setChecksumPair] = useState<string | null>(null)
  useEffect(() => {
    if (selectedKind !== 'crypto' || !dexPair) { setCryptoPrice(null); setChecksumPair(null); return }
    let alive = true
    const load = () => {
      fetch(`https://api.dexscreener.com/latest/dex/pairs/robinhood/${dexPair}`, { headers: { Accept: 'application/json' } })
        .then((r) => r.json())
        .then((d) => {
          const pair = d?.pairs?.[0]
          if (alive && pair) {
            setCryptoPrice({ price: pair.priceUsd != null ? Number(pair.priceUsd) : null, change: pair.priceChange?.h24 ?? null })
            if (pair.pairAddress) setChecksumPair(pair.pairAddress)
          }
        })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 30_000)
    return () => { alive = false; clearInterval(id) }
  }, [selectedKind, dexPair])
  useEffect(() => {
    setChartError(false); setChart(null)
    api.getChart(selected, tf).then(setChart).catch(() => setChartError(true))
  }, [selected, tf])

  useEffect(() => {
    api.getIndex().then((d) => setPairs(d.stocks)).catch(() => {})
  }, [])

  const pairHits = pairQ
    ? pairs.filter((s) => s.symbol.toLowerCase().includes(pairQ.toLowerCase()) || s.name.toLowerCase().includes(pairQ.toLowerCase()))
    : pairs

  const gainers = (movers?.gainers ?? []).slice(0, 5)
  const losers = (movers?.losers ?? []).slice(0, 5)
  const maxAbs = Math.max(0.01, ...sectors.map((s) => Math.abs(s.avg_change_pct)))

  const renderRow = (r: ApiMover, up: boolean) => (
    <button
      key={r.symbol}
      onClick={() => setSelected(r.symbol)}
      className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left transition-colors hover:bg-[var(--surface-raised)] last:border-b-0 sm:px-5"
      style={{ borderColor: 'var(--line)' }}
    >
      <StockIcon symbol={r.symbol} size={24} />
      <span className="t-mono w-12 shrink-0 text-[12.5px] font-semibold">{r.symbol}</span>
      <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--ink-soft)' }}>{r.name}</span>
      <span className="t-mono w-20 text-right text-[12.5px] font-medium">{fmtPrice(r.price)}</span>
      <span className={`t-mono flex w-[68px] items-center justify-end gap-0.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium ${up ? 'delta-up' : 'delta-down'}`}
        style={{ background: up ? 'var(--signal-dim)' : 'rgba(255,255,255,0.08)' }}>
        {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {fmtPct(r.change_pct)}
      </span>
    </button>
  )

  return (
    <>
    <div className="flex flex-col gap-4">
      {/* row 1: chart left (2fr) + movers stacked right (1fr) */}
      <div className="grid items-start gap-4 xl:grid-cols-[2fr_1fr]">
        {/* CHART */}
        <div className="card flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 sm:px-5" style={{ borderColor: 'var(--line)' }}>
            <div className="relative flex items-center gap-2.5">
              <StockIcon symbol={selected} size={26} />
              <button onClick={() => { setPairOpen((o) => !o); setPairQ('') }} className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-[var(--surface-raised)]" title="Change pair">
                <span>
                  <span className="t-mono flex items-center gap-1 text-[13.5px] font-semibold">{selected} <ChevronDown size={12} style={{ color: 'var(--ink-dim)' }} /></span>
                  <span className="text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>{chart?.name ?? '—'}</span>
                </span>
              </button>
              {pairOpen && (
                <div className="absolute left-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
                  <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
                    <Search size={12} style={{ color: 'var(--ink-soft)' }} />
                    <input autoFocus value={pairQ} onChange={(e) => setPairQ(e.target.value)} placeholder="Search pair…" className="w-full bg-transparent text-[12.5px] outline-none" style={{ color: 'var(--ink)' }} />
                  </div>
                  <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {CRYPTO_ASSETS.filter((c) => !pairQ || c.s.toLowerCase().includes(pairQ.toLowerCase())).map((c) => (
                      <button key={c.a} onClick={() => { setSelected(c.s); setSelectedKind('crypto'); setPairOpen(false) }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-raised)]"
                        style={{ background: c.s === selected ? 'var(--field-alt)' : undefined }}>
                        <span className="grid size-[18px] shrink-0 place-items-center rounded-full text-[8px] font-bold" style={{ background: 'linear-gradient(135deg, #8caaff, #ffb45a)', color: '#000' }}>{c.s.slice(0, 2)}</span>
                        <span className="t-mono w-12 shrink-0 text-[12px] font-semibold">{c.s}</span>
                        <span className="min-w-0 flex-1 truncate text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>{c.n} · crypto</span>
                        {c.s === selected && <Check size={12} style={{ color: 'var(--ink)' }} />}
                      </button>
                    ))}
                    <div className="px-3 pb-1 pt-2 text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-dim)', borderTop: '1px solid var(--line)' }}>Stocks · tokenized on 4663</div>
                    {pairHits.slice(0, 40).map((s) => (
                      <button key={s.address} onClick={() => { setSelected(s.symbol); setSelectedKind('stock'); setPairOpen(false) }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-raised)]"
                        style={{ background: s.symbol === selected ? 'var(--field-alt)' : undefined }}>
                        <StockIcon symbol={s.symbol} size={18} />
                        <span className="t-mono w-12 shrink-0 text-[12px] font-semibold">{s.symbol}</span>
                        <span className="min-w-0 flex-1 truncate text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>{s.name}</span>
                        {s.symbol === selected && <Check size={12} style={{ color: 'var(--ink)' }} />}
                      </button>
                    ))}
                    {pairHits.length === 0 && <p className="px-3 py-3 text-[12px]" style={{ color: 'var(--ink-soft)' }}>No pair matches.</p>}
                  </div>
                </div>
              )}
              {selectedKind === 'crypto' && cryptoPrice?.price != null ? (
                <div className="ml-1.5 flex items-baseline gap-1.5">
                  <span className="t-mono text-[16px] font-semibold">${cryptoPrice.price < 1 ? cryptoPrice.price.toFixed(6) : cryptoPrice.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className={`t-mono rounded px-1 py-0.5 text-[11.5px] font-medium ${(cryptoPrice.change ?? 0) >= 0 ? 'delta-up' : 'delta-down'}`}
                    style={{ background: (cryptoPrice.change ?? 0) >= 0 ? 'var(--signal-dim)' : 'rgba(255,255,255,0.08)' }}>
                    {fmtPct(cryptoPrice.change)}
                  </span>
                </div>
              ) : chart?.price != null && (
                <div className="ml-1.5 flex items-baseline gap-1.5">
                  <span className="t-mono text-[16px] font-semibold">{fmtPrice(chart.price)}</span>
                  <span className={`t-mono rounded px-1 py-0.5 text-[11.5px] font-medium ${(chart.change_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'}`}
                    style={{ background: (chart.change_pct ?? 0) >= 0 ? 'var(--signal-dim)' : 'rgba(255,255,255,0.08)' }}>
                    {fmtPct(chart.change_pct)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none', maxWidth: '100%' }}>
                {selectedKind === 'stock' && (['1d', '5d', '1mo', '3mo', '6mo', '1y'] as const).map((t) => (
                  <button key={t} onClick={() => setTf(t)} className="pill pill-sm"
                    style={{ background: tf === t ? 'var(--ink)' : 'transparent', color: tf === t ? '#fff' : 'var(--ink-soft)', boxShadow: tf === t ? 'none' : 'inset 0 0 0 1px var(--line)', padding: '0 0.5rem', height: '1.6rem', fontSize: 11 }}>
                    {t}
                  </button>
                ))}
                <button onClick={() => onTrade(selected)} className="pill pill-sm pill-ink ml-1 flex items-center gap-1">
                  <ArrowLeftRight size={11} /> Swap
                </button>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <DexChart pair={selectedKind === 'crypto' ? (checksumPair ?? dexPair) : dexPair} theme="dark" height={480} />
            {chart?.day_low != null && (
              <div className="mt-3 flex flex-wrap gap-4">
                {[['Low', fmtPrice(chart.day_low)], ['High', fmtPrice(chart.day_high)], ['Prev', fmtPrice(chart.previousClose)]].map(([k, v]) => (
                  <span key={k} className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>
                    {k} <span className="t-mono font-medium" style={{ color: 'var(--ink)' }}>{v}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MOVERS column (stacked gainers+losers) */}
        <div className="flex flex-col gap-4">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-2.5 sm:px-5" style={{ borderColor: 'var(--line)' }}>
              <span className="flex items-center gap-1.5 text-[13px] font-semibold"><TrendingUp size={13} style={{ color: 'var(--ink)' }} /> Gainers</span>
              <button onClick={load} className="icon-button" style={{ width: 26, height: 26 }}><RefreshCw size={11} /></button>
            </div>
            {gainers.length === 0 && <p className="t-small muted px-4 py-6 text-center">{moversError ? 'Feed unreachable.' : 'Loading…'}</p>}
            {gainers.map((r) => renderRow(r, true))}
          </div>
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-2.5 sm:px-5" style={{ borderColor: 'var(--line)' }}>
              <span className="flex items-center gap-1.5 text-[13px] font-semibold"><TrendingDown size={13} style={{ color: 'var(--ink-soft)' }} /> Losers</span>
              <span className="t-small muted">{movers ? `${movers.covered} covered` : ''}</span>
            </div>
            {losers.length === 0 && <p className="t-small muted px-4 py-6 text-center">{moversError ? 'Feed unreachable.' : 'Loading…'}</p>}
            {losers.map((r) => renderRow(r, false))}
          </div>
        </div>
      </div>

      {/* row 2: sector heat full-width */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-2.5 sm:px-5" style={{ borderColor: 'var(--line)' }}>
          <span className="text-[13px] font-semibold">Sector heat</span>
          <span className="t-small muted">avg day change</span>
        </div>
        <div className="p-4 sm:p-5">
          <div className="mb-2.5 flex items-center gap-3">
            <span className="w-[100px] shrink-0" /><span className="t-mono min-w-0 flex-1 text-right text-[9.5px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>|avg|</span>
            <span className="t-mono w-12 shrink-0 text-right text-[9.5px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>day</span>
            <span className="t-mono w-7 shrink-0 text-right text-[9.5px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>n</span>
          </div>
          {sectors.length === 0 && <p className="t-small muted py-4 text-center">Loading…</p>}
          <div className="flex flex-col gap-2">
            {[...sectors].sort((a, b) => b.avg_change_pct - a.avg_change_pct).map((s) => {
              const up = s.avg_change_pct >= 0
              const w = Math.max(6, Math.round((Math.abs(s.avg_change_pct) / maxAbs) * 100))
              return (
                <div key={s.sector} className="flex items-center gap-3">
                  <span className="w-[100px] shrink-0 truncate text-[12px] font-medium">{s.sector}</span>
                  <div className="relative h-5 min-w-0 flex-1 overflow-hidden rounded" style={{ background: 'var(--field-alt)' }}>
                    <div className="absolute inset-y-0 rounded transition-all duration-500" style={{ width: `${w}%`, background: up ? 'var(--signal-dim)' : 'rgba(255,255,255,0.1)', borderLeft: `2px solid ${up ? 'var(--signal)' : 'var(--danger)'}` }} />
                  </div>
                  <span className={`t-mono w-12 shrink-0 text-right text-[12px] font-medium ${up ? 'delta-up' : 'delta-down'}`}>{fmtPct(s.avg_change_pct)}</span>
                  <span className="t-small muted w-7 shrink-0 text-right" title={`${s.advancers} up / ${s.decliners} down`}>{s.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* row 3: crypto spot (RH Chain natives) */}
      <CryptoPanel onTrade={onTrade} />

      {/* row 4: news full-width */}
      <NewsPanel />
    </div>
    </>
  )
}

/* ─── index tab ─── */
function IndexTab({ onTradeSymbol }: { onTradeSymbol: (sym: string) => void }) {
  const [data, setData] = useState<ApiIndex | null>(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState(false)
  const [dexSelected, setDexSelected] = useState<{ address: string; symbol: string } | null>(null)
  useEffect(() => { api.getIndex().then(setData).catch(() => setError(true)) }, [])
  const filtered = data?.stocks.filter((s) => s.symbol.toLowerCase().includes(q.toLowerCase()) || s.name.toLowerCase().includes(q.toLowerCase()))
  const quoteSymbols = useMemo(() => (data?.stocks ?? []).slice(0, 20).map((s) => s.symbol), [data])
  const { quotes } = useQuotes(quoteSymbols)
  return (
    <div className="flex flex-col gap-5">
      {data && (
        <div className="card p-4 sm:p-5">
          <div className="flex items-start gap-2.5">
            <ShieldQuestion size={18} style={{ color: 'var(--ink-soft)', marginTop: 1, flexShrink: 0 }} />
            <div>
              <p className="text-[14px] font-semibold">$CLST is cooming soon</p>
              <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--ink-soft)' }}>
                {data.stock_count} instruments · {data.verified_on_chain_count} verified on-chain
              </p>
            </div>
            <span className="ml-auto shrink-0">
              <span className="pill pill-sm pill-outline-dark" style={{ height: '1.5rem', padding: '0 0.65rem', fontSize: 10.5 }}>Cooming soon</span>
            </span>
          </div>
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="border-b px-4 py-2.5 sm:px-5" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-2" style={{ background: 'var(--field-alt)', borderRadius: 8, padding: '6px 10px' }}>
            <Search size={13} style={{ color: 'var(--ink-soft)', flexShrink: 0 }} />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search symbol or name…"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              style={{ color: 'var(--ink)' }}
            />
          </div>
        </div>
        {error && <p className="t-small px-4 py-6" style={{ color: 'var(--danger)' }}>Could not reach the index API.</p>}
        {!data && !error && <p className="t-small muted px-4 py-6 text-center">Loading…</p>}
        {(filtered ?? []).slice(0, 60).map((s) => {
          const qt = quotes[s.symbol] as ApiQuote | undefined
          return (
            <div key={s.address} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0 sm:px-5" style={{ borderColor: 'var(--line)' }}>
              <StockIcon symbol={s.symbol} size={22} />
              <span className="t-mono w-12 shrink-0 text-[12.5px] font-semibold">{s.symbol}</span>
              <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--ink-soft)' }}>{s.name}</span>
              {qt?.price != null && <span className="t-mono hidden text-[12px] sm:block">{fmtPrice(qt.price)}</span>}
              <span className={`t-mono hidden text-[11.5px] sm:block ${(qt?.change_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'}`}>{qt?.change_pct != null ? fmtPct(qt.change_pct) : '—'}</span>
              <span className="flex items-center gap-1 text-[11px]" style={{ color: s.verified ? 'var(--signal)' : 'var(--ink-soft)' }}>
                <ShieldCheck size={11} /> {s.verified ? 'verified' : 'unverified'}
              </span>
              <button onClick={() => { onTradeSymbol(s.symbol); setDexSelected({ address: s.address, symbol: s.symbol }) }} className="icon-button" style={{ width: 28, height: 28 }} title={`Trade ${s.symbol}`}>
                <ArrowLeftRight size={12} />
              </button>
            </div>
          )
        })}
        {filtered && filtered.length > 60 && (
          <p className="t-small muted border-t px-4 py-3 text-center" style={{ borderColor: 'var(--line)' }}>
            Showing 60 of {filtered.length}. Refine your search.
          </p>
        )}
      </div>
      {dexSelected && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-2.5 sm:px-5" style={{ borderColor: 'var(--line)' }}>
            <span className="text-[13px] font-semibold">
              DEX Chart: {dexSelected.symbol} · Robinhood Chain 4663
            </span>
            <button onClick={() => setDexSelected(null)} className="icon-button" style={{ width: 28, height: 28 }} title="Close DEX chart">
              ✕
            </button>
          </div>
          <div className="p-0">
            <iframe
              src={`https://dexscreener.com/robinhoodchain/${dexSelected.address}?embed=1&theme=dark&info=0`}
              style={{ width: '100%', height: 360, border: 'none', borderRadius: 12, display: 'block' }}
              title={`DEX chart for ${dexSelected.symbol}`}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── trade tab ─── */

function TradeTab({ initialSymbol, onDocs }: { initialSymbol?: string; onDocs: () => void }) {
  const { address, isConnected } = useAppKitAccount()
  const { open } = useAppKit()
  const { sendTransactionAsync } = useSendTransaction()
  const account = (address ?? '') as `0x${string}`
  const { data: ethBalance } = useBalance({ address: account || undefined, chainId: 4663 })
  const publicClient = usePublicClient({ chainId: 4663 })
  const [index, setIndex] = useState<ApiIndex | null>(null)
  const [status, setStatus] = useState<TradeStatus | null>(null)
  const [side, setSide] = useState<Side>('buy')
  const [selected, setSelected] = useState<ApiStock | null>(null)
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null)
  const [amount, setAmount] = useState('0.01')
  const [q, setQ] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [quoteOut, setQuoteOut] = useState<string | null>(null)
  const [quotePath, setQuotePath] = useState<`0x${string}` | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quotePathLabel, setQuotePathLabel] = useState<string>('')
  const [slippagePct, setSlippagePct] = useState<number>(2)
  const [receivedActual, setReceivedActual] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [needsApproval, setNeedsApproval] = useState(false)

  useEffect(() => {
    api.getIndex().then(setIndex).catch(() => {})
    fetchTradeStatus().then(setStatus).catch(() => {})
  }, [])

  useEffect(() => {
    if (!index || selected) return
    const want = initialSymbol ? index.stocks.find((s) => s.symbol === initialSymbol) : null
    setSelected(want ?? index.stocks.find((s) => s.symbol === 'NVDA') ?? index.stocks[0] ?? null)
  }, [index, initialSymbol, selected])

  const top = useMemo(() => (index?.stocks ?? []).slice(0, 20), [index])
  const { quotes } = useQuotes(useMemo(() => top.map((s) => s.symbol), [top]))
  const filtered = useMemo(() => (index?.stocks ?? []).filter((s) => s.symbol.toLowerCase().includes(q.toLowerCase()) || s.name.toLowerCase().includes(q.toLowerCase())), [index, q])

  const cryptoAsset = CRYPTO_ASSETS.find((c) => c.s === selectedCrypto)
  const isCrypto = !!selectedCrypto && !selected
  const token = (isCrypto ? cryptoAsset?.a : selected?.address) as `0x${string}` | undefined
  const tradeSymbol = isCrypto ? selectedCrypto : selected?.symbol
  const decimalsIn = 18
  const decimalsOut = 18

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token, abi: erc20Abi, functionName: 'allowance',
    args: account && token ? [account, ROUTER] : undefined,
    query: { enabled: !!account && !!token && side === 'sell' },
  })

  useEffect(() => {
    if (side !== 'sell' || allowance == null || !amount) { setNeedsApproval(false); return }
    try { setNeedsApproval((allowance as bigint) < parseUnits(amount, decimalsIn)) } catch { setNeedsApproval(false) }
  }, [side, allowance, amount, decimalsIn])

  const requestQuote = async () => {
    if (!token || !amount) return
    if (isCrypto && cryptoAsset && cryptoAsset.swapable === false) {
      setQuoteError(`${tradeSymbol} pools live on the pons launchpad factory — direct swap coming via V4 router. Trade at pons launchpad for now.`)
      return
    }
    setPhase('quoting'); setQuoteError(null); setQuoteOut(null); setQuotePath(null)
    try {
      const amtWei = parseUnits(amount, decimalsIn)
      const res = await fetchQuote({ token, side, amountWei: amtWei.toString(), decimalsOut })
      if (!res.ok) { setQuoteError(res.error ?? 'No route found'); setPhase('idle'); return }
      setQuoteOut(res.amountOut ?? null); setQuotePath(res.path ?? null)
      setQuotePathLabel(res.label ? `via ${res.label.split('/').join(' → ')}` : '')
      setPhase('ready')
    } catch (e) { setQuoteError(e instanceof Error ? e.message : 'Quote failed'); setPhase('idle') }
  }

  const executeApprove = async () => {
    if (!token || !amount || !account) return
    setPhase('approving'); setTxError(null)
    try {
      const data = encodeApprove(ROUTER, parseUnits(amount, decimalsIn))
      const hash = await sendTransactionAsync({ to: token, data, chainId: 4663 })
      await waitForReceipt(hash)
      await refetchAllowance(); setPhase('ready')
    } catch (e) { setTxError(e instanceof Error ? e.message : 'Approve failed'); setPhase('ready') }
  }

  const executeSwap = async () => {
    if (!token || !quotePath || !quoteOut || !account) return
    if (isCrypto && cryptoAsset && cryptoAsset.swapable === false) return
    setPhase('swapping'); setTxError(null); setTxHash(null); setReceivedActual(null)
    try {
      const amtWei = parseUnits(amount, decimalsIn)
      const bps = BigInt(Math.round(slippagePct * 100))
      const outMin = BigInt(quoteOut) * (10000n - bps) / 10000n
      let ethBefore: bigint | null = null
      if (side === 'sell') {
        try { ethBefore = await publicClient.getBalance({ address: account }) } catch { ethBefore = null }
      }
      let data: `0x${string}`; let value: bigint = 0n
      if (side === 'buy') { const r = encodeBuyTx(account, quotePath, amtWei, outMin); data = r.data; value = r.value }
      else { data = encodeSellTx(account, quotePath, amtWei, outMin) }
      const hash = await sendTransactionAsync({ to: ROUTER, data, value, chainId: 4663 })
      setTxHash(hash)
      const receipt = await waitForReceipt(hash, 180_000, {
        wallet: account, token, decimals: decimalsOut, side, ethBefore,
      })
      if (receipt.status === 'success') {
        setReceivedActual(receipt.received ?? null)
        setPhase('success')
      } else if (receipt.status === 'reverted') {
        setTxError('Transaction reverted on-chain — try a higher slippage.'); setPhase('error')
      } else {
        setPhase('success')
      }
    } catch (e) { setTxError(e instanceof Error ? e.message : 'Swap failed'); setPhase('error') }
  }

  const outHuman = quoteOut ? Number(formatUnits(BigInt(quoteOut), decimalsOut)).toLocaleString(undefined, { maximumFractionDigits: 6 }) : null
  // price impact vs spot (stocks: Yahoo quote; crypto: dexscreener feed)
  const spotPrice = isCrypto
    ? cryptoRows.find((x) => x.s === tradeSymbol)?.price ?? null
    : (quotes[tradeSymbol ?? ''] as ApiQuote | undefined)?.price ?? null
  const priceImpactPct = (() => {
    if (!quoteOut || !spotPrice || !amount) return null
    try {
      const outAmt = Number(formatUnits(BigInt(quoteOut), decimalsOut))
      const inEth = Number(amount) // buy: ETH in; sell: token in
      if (side === 'buy') {
        const execPrice = inEth / outAmt // ETH per token
        // need ETH-USD: use status.eth_usd
        const ethUsd = status?.eth_usd ?? null
        if (!ethUsd) return null
        const execUsd = execPrice * ethUsd
        return (execUsd / spotPrice - 1) * 100
      }
      return null // sell impact needs token USD — skip for now
    } catch { return null }
  })()

  return (
    <div className="grid gap-5 max-lg:grid-cols-1">
      {/* token picker */}
      <div className="card order-2 max-h-[420px] overflow-y-auto lg:order-1">
        <div className="border-b px-4 py-2.5 sm:px-5" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-2" style={{ background: 'var(--field-alt)', borderRadius: 8, padding: '6px 10px' }}>
            <Search size={13} style={{ color: 'var(--ink-soft)', flexShrink: 0 }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search token…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" style={{ color: 'var(--ink)' }} />
          </div>
        </div>
        <div className="px-4 py-2 text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-dim)', borderBottom: '1px solid var(--line)' }}>Crypto · Robinhood Chain</div>
        {CRYPTO_ASSETS.filter((c) => !q || c.s.toLowerCase().includes(q.toLowerCase())).map((c) => (
          <button key={c.a} onClick={() => { setSelectedCrypto(c.s); setPhase('idle'); setQuoteOut(null) }}
            className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[var(--surface-raised)] sm:px-5"
            style={{ borderColor: 'var(--line)', background: selectedCrypto === c.s ? 'var(--field-alt)' : undefined }}>
            <span className="grid size-[22px] shrink-0 place-items-center rounded-full text-[8px] font-bold" style={{ background: 'linear-gradient(135deg, #8caaff, #ffb45a)', color: '#000' }}>{c.s.slice(0, 2)}</span>
            <span className="t-mono w-12 shrink-0 text-[12.5px] font-semibold">{c.s}</span>
            <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--ink-soft)' }}>{c.n}</span>
          </button>
        ))}
        <div className="px-4 py-2 text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-dim)', borderBottom: '1px solid var(--line)' }}>Stocks · tokenized</div>
        {filtered.slice(0, 40).map((s) => {
          const qt = quotes[s.symbol] as ApiQuote | undefined
          return (
            <button key={s.address} onClick={() => { setSelected(s); setPhase('idle'); setQuoteOut(null) }}
              className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[var(--surface-raised)] sm:px-5"
              style={{ borderColor: 'var(--line)', background: selected?.address === s.address ? 'var(--field-alt)' : undefined }}>
              <StockIcon symbol={s.symbol} size={22} />
              <span className="t-mono w-12 shrink-0 text-[12.5px] font-semibold">{s.symbol}</span>
              <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--ink-soft)' }}>{s.name}</span>
              {qt?.price != null && <span className="t-mono hidden text-[12px] sm:block">{fmtPrice(qt.price)}</span>}
              <span className={`t-mono hidden text-[11.5px] sm:block ${(qt?.change_pct ?? 0) >= 0 ? 'delta-up' : 'delta-down'}`}>{qt?.change_pct != null ? fmtPct(qt.change_pct) : '—'}</span>
              {selected?.address === s.address && <Check size={13} style={{ color: 'var(--signal)' }} />}
            </button>
          )
        })}
      </div>

      {/* swap ticket */}
      <div className="order-1 flex flex-col gap-4 lg:order-2">
        <div className="card overflow-hidden">
          <div className="border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
            <div className="flex gap-1.5">
              {(['buy', 'sell'] as const).map((s) => (
                <button key={s} onClick={() => { setSide(s); setPhase('idle'); setQuoteOut(null) }}
                  className="pill pill-sm" style={{ background: side === s ? (s === 'buy' ? 'var(--signal)' : 'var(--danger)') : 'transparent', color: side === s ? '#fff' : 'var(--ink-soft)', boxShadow: side === s ? 'none' : 'inset 0 0 0 1px var(--line)', textTransform: 'capitalize' }}>
                  {s}
                </button>
              ))}
              {selected && <span className="ml-auto flex items-center gap-1.5 text-[12.5px] font-medium"><StockIcon symbol={tradeSymbol} size={18} /> {tradeSymbol}</span>}
            </div>
          </div>
          <div className="flex flex-col gap-4 p-5">
            <div>
              <div className="flex items-center justify-between">
                <label className="t-small muted block">{side === 'buy' ? 'You pay (ETH)' : `You sell (${tradeSymbol ?? '—'})`}</label>
                {side === 'buy' && ethBalance && (
                  <button onClick={() => { setAmount(ethBalance.formatted); setPhase('idle'); setQuoteOut(null) }}
                    className="t-mono text-[11px]" style={{ color: 'var(--ink-soft)' }} title="Use full balance">
                    Balance: {Number(ethBalance.formatted).toFixed(4)} ETH · <span style={{ color: 'var(--ink)', fontWeight: 600 }}>MAX</span>
                  </button>
                )}
                {side === 'buy' && !isConnected && (
                  <span className="t-mono text-[11px]" style={{ color: 'var(--ink-dim)' }}>Connect wallet for balance</span>
                )}
              </div>
              <div className="relative mt-1">
                <input value={amount} onChange={(e) => { setAmount(e.target.value); setPhase('idle'); setQuoteOut(null) }}
                  className="w-full rounded-lg border px-3 py-3.5 pr-16 t-mono text-[20px] font-semibold outline-none focus:border-[var(--ink)]"
                  style={{ borderColor: 'var(--line)', background: 'var(--field-alt)' }} type="number" min="0" step="any" placeholder="0.0" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 t-mono text-[12px]" style={{ color: 'var(--ink-dim)' }}>
                  {side === 'buy' ? 'ETH' : selected?.symbol ?? ''}
                </span>
              </div>
            </div>
            {outHuman && (
              <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--signal-dim)' }}>
                <div className="t-small" style={{ color: 'var(--signal)' }}>You receive ≈ <strong>{outHuman}</strong> {side === 'buy' ? (tradeSymbol ?? '') : 'ETH'}</div>
                <div className="t-mono mt-1 text-[10.5px]" style={{ color: 'var(--ink-soft)' }}>
                  Min received: {Number(formatUnits(BigInt(quoteOut) * (10000n - BigInt(Math.round(slippagePct * 100))) / 10000n, decimalsOut)).toLocaleString(undefined, { maximumFractionDigits: 6 })} (slippage {slippagePct}%){quotePathLabel ? ` · ${quotePathLabel}` : ''}{priceImpactPct != null ? ` · impact ${priceImpactPct >= 0 ? '+' : ''}${priceImpactPct.toFixed(2)}%` : ''}
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="t-small muted" style={{ marginRight: 2 }}>Slippage</span>
              {[0.5, 1, 2, 3].map((s) => (
                <button key={s} onClick={() => setSlippagePct(s)}
                  className="t-mono rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                  style={{
                    background: slippagePct === s ? 'var(--accent)' : 'var(--field-alt)',
                    color: slippagePct === s ? 'var(--field)' : 'var(--ink-soft)',
                    boxShadow: slippagePct === s ? 'none' : 'inset 0 0 0 1px var(--line)',
                  }}>
                  {s}%
                </button>
              ))}
            </div>
            {quoteError && <p className="t-small" style={{ color: 'var(--danger)' }}>{quoteError}</p>}
            {txError && <p className="t-small" style={{ color: 'var(--danger)' }}>{txError}</p>}
            {txHash && phase === 'success' && (
              <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--signal-dim)' }}>
                <a href={explorerTx(txHash)} target="_blank" rel="noreferrer" className="t-small flex items-center gap-1" style={{ color: 'var(--signal)' }}>
                  <Check size={12} /> Swap confirmed <ExternalLink size={11} />
                </a>
                {receivedActual && (
                  <div className="t-mono mt-1 text-[10.5px]" style={{ color: 'var(--ink-soft)' }}>
                    Actually received: <strong style={{ color: 'var(--ink)' }}>{receivedActual}</strong> {side === 'buy' ? (tradeSymbol ?? '') : 'ETH'} — read from the on-chain receipt, not the quote.
                  </div>
                )}
              </div>
            )}
            {!isConnected ? (
              <button onClick={() => open()}
                className="w-full rounded-xl py-3.5 text-[14px] font-semibold transition-transform active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #f2f2f4, #c9c9d2)', color: '#0d0d0d', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
                Connect wallet to trade
              </button>
            ) : phase === 'idle' || phase === 'quoting' ? (
              <button onClick={requestQuote} disabled={phase === 'quoting' || !selected}
                className="w-full rounded-xl py-3.5 text-[14px] font-semibold transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #f2f2f4, #c9c9d2)', color: '#0d0d0d', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
                {phase === 'quoting' ? <><Loader2 size={14} className="animate-spin" /> Getting quote…</> : 'Get quote'}
              </button>
            ) : needsApproval && side === 'sell' ? (
              <button onClick={executeApprove} disabled={phase === 'approving'}
                className="w-full rounded-xl py-3.5 text-[14px] font-semibold transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #ffb45a, #e8933a)', color: '#1a1208', boxShadow: '0 4px 14px rgba(232,147,58,0.3)' }}>
                {phase === 'approving' ? <><Loader2 size={14} className="animate-spin" /> Approving…</> : `Approve ${tradeSymbol}`}
              </button>
            ) : (
              <button onClick={executeSwap} disabled={phase === 'swapping'}
                className="w-full rounded-xl py-3.5 text-[14px] font-semibold transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: side === 'buy' ? 'var(--signal)' : 'var(--danger)', color: '#fff', boxShadow: side === 'buy' ? '0 4px 14px rgba(16,185,129,0.3)' : '0 4px 14px rgba(239,68,68,0.3)' }}>
                {phase === 'swapping' ? <><Loader2 size={14} className="animate-spin" /> Swapping…</> : `Swap ${side === 'buy' ? `${amount} ETH → ${tradeSymbol}` : `${amount} ${tradeSymbol} → ETH`}`}
              </button>
            )}
            {status && (
              <p className="t-mono text-center text-[10.5px]" style={{ color: 'var(--ink-soft)' }}>
                gas {status.gas_price_gwei?.toFixed(3) ?? '—'} gwei{status.eth_usd ? ` · ETH $${status.eth_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ''}
              </p>
            )}
          </div>
        </div>
        <p className="t-small muted text-center">
          Non-custodial — swaps execute from your own wallet on Robinhood Chain (4663) via Uniswap v3.
          Stocks & crypto.{' '}
          <button onClick={onDocs} className="underline hover:text-[var(--ink)]">Read the docs</button>
        </p>
      </div>
    </div>
  )
}

/* ─── main export ─── */
export function MarketsView({ onDocs }: { onDocs: () => void }) {
  const [tab, setTab] = useState<Tab>('market')
  const [tradeSymbol, setTradeSymbol] = useState<string | undefined>(undefined)
  const [movers, setMovers] = useState<ApiMovers | null>(null)
  const [sectors, setSectors] = useState<ApiSector[]>([])
  const [moversError, setMoversError] = useState(false)
  const [tokenAddresses, setTokenAddresses] = useState<Map<string, string>>(new Map())

  const load = () => {
    setMoversError(false)
    api.getMovers(10).then(setMovers).catch(() => setMoversError(true))
    api.getSectors().then((d) => setSectors(d.sectors)).catch(() => {})
  }
  useEffect(load, [])

  useEffect(() => {
    api.getIndex().then((index) => {
      setTokenAddresses(new Map(index.stocks.map((s) => [s.symbol, s.address])))
    }).catch(() => {})
  }, [])

  const goTrade = (sym: string) => { setTradeSymbol(sym); setTab('trade') }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'market', label: 'Market', icon: <Activity size={14} /> },
    { id: 'trade', label: 'Trade', icon: <ArrowLeftRight size={14} /> },
    { id: 'index', label: 'Index', icon: <Layers size={14} /> },
  ]

  return (
    <div className="flex flex-col">
      {/* live movers ticker at the very top */}
      <MoversStrip movers={movers} />

      <div className="w-full px-4 py-6 sm:px-6 sm:py-8">
        {/* page title + tabs */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[1.375rem] font-bold tracking-tight sm:text-[1.75rem]">Markets</h1>
            <p className="mt-0.5 text-[13px]" style={{ color: 'var(--ink-soft)' }}>Live quotes · swap in-app · full basket</p>
          </div>
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--field-alt)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all"
                style={{
                  background: tab === t.id ? 'var(--surface)' : 'transparent',
                  color: tab === t.id ? 'var(--ink)' : 'var(--ink-soft)',
                  boxShadow: tab === t.id ? 'var(--shadow-card)' : 'none',
                }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* tab panels */}
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: EASE }}>
            {tab === 'market' && <MarketTab onTrade={goTrade} movers={movers} sectors={sectors} moversError={moversError} load={load} tokenAddresses={tokenAddresses} />}
            {tab === 'trade' && <TradeTab initialSymbol={tradeSymbol} onDocs={onDocs} />}
            {tab === 'index' && <IndexTab onTradeSymbol={goTrade} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
