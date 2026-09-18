import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, CheckCircle2, XCircle, RefreshCw, GitBranch, Landmark, Radio, LineChart } from 'lucide-react'
import { api, type ApiDistributions, type ApiMovers } from '@/lib/api'
import { fetchTradeStatus, type TradeStatus } from '@/lib/swap'

const EASE = [0.22, 1, 0.36, 1] as const

interface Row {
  icon: React.ReactNode
  name: string
  detail: string
  ok: boolean | null
}

const CHANGELOG = [
  { v: '0.4.0', d: 'In-app trading — swap the basket on Robinhood Chain without leaving the page (quote proxy + client-signed multicall). Market view: tape, movers across all 193, sector heat, charts. Payout basket (19) separated from the tradeable universe.' },
  { v: '0.3.0', d: 'Distribution view — the public payout record with the fee-loop explanation and the curated 19-instrument basket. Docs expanded: install the skill from GitHub, MCP wiring, memory, finance.' },
  { v: '0.2.0', d: 'Browse without a wallet. Round agent icons. Live market data (Yahoo spark proxy) with honest empty states. Portfolio, History, Index views.' },
  { v: '0.1.0', d: 'First cut: agent catalogue, wallet-gated runs, SQLite memory, MCP server.' },
]

/**
 * Status — honest system status, Kumo-style. Every row checks a REAL
 * subsystem and shows exactly what it found; nothing is a decorative
 * green light. Also carries the changelog, because a status page that
 * never says what shipped is just decoration.
 */
export function StatusView() {
  const [rows, setRows] = useState<Row[]>([])
  const [checking, setChecking] = useState(false)

  const check = async () => {
    setChecking(true)
    const next: Row[] = []

    // 1. API
    try {
      await api.health()
      next.push({ icon: <Radio size={15} />, name: 'Cluster API', detail: 'responding', ok: true })
    } catch (e) {
      next.push({ icon: <Radio size={15} />, name: 'Cluster API', detail: (e as Error).message.slice(0, 80), ok: false })
    }

    // 2. Chain
    try {
      const s: TradeStatus = await fetchTradeStatus()
      next.push({
        icon: <Landmark size={15} />,
        name: 'Robinhood Chain (4663)',
        detail: s.rpc_ok
          ? `block ${s.block?.toLocaleString()} · gas ${s.gas_price_gwei} gwei${s.eth_usd ? ` · ETH $${s.eth_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ''}`
          : 'RPC unreachable',
        ok: s.rpc_ok,
      })
    } catch (e) {
      next.push({ icon: <Landmark size={15} />, name: 'Robinhood Chain (4663)', detail: (e as Error).message.slice(0, 80), ok: false })
    }

    // 3. Market feed
    try {
      const m: ApiMovers = await api.getMovers(1)
      next.push({
        icon: <LineChart size={15} />,
        name: 'Market feed',
        detail: `${m.covered}/${m.universe} instruments covered · updated ${m.fetched_at.slice(11, 16)}Z`,
        ok: m.covered > 0,
      })
    } catch (e) {
      next.push({ icon: <LineChart size={15} />, name: 'Market feed', detail: (e as Error).message.slice(0, 80), ok: false })
    }

    // 4. Distribution feed
    try {
      const d: ApiDistributions = await api.getDistributions()
      next.push({
        icon: <Activity size={15} />,
        name: 'Distribution feed',
        detail: d.live ? `${d.totals.cycles} cycles · $${d.totals.distributed_usd.toLocaleString()}` : 'Cooming soon — $CLST has not launched',
        ok: d.live,
      })
    } catch (e) {
      next.push({ icon: <Activity size={15} />, name: 'Distribution feed', detail: (e as Error).message.slice(0, 80), ok: false })
    }

    setRows(next)
    setChecking(false)
  }

  useEffect(() => {
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto w-full max-w-[880px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <h1 className="t-display max-w-[560px]">
            Status
            <span className="block" style={{ color: 'var(--ink-soft)' }}>What's up right now.</span>
          </h1>
          <p className="t-lead muted mt-4 max-w-[540px]">
            Live checks against every subsystem the app depends on — and the changelog of what actually shipped.
          </p>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
          onClick={check}
          whileTap={{ scale: 0.96 }}
          className="pill pill-surface pill-sm flex items-center gap-1.5"
        >
          <RefreshCw size={13} className={checking ? 'animate-spin' : ''} /> Re-check
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.12 }}
        className="card mt-8 overflow-hidden"
      >
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--line)', background: 'var(--surface-raised)' }}>
          <span className="flex items-center gap-2 text-[13.5px] font-medium">
            <span className={rows.some((r) => r.ok) ? 'live-dot' : ''} /> Subsystems
          </span>
          <span className="t-mono text-[11px]" style={{ color: 'var(--ink-soft)' }}>
            AUTO-REFRESH 60s
          </span>
        </div>
        {rows.length === 0 && <p className="t-small muted px-5 py-8 text-center">Checking…</p>}
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-3.5 border-b px-5 py-3.5 last:border-b-0" style={{ borderColor: 'var(--line)' }}>
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
              style={{ background: 'var(--surface-raised)', boxShadow: 'inset 0 0 0 1px var(--line)', color: 'var(--ink-soft)' }}
            >
              {r.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium">{r.name}</p>
              <p className="t-small muted truncate">{r.detail}</p>
            </div>
            {r.ok === true && <CheckCircle2 size={17} style={{ color: 'var(--signal)', flexShrink: 0 }} />}
            {r.ok === false && <XCircle size={17} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
          </div>
        ))}
        <p className="t-small muted border-t px-5 py-3" style={{ borderColor: 'var(--line)' }}>
          The distribution feed showing "Cooming soon" is the honest state, not an outage — there is nothing to
          distribute until $CLST ships.
        </p>
      </motion.div>

      {/* changelog */}
      <div className="mt-10">
        <h2 className="flex items-center gap-2.5 text-[19px] font-medium">
          <GitBranch size={17} /> Changelog
        </h2>
        <div className="card mt-4 overflow-hidden">
          {CHANGELOG.map((c) => (
            <div key={c.v} className="flex gap-4 border-b px-5 py-4 last:border-b-0" style={{ borderColor: 'var(--line)' }}>
              <span className="t-mono w-[52px] shrink-0 text-[12.5px] font-medium" style={{ color: 'var(--signal)' }}>
                {c.v}
              </span>
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {c.d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
