/**
 * CandleChart — real OHLC candlesticks from the backend (Yahoo v8 proxy).
 * Pure SVG, dark-theme colors, no chart library. Green up / red down,
 * volume-less but with high-low wicks. Falls back to nothing when the
 * payload has no candles (never fakes data).
 */
export interface Candle { t: number; o: number; h: number; l: number; c: number }

export function CandleChart({
  candles,
  width = 980,
  height = 260,
}: {
  candles?: Candle[]
  width?: number
  height?: number
}) {
  if (!candles || candles.length < 2) return null

  const lo = Math.min(...candles.map((c) => c.l))
  const hi = Math.max(...candles.map((c) => c.h))
  const span = hi - lo || 1
  const padTop = 10
  const padBottom = 18

  const plotH = height - padTop - padBottom
  const n = candles.length
  const slot = width / n
  const bodyW = Math.max(1.5, Math.min(10, slot * 0.62))
  const y = (v: number) => padTop + (1 - (v - lo) / span) * plotH

  const last = candles[n - 1]
  const first = candles[0]
  const up = last.c >= first.o

  const lineColor = up ? 'var(--signal)' : 'var(--danger)'

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden style={{ display: 'block' }}>
      {/* grid lines — 4 horizontal */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={width} y1={padTop + f * plotH} y2={padTop + f * plotH}
          stroke="var(--line)" strokeWidth={1} strokeDasharray="2 4" opacity={0.5} />
      ))}

      {candles.map((c, i) => {
        const x = i * slot + slot / 2
        const bull = c.c >= c.o
        const color = bull ? 'var(--signal)' : 'var(--danger)'
        const yO = y(c.o)
        const yC = y(c.c)
        const top = Math.min(yO, yC)
        const h = Math.max(1, Math.abs(yC - yO))
        return (
          <g key={c.t}>
            {/* wick */}
            <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth={1} opacity={0.75} />
            {/* body */}
            <rect x={x - bodyW / 2} y={top} width={bodyW} height={h} fill={color} opacity={0.9} rx={bodyW > 4 ? 1 : 0} />
          </g>
        )
      })}

      {/* last price marker */}
      <line x1={0} x2={width} y1={y(last.c)} y2={y(last.c)} stroke={lineColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
      <rect x={width - 64} y={y(last.c) - 9} width={62} height={18} rx={4}
        fill={lineColor} opacity={0.92} />
      <text x={width - 33} y={y(last.c) + 4} textAnchor="middle" fill="#0d0d0d" fontSize={11} fontWeight={700} fontFamily="ui-monospace, monospace">
        {last.c.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </text>

      {/* first/last date labels */}
      <text x={2} y={height - 4} fill="var(--ink-dim)" fontSize={10} fontFamily="ui-monospace, monospace">
        {new Date(first.t * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </text>
      <text x={width - 2} y={height - 4} textAnchor="end" fill="var(--ink-dim)" fontSize={10} fontFamily="ui-monospace, monospace">
        {new Date(last.t * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </text>
    </svg>
  )
}
