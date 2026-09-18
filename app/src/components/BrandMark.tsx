export function BrandMark({ size = 34 }: { size?: number; dark?: boolean }) {
  return (
    <img
      src="/logo-new.jpg"
      alt="cluster"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(6, Math.round(size * 0.28)),
        objectFit: 'cover',
        display: 'block',
      }}
    />
  )
}

export function Wordmark({
  size = 30,
  text = 22,
  beta = true,
  dark = false,
}: {
  size?: number
  text?: number
  beta?: boolean
  dark?: boolean
}) {
  return (
    <span className="flex items-center gap-2.5" style={{ color: dark ? '#ffffff' : 'var(--ink)' }}>
      <BrandMark size={size} />
      <span className="wordmark relative" style={{ fontSize: text }}>
        cluster
        {beta && (
          <span
            className="absolute top-0 hidden font-normal sm:inline"
            style={{ left: '100%', marginLeft: 8, fontSize: 13, color: dark ? 'rgba(255,255,255,0.4)' : 'var(--ink-soft)', lineHeight: 1 }}
          >
            beta
          </span>
        )}
      </span>
    </span>
  )
}
