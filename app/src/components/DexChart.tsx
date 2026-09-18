import { useState } from 'react'

/**
 * Official DexScreener embed (pattern from chronoa). Pair address checksum
 * must stay as DexScreener publishes it — lowercasing the hex returns an
 * empty chart. The "Powered by" badge is part of the iframe; we crop it
 * visually with a bottom cover since embed=1&info=0 keeps the chart clean.
 */
export function DexChart({
  chain = 'robinhood',
  pair,
  token,
  theme = 'dark',
  height = 480,
}: {
  chain?: string
  pair?: string | null
  token?: string
  theme?: 'dark' | 'light'
  height?: number
}) {
  const [loaded, setLoaded] = useState(false)
  const target = pair || token
  if (!target) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center', color: 'var(--ink-soft)', fontSize: 12.5 }}>
        No pool found for this asset yet — no chart to show.
      </div>
    )
  }

  const path = pair || token
  const src =
    `https://dexscreener.com/${chain}/${path}` +
    `?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0` +
    `&chartLeftToolbar=0&chartTheme=${theme}&theme=${theme}`

  return (
    <div style={{ height, position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--ink-soft)', fontSize: 12.5 }}>
          Loading chart…
        </div>
      )}
      <iframe
        key={`${path}-${theme}`}
        src={src}
        title="DexScreener chart"
        loading="eager"
        onLoad={() => setLoaded(true)}
        allow="clipboard-write; fullscreen"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
      {/* crop any dexscreener attribution strip at the bottom of the embed */}
      <div
        aria-hidden
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 30,
          background: theme === 'dark' ? '#131722' : '#ffffff',
        }}
      />
    </div>
  )
}
