import { useState } from 'react'
import { STOCK_ICON_META, stockIconSrc } from '@/lib/stockIconFiles'

/**
 * Stock mark for a tokenized-stock symbol. Icons live in
 * public/stock-icons/<SYMBOL>.{png,jpg} — 194 marks covering the whole
 * Robinhood Chain universe. The manifest (lib/stockIconFiles.ts) records
 * the real file extension, whether the mark is a photo (jpg) and whether
 * it is a white/light logo (dark=true) that needs an ink chip behind it
 * to stay visible on our white canvas.
 *
 * shape="circle" (default) — app lists, avatars.
 * shape="square"           — landing marquee tiles.
 * Falls back to a monogram chip when a symbol has no mark, so the UI
 * never shows a broken image.
 */
export function StockIcon({
  symbol,
  size = 24,
  shape = 'circle',
  grayscale = false,
  eager = false,
  className,
}: {
  symbol: string
  size?: number
  shape?: 'circle' | 'square'
  grayscale?: boolean
  /** Load immediately — use inside scrolling strips where lazy-loading shows blanks. */
  eager?: boolean
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const sym = symbol.toUpperCase()
  const meta = STOCK_ICON_META[sym]
  const radius = shape === 'circle' ? '50%' : Math.max(6, Math.round(size * 0.22))
  const needsChip = !!meta?.dark

  if (failed || !meta) {
    return (
      <span
        className={`grid shrink-0 place-items-center ${className ?? ''}`}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: 'var(--field-alt)',
          color: 'var(--ink-soft)',
          fontSize: Math.max(8, Math.round(size * 0.34)),
          fontWeight: 600,
          letterSpacing: '-0.02em',
        }}
        aria-hidden
      >
        {sym.slice(0, 3)}
      </span>
    )
  }

  const img = (
    <img
      src={stockIconSrc(sym)}
      alt=""
      aria-hidden
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className="h-full w-full object-contain"
      style={grayscale ? { filter: 'grayscale(1) contrast(0.92)' } : undefined}
    />
  )

  if (needsChip) {
    return (
      <span
        className={`grid shrink-0 place-items-center overflow-hidden ${className ?? ''}`}
        style={{ width: size, height: size, borderRadius: radius, background: '#171717', padding: Math.max(2, Math.round(size * 0.16)) }}
        aria-hidden
      >
        {img}
      </span>
    )
  }

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden ${className ?? ''}`}
      style={{ width: size, height: size, borderRadius: radius, background: 'var(--field)', boxShadow: shape === 'circle' ? 'inset 0 0 0 1px var(--line)' : 'inset 0 0 0 1px var(--line)' }}
      aria-hidden
    >
      {img}
    </span>
  )
}
