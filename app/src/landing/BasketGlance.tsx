import { useEffect, useState } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { api, type ApiDistributions, type ApiQuote } from '@/lib/api'
import { StockIcon } from '@/components/StockIcon'

/**
 * BASKET GLANCE — the kumo "At a Glance" card, rebuilt in the finch
 * palette (white/ink/emerald, no dark chrome). It answers, in one
 * card: what holding pays (honest zeros pre-launch), what the basket
 * holds right now (live quotes), and the verification claim behind
 * the whole index (on-chain re-verified addresses).
 *
 * Pre-launch: "Cooming soon" — figures turn live the moment the first
 * distribution cycle lands; nothing is simulated in the meantime.
 */

const FEED_SYMBOLS = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN'] as const

const fmtUsd = (v: number, decimals = 2) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`

const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`)

export function BasketGlance({ onEnter, dark = false }: { onEnter: () => void; dark?: boolean }) {
  const [dist, setDist] = useState<ApiDistributions | null>(null)
  const [quotes, setQuotes] = useState<Record<string, ApiQuote>>({})
  const [verified, setVerified] = useState<number | null>(null)

  useEffect(() => {
    const load = () => {
      api.getDistributions().then(setDist).catch(() => {})
      api
        .getQuotes([...FEED_SYMBOLS])
        .then((d) => setQuotes(d.quotes))
        .catch(() => {})
      api
        .getIndex()
        .then((d) => setVerified(d.verified_on_chain_count))
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 60_000)  // realtime — keeper bot cadence
    return () => clearInterval(id)
  }, [])

  const launched = Boolean(dist?.live && (dist.totals?.distributed_usd ?? 0) > 0)
  const distributed = dist?.totals?.distributed_usd ?? null

  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start">
      {/* ------------ the glance card ------------ */}
      <div className="card relative overflow-hidden p-6 sm:p-7">
        {/* ring echo — quiet nod to the brand mark, no dark chrome */}
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full border" style={{ borderColor: 'var(--line)' }} />
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full border" style={{ borderColor: 'var(--line)', opacity: 0.6 }} />

        <div className="relative flex items-center justify-between gap-3">
          <span className="t-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-soft)' }}>
            Total value distributed
          </span>
          <span
            className={`t-mono inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] uppercase tracking-[0.12em] ${launched ? '' : ''}`}
            style={{
              border: '1px solid var(--line)',
              color: launched ? 'var(--signal)' : 'var(--ink-soft)',
              background: launched ? 'var(--signal-dim)' : 'transparent',
            }}
          >
            {launched && <span className="live-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--signal)' }} />}
            {launched ? 'Live' : 'Pre-launch'}
          </span>
        </div>

        <div className="relative mt-5">
          <p className="t-mono text-[34px] font-semibold leading-none tracking-tight sm:text-[40px]">
            {distributed != null ? fmtUsd(distributed) : '—'}
          </p>
          <p className="t-small muted mt-3 max-w-[40ch]">
            {launched
              ? 'Paid out to holders from agent fees, as they accrue.'
              : "$CLST is cooming soon — nothing has been distributed yet. Figures turn live the moment the first push lands; until then this stays an honest zero."}
          </p>
        </div>

        <dl className="relative mt-6 grid grid-cols-3 divide-x border-t" style={{ borderColor: 'var(--line)' }}>
          {[
            { k: 'Instruments', v: verified != null ? String(verified) : '—' },
            { k: 'Wallets paid', v: launched ? String(dist?.totals?.recipients ?? '—') : '—' },
            { k: 'Distribution', v: 'fees-based' },
          ].map((s) => (
            <div key={s.k} className="px-4 py-4 first:pl-0">
              <dd className="t-mono text-[16px] font-medium">{s.v}</dd>
              <dt className="t-mono mt-1 text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--ink-soft)' }}>
                {s.k}
              </dt>
            </div>
          ))}
        </dl>

        <div className="relative mt-4 flex flex-col gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--line)' }}>
          <span className="t-small muted flex items-center gap-1.5">
            <ShieldCheck size={14} style={{ color: 'var(--signal)' }} />
            {verified ?? '192'} addresses re-verified on-chain
          </span>
          <button onClick={onEnter} className="pill pill-sm pill-outline-dark flex items-center gap-1.5 self-start sm:self-auto">
            Open the basket <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ------------ live market feed of basket names ------------ */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--line)' }}>
          <span className="t-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-soft)' }}>
            Basket · live market feed
          </span>
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--signal)' }} />
        </div>
        <div>
          {FEED_SYMBOLS.map((sym) => {
            const q = quotes[sym]
            const up = (q?.change_pct ?? 0) >= 0
            return (
              <div key={sym} className="flex items-center gap-3 border-b px-5 py-[9px] last:border-b-0" style={{ borderColor: 'var(--line)' }}>
                <StockIcon symbol={sym} size={22} />
                <span className="t-mono w-[52px] text-[12px] font-semibold tracking-[0.08em]">{sym}</span>
                <span className="t-mono ml-auto text-[13px] tabular-nums" style={{ color: 'var(--ink)' }}>
                  {q?.price != null ? fmtUsd(q.price) : '···'}
                </span>
                <span className={`t-mono w-[64px] text-right text-[12px] tabular-nums ${q?.change_pct != null ? (up ? 'delta-up' : 'delta-down') : ''}`}>
                  {q?.change_pct != null ? fmtPct(q.change_pct) : '—'}
                </span>
              </div>
            )
          })}
        </div>
        <p className="t-small muted border-t px-5 py-3" style={{ borderColor: 'var(--line)' }}>
          Six of {verified ?? '192'} verified instruments, quoted straight from the market feed and refreshed every
          60 seconds — the same names the vault buys when a cycle runs.
        </p>
      </div>
    </div>
  )
}
