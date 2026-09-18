import { useMemo } from 'react'
import { useEffect, useState } from 'react'
import { api, type ApiDistributions } from '@/lib/api'

/**
 * PAYOUT TICKER — kumo's ActivityTicker, in the finch palette: a thin,
 * always-on strip proving the engine is live. Real per-recipient payouts
 * scroll past, newest first. Renders NOTHING until the feed carries real
 * rows — pre-launch the strip simply doesn't exist (no placeholder rows,
 * no fabricated activity).
 */

interface Payout {
  address: string
  usd: number
  at: number
  lead?: string
  extra?: number
}

function relativeTime(at: number): string {
  const s = Math.max(1, Math.round((Date.now() - at) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`

export function PayoutTicker({ dark = false }: { dark?: boolean }) {
  void dark
  const [dist, setDist] = useState<ApiDistributions | null>(null)

  useEffect(() => {
    api.getDistributions().then(setDist).catch(() => {})
    const id = setInterval(() => {
      api.getDistributions().then(setDist).catch(() => {})
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  const items: Payout[] = useMemo(() => {
    const recent = (dist?.recent ?? []) as Array<{
      at?: number
      usd?: number
      recipients?: Array<{ address?: string; usd?: number; assets?: Array<{ sym?: string }> }>
    }>
    const out: Payout[] = []
    for (const cycle of recent) {
      for (const r of cycle.recipients ?? []) {
        if (!r.address || r.usd == null) continue
        const assets = (r.assets ?? []).filter((a) => a.sym)
        out.push({
          address: r.address,
          usd: r.usd,
          at: cycle.at ?? 0,
          lead: assets[0]?.sym,
          extra: Math.max(0, assets.length - 1),
        })
      }
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 20)
  }, [dist])

  if (items.length === 0) return null

  return (
    <div className="relative flex items-center overflow-hidden rounded-full border" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
      <div
        className="relative z-10 flex shrink-0 items-center gap-1.5 px-4 py-2 text-[11px] font-semibold tracking-[0.12em]"
        style={{ color: 'var(--signal)', borderRight: '1px solid var(--line)' }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }} />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: 'var(--signal)' }} />
        </span>
        LIVE
      </div>
      <div className="flex overflow-hidden py-1.5">
        <div className="tape-track flex w-max items-center">
          {[...items, ...items].map((e, i) => (
            <span key={`${e.address}-${e.at}-${i}`} className="flex shrink-0 items-center gap-2 px-5 text-[12.5px]">
              <span className="t-mono" style={{ color: 'var(--ink-soft)' }}>
                {short(e.address)}
              </span>
              <span style={{ color: 'var(--ink-soft)' }}>received</span>
              <span className="t-mono font-medium" style={{ color: 'var(--signal)' }}>
                ${e.usd.toFixed(2)}
              </span>
              {e.lead && (
                <span className="t-mono" style={{ color: 'var(--ink-soft)' }}>
                  in {e.lead}
                  {e.extra ? ` +${e.extra}` : ''}
                </span>
              )}
              <span style={{ color: 'var(--ink-soft)', opacity: 0.7 }}>· {relativeTime(e.at)}</span>
            </span>
          ))}
        </div>
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16"
        style={{ background: 'linear-gradient(270deg, var(--surface), transparent)' }}
      />
    </div>
  )
}
