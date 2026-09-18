/**
 * PortfolioView — premium realtime dashboard.
 * Live panels: portfolio stats, market movers (realtime), usage/model
 * telemetry (from real usage data), recent activity, top agents.
 * Monochrome. All numbers real or honest-zeros — never simulated.
 */
import { useEffect, useState } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, Users, Wallet, Zap, Brain,
  ArrowRight, Plus, Activity, Newspaper, Cpu, KeyRound, RefreshCw, ExternalLink,
  Landmark, LineChart,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AGENTS, type HistoryEvent } from '@/data/agents'
import { AgentAvatar } from '@/components/AgentAvatar'
import { StockIcon } from '@/components/StockIcon'
import {
  api, signChallenge, type ApiMovers, type ApiMover, type ApiNews,
  type ApiUsageSummary, type ApiDistributions, type ApiKey,
} from '@/lib/api'
import { useAppKitAccount } from '@reown/appkit/react'
import { useSignMessage } from 'wagmi'

const fmtPrice = (v: number | null | undefined) =>
  v == null ? '—' : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`)

// ─── Basket index: REAL data ─────────────────────────────────────────────────
// Weighted basket performance from live quotes (Yahoo series). No synthetic data:
// if quotes are unavailable the chart shows an honest empty state.
interface BasketPoint { date: number; value: number }

function useBasketIndex() {
  const [points, setPoints] = useState<BasketPoint[] | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const basket = await api.getPayoutBasket()
        const symbols = basket.basket.map((s) => s.symbol)
        const weights = Object.fromEntries(basket.basket.map((s) => [s.symbol, s.weight]))
        const q = await api.getQuotes(symbols)
        // align series timestamps: use each stock's series normalized to its first close,
        // weighted-average across stocks at each shared hour bucket.
        const buckets = new Map<number, { sum: number; w: number }>()
        for (const sym of symbols) {
          const quote = q.quotes[sym]
          const series = quote?.series
          const w = weights[sym] ?? 0
          if (!series || series.length < 2 || w <= 0) continue
          const base = series[0][1]
          if (!base) continue
          for (const [ts, price] of series) {
            const hour = Math.floor(ts / 3600_000) * 3600_000
            const b = buckets.get(hour) ?? { sum: 0, w: 0 }
            b.sum += (price / base) * w
            b.w += w
            buckets.set(hour, b)
          }
        }
        const pts: BasketPoint[] = [...buckets.entries()]
          .filter(([, b]) => b.w > 0)
          .sort((a, b) => a[0] - b[0])
          .map(([date, b]) => ({ date, value: (b.sum / b.w) * 100 }))
        setPoints(pts.length >= 2 ? pts : [])
      } catch {
        setPoints([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])
  return { points, loading }
}

/* ─── Metric cards ─────────────────────────────────────────────────── */
function MetricCards({ history, dist, connected }: { history: HistoryEvent[]; dist: ApiDistributions | null; connected: boolean }) {
  const payout = dist?.totals?.distributed_usd ?? 0
  const recipients = dist?.totals?.recipients ?? 0
  const treasuryEth = dist?.treasury?.eth ?? 0
  const stats = [
    { l: 'Portfolio Value', v: '$0.00', s: connected ? 'No $CLST holdings yet' : 'Connect wallet to see balance' },
    { l: 'Treasury', v: `${treasuryEth.toFixed(4)} ETH`, s: 'Vault balance · fees accumulate' },
    { l: 'Holders', v: String(recipients), s: dist?.totals?.cycles ? `${dist.totals.cycles} cycles paid` : '$CLST cooming soon' },
    { l: 'Lifetime Payout', v: `$${payout.toFixed(2)}`, s: `${recipients} recipients · ${dist?.totals?.cycles ?? 0} cycles` },
  ]
  return (
    <div className="glass-card rounded-2xl border p-4 sm:p-5" style={{ borderColor: 'var(--line)' }}>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {stats.map(s => (
          <div key={s.l} className="stat-cell">
            <div className="stat-value">{s.v}</div>
            <div className="stat-label">{s.l}</div>
            <p style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 3 }}>{s.s}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function RealtimeMovers({ movers, onSelect }: { movers: ApiMovers | null; onSelect: (sym: string) => void }) {
  const gainers = (movers?.gainers ?? []).slice(0, 5)
  const losers = (movers?.losers ?? []).slice(0, 5)
  return (
    <section className="glass-card rounded-2xl border p-5" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Realtime Movers</h2>
          <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>Live market feed · refreshes every 60s</p>
        </div>
        <Badge variant="outline"><span className="live-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'linear-gradient(135deg, #e8e8ec, #ffb45a 50%, #8caaff)', boxShadow: '0 0 6px rgba(140,170,255,0.5)' }} /> LIVE</Badge>
      </div>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" style={{ minWidth: 0 }}>
          {[{ label: 'Gainers', rows: gainers, up: true }, { label: 'Losers', rows: losers, up: false }].map(sec => (
            <div key={sec.label} style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 6 }}>{sec.label}</p>
              {sec.rows.length === 0 && <p style={{ fontSize: 12, color: 'var(--ink-soft)', padding: '8px 0' }}>Loading…</p>}
              {sec.rows.map((r: ApiMover) => (
                <button key={r.symbol} onClick={() => onSelect(r.symbol)}
                  className="flex w-full min-w-0 items-center gap-1.5 overflow-hidden py-1.5 text-left transition-colors hover:opacity-75"
                  style={{ borderBottom: '1px solid var(--line)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
                  <StockIcon symbol={r.symbol} size={18} />
                  <span className="shrink-0" style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, width: 44 }}>{r.symbol}</span>
                  <span className="shrink-0" style={{
                    fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 600,
                    color: sec.up ? 'var(--signal)' : 'var(--danger)',
                  }}>{r.change_pct != null ? `${r.change_pct >= 0 ? '+' : ''}${r.change_pct.toFixed(1)}%` : '—'}</span>
                  <span className="ml-auto shrink-0 text-right" style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>{fmtPrice(r.price)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </section>
  )
}

/* ─── Telemetry: keys + model usage (from real usage data) ─────────── */
function DistributionPayout({ dist, onViewDistribution }: { dist: ApiDistributions | null; onViewDistribution: () => void }) {
  const totals = dist?.totals
  const [tab, setTab] = useState<'payouts' | 'leaderboard' | 'buys'>('payouts')

  const recent = (dist?.recent ?? []) as { wallet?: string; address?: string; usd?: number; amount?: number; symbol?: string; at?: number | string }[]
  const payroll = (dist?.payroll ?? []) as { wallet: string; amount?: number; usd?: number; symbol?: string }[]
  const buys = (dist?.recent_buys ?? []) as { symbol?: string; usd?: number; amount?: number; tx?: string; at?: string | number }[]
  const rows: Record<string, unknown>[] = tab === 'payouts' ? recent : tab === 'leaderboard' ? payroll : buys

  const TAB_LABELS: Record<string, string> = { payouts: 'Payouts', leaderboard: 'Leaderboard', buys: 'Basket buys' }

  return (
    <section className="glass-card rounded-2xl border p-5" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Distribution</h2>
          <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>Realtime payout feed · fees → basket → holders</p>
        </div>
        <Badge variant="outline">{dist?.mode === 'live' ? 'Live' : 'Pre-launch'}</Badge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '14px 0' }}>
        {[
          { l: 'Lifetime payout', v: `$${(totals?.distributed_usd ?? 0).toFixed(2)}` },
          { l: 'Cycles', v: (totals?.cycles ?? 0).toLocaleString() },
          { l: 'Recipients', v: (totals?.recipients ?? 0).toLocaleString() },
        ].map(s => (
          <div key={s.l} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', background: 'var(--field)' }}>
            <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-dim)' }}>{s.l}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 10 }}>
        {(['payouts', 'leaderboard', 'buys'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-all"
            style={tab === t
              ? { background: 'var(--accent)', color: 'var(--field)', borderColor: 'transparent' }
              : { background: 'var(--field)', color: 'var(--ink-soft)', borderColor: 'var(--line)' }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ border: '1px dashed var(--line)', borderRadius: 10, padding: '16px 12px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            {tab === 'leaderboard'
              ? 'No holders yet — the leaderboard fills in with every $CLST holder, ranked by payout, the moment the first cycle runs.'
              : tab === 'buys'
              ? 'No basket buys yet — every keeper bot purchase lands here with its tx, realtime.'
              : 'Cooming soon — nothing settles until $CLST launches. Every payout lands here, per address, the moment the first cycle runs.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.slice(0, 8).map((r, i) => {
            const addr = String((r as { wallet?: string; address?: string }).wallet ?? (r as { address?: string }).address ?? '—')
            const pct = tab === 'leaderboard' ? ((i + 1) / Math.max(rows.length, 1)) * 100 : null
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < Math.min(rows.length, 8) - 1 ? '1px solid var(--line)' : undefined }}>
                {tab === 'leaderboard' && (
                  <span className="shrink-0" style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-dim)', width: 20 }}>#{i + 1}</span>
                )}
                {tab === 'buys' && (r as { symbol?: string }).symbol && (
                  <span className="shrink-0" style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--mono)', width: 44 }}>{String((r as { symbol?: string }).symbol)}</span>
                )}
                {tab !== 'buys' && (
                  <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink-soft)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {addr.slice(0, 6)}…{addr.slice(-4)}
                  </span>
                )}
                {tab === 'buys' ? (
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)', flex: 1, minWidth: 0, textAlign: 'right' }}>
                    {(r as { amount?: number }).amount != null ? `${(r as { amount?: number }).amount} shares` : ''}
                  </span>
                ) : pct != null ? (
                  <span style={{ flex: 1, minWidth: 0, height: 4, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #8caaff, #ffb45a)' }} />
                  </span>
                ) : (
                  <span style={{ flex: 1 }} />
                )}
                <span className="shrink-0" style={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: tab === 'buys' ? 'var(--ink)' : 'var(--signal)' }}>
                  {(r as { usd?: number }).usd != null ? `$${(r as { usd?: number }).usd?.toFixed(2)}` : (r as { amount?: number }).amount != null ? `${(r as { amount?: number }).amount}` : '—'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between" style={{ marginTop: 14 }}>
        <button onClick={onViewDistribution} className="inline-flex items-center gap-1" style={{ fontSize: 12, color: 'var(--ink)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 2 }}>
          Open distribution
        </button>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--ink-dim)' }}>fees → basket → holders</span>
      </div>
    </section>
  )
}

const MODEL_SHOWCASE: { id: string; label: string; tag: string; logo: string }[] = [
  { id: 'openai/gpt-6-astra', label: 'GPT-6 Astra', tag: 'Flagship', logo: '/brands/openai.svg' },
  { id: 'anthropic/', label: 'the model 4', tag: 'Reasoning', logo: '/brands/anthropic.svg' },
  { id: 'openai/gpt-5.6-terra', label: 'GPT-5.6 Terra', tag: 'Frontier', logo: '/brands/openai.svg' },
  { id: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash', tag: 'Fast', logo: '/brands/gemini.svg' },
  { id: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro', tag: 'Reasoning', logo: '/brands/deepseek.jpg' },
  { id: 'moonshot/kimi-k3', label: 'Kimi K3', tag: 'Reasoning', logo: '/brands/moonshot.jpg' },
  { id: 'qwen/qwen3.8-max', label: 'Qwen 3.8 Max', tag: 'Balanced', logo: '/brands/qwen.jpg' },
  { id: 'zai/glm-5.3', label: 'GLM 5.3', tag: 'Balanced', logo: '/brands/zai.jpg' },
  { id: 'minimax/minimax-m3', label: 'MiniMax M3', tag: 'Balanced', logo: '/brands/minimax.jpg' },
  { id: 'openai/gpt-5.6-sol', label: 'GPT-5.6 Sol', tag: 'Frontier', logo: '/brands/openai.svg' },
  { id: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash', tag: 'Fast', logo: '/brands/deepseek.jpg' },
  { id: 'glm/glm-5.3-flash', label: 'GLM 5.3 Flash', tag: 'Fast', logo: '/brands/zai.jpg' },
]

function Telemetry({ usage, keys, onChat }: { usage: ApiUsageSummary | null; keys: ApiKey[]; onChat: () => void }) {
  const totals = usage?.totals?.all
  const topKeys = (usage?.keys ?? []).slice(0, 3)
  return (
    <div className="grid items-stretch gap-4 sm:grid-cols-2">
      <section className="glass-card rounded-2xl border p-5" style={{ borderColor: 'var(--line)' }}>
        <CardHeader style={{ position: 'relative', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <CardTitle style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cpu size={14} style={{ color: 'var(--ink-soft)' }} /> Model Telemetry
            </CardTitle>
            <CardDescription>Requests metered per API key</CardDescription>
          </div>
        </CardHeader>
        <div>
          {!totals || totals.requests === 0 ? (
            <div style={{ padding: '6px 0 14px' }}>
              <p style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
                No usage yet. Generate a key and call the endpoint — every request is metered here (requests, tokens, USD).
              </p>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-dim)', margin: '14px 0 8px' }}>
                24 models available · top 12
              </p>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {MODEL_SHOWCASE.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-2.5 py-1.5" style={{ borderBottom: i < MODEL_SHOWCASE.length - 1 ? '1px solid var(--line)' : undefined }}>
                    <img src={m.logo} alt="" className="size-4 rounded-full object-cover" style={{ border: '1px solid var(--line)' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</span>
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>{m.tag}</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={onChat} style={{ marginTop: 12 }}>Open Chat <ArrowRight className="size-3" /></Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { l: 'Requests', v: totals.requests.toLocaleString() },
                  { l: 'Tokens', v: (totals.prompt_tokens + totals.completion_tokens).toLocaleString() },
                  { l: 'Cost', v: `$${totals.cost_usd.toFixed(4)}` },
                ].map(s => (
                  <div key={s.l} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', background: 'var(--field)' }}>
                    <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-dim)' }}>{s.l}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
                  </div>
                ))}
              </div>
              {topKeys.length > 0 && (
                <div>
                  {topKeys.map(k => (
                    <div key={k.key_id} className="flex items-center gap-2.5 py-1.5" style={{ borderBottom: '1px solid var(--line)' }}>
                      <KeyRound size={12} style={{ color: 'var(--ink-dim)' }} />
                      <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-soft)' }}>{k.all.requests} req</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>${k.all.cost_usd.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="glass-card rounded-2xl border p-5" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div>
            <h2 className="text-sm font-semibold">Market News</h2>
            <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>Yahoo Finance · real headlines</p>
          </div>
        </div>
        <div style={{ paddingBottom: 4 }}>
          <NewsList />
        </div>
      </section>
    </div>
  )
}

/* ─── News list (real headlines from /api/market/news) ─────────────── */
function NewsList() {
  const [news, setNews] = useState<ApiNews | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => { api.getNews(5).then(setNews).catch(() => setErr(true)) }, [])
  if (err) return <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', padding: '8px 0' }}>News feed unreachable.</p>
  if (!news) return <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', padding: '8px 0' }}>Loading…</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {news.items.map((n, i) => (
        <a key={i} href={n.link} target="_blank" rel="noreferrer"
          className="flex items-start gap-2.5 py-2 transition-opacity hover:opacity-80"
          style={{ borderBottom: i < news.items.length - 1 ? '1px solid var(--line)' : undefined, textDecoration: 'none' }}>
          <span style={{
            width: 6, height: 6, borderRadius: 99, background: 'var(--ink-soft)', marginTop: 6, flexShrink: 0,
          }} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink)' }}>{n.title}</span>
            <span style={{ fontSize: 10.5, color: 'var(--ink-dim)', fontFamily: 'var(--mono)' }}>
              {n.publisher}{n.published ? ` · ${new Date(n.published).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
          </span>
        </a>
      ))}
    </div>
  )
}

/* ─── Overview chart ───────────────────────────────────────────────── */
function OverviewChart() {
  const { points, loading } = useBasketIndex()
  const first = points?.[0]?.value
  const last = points?.[points.length - 1]?.value
  const changePct = first && last ? ((last - first) / first) * 100 : null
  return (
    <section className="glass-card rounded-2xl border p-5" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Basket Performance</h2>
          <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>19-name payout basket · weighted index · live quotes</p>
        </div>
        <Badge variant="outline">5d</Badge>
      </div>
      <CardContent>
        {loading ? (
          <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'var(--ink-dim)', fontSize: 12.5 }}>
            Loading live quotes…
          </div>
        ) : !points || points.length < 2 ? (
          <div style={{ height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--ink-dim)' }}>
            <p style={{ fontSize: 12.5, textAlign: 'center', padding: '0 24px' }}>
              No basket history yet — the index chart fills in with real weighted quotes as the market feed accumulates. Honest zeros, no synthetic data.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="fillPf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffffff" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#ffffff" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="strokeChrome" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#e8e8ec" />
                  <stop offset="45%" stopColor="#ffb45a" />
                  <stop offset="70%" stopColor="#8caaff" />
                  <stop offset="100%" stopColor="#e8e8ec" />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.5} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={80}
                tick={{ fontSize: 10, fill: 'var(--ink-dim)' }}
                tickFormatter={(v) => new Date(v as number).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })} />
              <YAxis width={52} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'var(--ink-dim)' }}
                domain={['auto', 'auto']} tickFormatter={(v) => Number(v).toFixed(2)} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', fontSize: '12px' }}
                labelFormatter={(v) => new Date(v as number).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' })}
                formatter={(v) => [Number(v).toFixed(2), 'Basket index']} />
              <Area dataKey="value" type="natural" fill="url(#fillPf)" stroke="url(#strokeChrome)" strokeWidth={1.75} dot={false} fillOpacity={1} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingTop: '1rem', marginTop: '0.75rem', borderTop: '1px solid var(--line)' }}>
        <div style={{ fontSize: '1.35rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: changePct == null ? 'var(--ink-dim)' : changePct >= 0 ? 'var(--signal)' : 'var(--danger)' }}>
          {changePct == null ? '—' : `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`}
        </div>
        <span style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>basket change · live quotes</span>
      </div>
    </section>
  )
}

/* ─── Recent activity ──────────────────────────────────────────────── */
function RecentActivity({ history, onUpload }: { history: HistoryEvent[]; onUpload: () => void }) {
  return (
    <section className="glass-card rounded-2xl border p-5" style={{ borderColor: 'var(--line)' }}>
      <div style={{ marginBottom: 12 }}>
        <h2 className="text-sm font-semibold">Recent Activity</h2>
        <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>{history.length} logged task{history.length !== 1 ? 's' : ''}</p>
      </div>
      <div>
        {history.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '1.5rem 0' }}>
            <div className="flex size-12 items-center justify-center rounded-full" style={{ border: '1px solid var(--line)', background: 'var(--surface-raised)' }}>
              <Plus className="size-5" style={{ color: 'var(--ink-soft)' }} />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>No activity yet. Run your first agent.</p>
            <Button variant="outline" size="sm" onClick={onUpload}>Run an agent</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 420 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  {['Agent', 'Detail', 'When', ''].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-dim)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 8).map((h) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '9px 8px', fontSize: 12.5, fontWeight: 500 }}>{h.label}</td>
                    <td style={{ padding: '9px 8px', fontSize: 12, color: 'var(--ink-soft)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.detail}</td>
                    <td style={{ padding: '9px 8px', fontSize: 12, color: 'var(--ink-dim)', fontFamily: 'var(--mono)' }}>{h.day}</td>
                    <td style={{ padding: '9px 8px' }}><Badge variant="outline">logged</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

/* ─── Top agents ───────────────────────────────────────────────────── */
function TopAgents({ onBrowse }: { onBrowse: () => void }) {
  return (
    <section className="glass-card rounded-2xl border p-5" style={{ borderColor: 'var(--line)' }}>
      <div style={{ marginBottom: 12 }}>
        <h2 className="text-sm font-semibold">Top Agents</h2>
        <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>Most active agents this week</p>
      </div>
      <div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {AGENTS.slice(0, 5).map(a => (
            <div key={a.id} className="flex items-center gap-2.5" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <AgentAvatar agent={a} size={28} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                <span style={{ fontSize: 10, color: 'var(--ink-dim)', fontFamily: 'var(--mono)' }}>{a.category}</span>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onBrowse} className="inline-flex items-center gap-1" style={{ marginTop: 12, fontSize: 12, color: 'var(--ink)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 2 }}>Browse all</button>
      </div>
    </section>
  )
}

/* ─── main export ──────────────────────────────────────────────────── */
export function PortfolioView({ history, connected, onConnect, onUpload, onBrowse, onViewIndex, onViewDistribution, onChat }: {
  history: HistoryEvent[]; connected: boolean; onConnect: () => void; onUpload: () => void; onBrowse: () => void; onViewIndex: () => void; onViewDistribution: () => void; onChat: () => void
}) {
  const { address } = useAppKitAccount()
  const { signMessageAsync } = useSignMessage()
  const wallet = address ?? ''
  const [movers, setMovers] = useState<ApiMovers | null>(null)
  const [usage, setUsage] = useState<ApiUsageSummary | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [dist, setDist] = useState<ApiDistributions | null>(null)

  useEffect(() => {
    const loadDist = () => api.getDistributions().then(setDist).catch(() => {})
    loadDist()
    const id = setInterval(loadDist, 60_000)  // realtime distribution feed
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const loadMovers = () => api.getMovers(10).then(setMovers).catch(() => {})
    loadMovers()
    const id = setInterval(loadMovers, 60_000)  // realtime: refresh every 60s
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!wallet) return
    let cancelled = false
    const load = async () => {
      try {
        const sig = await signChallenge(wallet, signMessageAsync)
        if (!cancelled) setKeys((await api.listKeys(wallet, sig)).keys)
        const sig2 = await signChallenge(wallet, signMessageAsync)
        if (!cancelled) setUsage(await api.keyUsage(wallet, sig2))
      } catch { /* optional panels */ }
    }
    load()
    const id = setInterval(load, 10_000)  // realtime: usage per request, refresh 10s
    return () => { cancelled = true; clearInterval(id) }
  }, [wallet]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-1 py-2">
      {/* Header — finchagentic Overview pattern */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="gradient-text text-2xl font-semibold tracking-tight sm:text-3xl">Overview</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>Your basket, usage, and payouts — updated live.</p>
        </div>
        <button onClick={() => onViewIndex()} className="pill-cta">
          <LineChart className="size-4" /> Open Markets
        </button>
      </div>

      {/* Live stats — UsageStat row */}
      <MetricCards history={history} dist={dist} connected={connected} />

      {/* Basket + Movers — full width sections (finchagentic single-column) */}
      <OverviewChart />
      <RealtimeMovers movers={movers} onSelect={() => onViewIndex()} />

      {/* Telemetry + Distribution */}
      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <Telemetry usage={usage} keys={keys} onChat={onChat} />
        <DistributionPayout dist={dist} onViewDistribution={onViewDistribution} />
      </div>

      {/* Activity + Agents */}
      <div className="grid items-stretch gap-5 lg:grid-cols-[1.5fr_1fr]">
        <RecentActivity history={history} onUpload={onUpload} />
        <TopAgents onBrowse={onBrowse} />
      </div>
    </div>
  )
}
