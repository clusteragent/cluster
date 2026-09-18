import { StockIcon } from '@/components/StockIcon'

/**
 * The stock strip under the hero — the thing the index actually holds.
 * Same treatment as the reference landing: real marks, grayscale at rest,
 * full colour on hover, sliding continuously (pauses on hover).
 * Symbols are a curated read of the 193-instrument universe so the strip
 * reads as recognisable names first, not an alphabetical dump.
 */
const MARQUEE = [
  'NVDA', 'AAPL', 'MSFT', 'TSLA', 'SPY', 'QQQ', 'META', 'GOOGL',
  'AMZN', 'NFLX', 'AMD', 'INTC', 'ORCL', 'CRM', 'ADBE', 'COIN',
  'PLTR', 'SNOW', 'SHOP', 'IBM', 'MU', 'AVGO', 'ASML', 'TSM',
  'JNJ', 'XOM', 'LLY', 'COST', 'RBLX', 'SNAP',
]

export function StockMarquee({ dark = false }: { dark?: boolean }) {
  // duplicate the set so the -50% translate loop is seamless
  const items = [...MARQUEE, ...MARQUEE]
  return (
    <section
      className="border-y"
      style={{
        borderColor: dark ? 'rgba(255,255,255,0.07)' : 'var(--line)',
        background: dark ? 'rgba(255,255,255,0.02)' : 'var(--field)',
      }}
      aria-label="Tokenized stocks in the index"
    >
      <div className="mx-auto flex max-w-[1440px] items-center gap-5 px-5 py-4 sm:px-8 lg:px-16">
        <span
          className="t-mono hidden shrink-0 text-[10.5px] leading-tight tracking-[0.08em] sm:block"
          style={{ color: dark ? 'rgba(255,255,255,0.28)' : 'var(--ink-soft)' }}
        >
          193 TOKENIZED
          <br />
          STOCKS · CHAIN 4663
        </span>
        <span className={`tape ${dark ? 'tape-logo-dark' : 'tape-logo'} min-w-0 flex-1`}>
          <span className="tape-track">
            {items.map((s, i) => (
              <span key={`${s}-${i}`} className="tape-item">
                <StockIcon symbol={s} size={26} shape="square" eager />
                <span className="t-mono text-[12px] font-medium" style={{ color: dark ? 'rgba(255,255,255,0.7)' : undefined }}>{s}</span>
              </span>
            ))}
          </span>
        </span>
      </div>
    </section>
  )
}
