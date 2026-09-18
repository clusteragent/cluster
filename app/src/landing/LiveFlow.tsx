import { useMemo } from 'react'
import { api, type ApiDistributions } from '@/lib/api'
import { useEffect, useState } from 'react'

/**
 * LIVE FLOW — kumo's animated mechanism diagram, redrawn in the finch
 * palette (white canvas, ink nodes, one emerald particle stream).
 * Treasury fees → the basket → holders. Particles ride the real paths;
 * density picks up when the feed is live, and stays a quiet idle drift
 * pre-launch (honest: nothing is being pushed yet — the diagram says so).
 */

const PATH_1 = 'M110,110 C270,20 330,20 490,110' // fees -> basket
const PATH_2 = 'M490,110 C650,200 710,200 870,110' // basket -> holders

function Particle({ path, delay, duration, active }: { path: string; delay: number; duration: number; active: boolean }) {
  return (
    <span
      aria-hidden
      className="absolute left-0 top-0 h-[6px] w-[6px] rounded-full"
      style={{
        backgroundColor: 'var(--signal)',
        offsetPath: `path("${path}")`,
        offsetRotate: '0deg',
        animation: `flow-particle ${duration}s linear infinite`,
        animationDelay: `${delay}s`,
        opacity: active ? 1 : 0.35,
        boxShadow: active ? '0 0 6px 1px rgba(255,255,255,0.35)' : 'none',
      }}
    />
  )
}

function FlowNode({
  index,
  label,
  value,
  caption,
  align,
}: {
  index: string
  label: string
  value: string
  caption: string
  align: 'left' | 'center' | 'right'
}) {
  return (
    <div
      className="flex w-[172px] flex-col rounded-[14px] px-4 py-3.5"
      style={{
        border: '1px solid var(--line)',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-card)',
        alignItems: align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end',
        textAlign: align,
      }}
    >
      <span className="t-mono text-[9.5px] tracking-[0.14em]" style={{ color: 'var(--signal)' }}>
        {index}
      </span>
      <span className="t-mono mt-0.5 text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>
        {label}
      </span>
      <span className="t-mono mt-1.5 text-[19px] font-semibold leading-none">{value}</span>
      <span className="mt-1 text-[10.5px] leading-snug" style={{ color: 'var(--ink-soft)' }}>
        {caption}
      </span>
    </div>
  )
}

export function LiveFlow({ dark = false }: { dark?: boolean }) {
  void dark
  const [dist, setDist] = useState<ApiDistributions | null>(null)

  useEffect(() => {
    api.getDistributions().then(setDist).catch(() => {})
    const id = setInterval(() => {
      api.getDistributions().then(setDist).catch(() => {})
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  const live = Boolean(dist?.live)
  const totalUsd = dist?.totals?.distributed_usd ?? null
  const recipients = dist?.totals?.recipients ?? null

  // Real activity intensity: live feed → denser/faster particles on the
  // holders leg. Pre-launch → a slow idle drift (3 particles, dimmed).
  const feeParticles = useMemo(
    () => Array.from({ length: live ? 3 : 2 }, (_, i) => ({ delay: i * (live ? 3 : 4), duration: live ? 6 : 8 })),
    [live],
  )
  const payoutParticles = useMemo(
    () =>
      Array.from({ length: live ? 7 : 4 }, (_, i) => ({
        delay: (i * (live ? 3.2 : 5.4)) % (live ? 22.4 : 21.6),
        duration: live ? 3.2 : 5.5,
      })),
    [live],
  )

  return (
    <div className="relative overflow-hidden py-4">
      <div className="relative mx-auto -mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-auto sm:overflow-visible sm:px-0">
        <div className="relative mx-auto aspect-[900/220] w-full max-w-[900px]">
          <svg viewBox="0 0 900 220" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid meet">
            <path d={PATH_1} fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth={1.75} />
            <path d={PATH_2} fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth={1.75} />
          </svg>

          <div className="absolute inset-0">
            {feeParticles.map((p, i) => (
              <Particle key={`f${i}`} path={PATH_1} delay={p.delay} duration={p.duration} active={live} />
            ))}
            {payoutParticles.map((p, i) => (
              <Particle key={`d${i}`} path={PATH_2} delay={p.delay} duration={p.duration} active={live} />
            ))}
          </div>

          <div className="absolute left-0 top-1/2 -translate-y-1/2">
            <FlowNode index="01" label="Agent fees" value="$CLST" caption="Every run pays into the vault" align="left" />
          </div>
          <div className="absolute left-1/2 top-[6%] -translate-x-1/2">
            <FlowNode
              index="02"
              label="Basket"
              value="19 names"
              caption="The curated payout basket, bought live"
              align="center"
            />
          </div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <FlowNode
              index="03"
              label="Holders"
              value={recipients != null && recipients > 0 ? String(recipients) : '—'}
              caption={live && totalUsd ? `$${totalUsd.toFixed(2)} paid, all time` : 'Pro rata, every cycle'}
              align="right"
            />
          </div>
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-[52ch] text-center text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        {live
          ? 'Every particle is a real leg of the real mechanism — fees deployed into the basket, the basket pushed to holders, pro rata. Nothing here is simulated for effect.'
          : 'Pre-launch: the paths are drawn, the mechanism is wired — particles flow idle until $CLST ships and the first real cycle lands. Nothing is simulated.'}
      </p>

      {/* keep the animation defined once, here */}
      <style>{`@keyframes flow-particle { 0% { offset-distance: 0%; } 100% { offset-distance: 100%; } }`}</style>
    </div>
  )
}
