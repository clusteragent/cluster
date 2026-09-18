/**
 * Minimal SVG sparkline from a [timestamp, close] series — drawn with
 * real quote data, no chart library. Renders nothing when the series is
 * too short to be meaningful (never a fake line).
 */
export function Sparkline({
  series,
  width = 96,
  height = 28,
  up,
  fill = false,
}: {
  series?: [number, number][]
  width?: number
  height?: number
  up?: boolean
  /** Fill under the line with a fading gradient (large charts). */
  fill?: boolean
}) {
  if (!series || series.length < 2) return null

  const closes = series.map(([, c]) => c)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const span = max - min || 1

  const pts = closes.map((c, i) => {
    const x = (i / (closes.length - 1)) * width
    const y = height - 2 - ((c - min) / span) * (height - 4)
    return [x, y] as const
  })

  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const color = up ? 'var(--signal)' : 'var(--danger)'

  const gid = `spark-${up ? 'up' : 'dn'}-${width}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0">
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.30} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${gid})`} stroke="none" />
        </>
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={fill ? 1.6 : 1.4} strokeLinejoin="round" strokeLinecap="round" opacity={0.95} />
    </svg>
  )
}
