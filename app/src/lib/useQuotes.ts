import { useEffect, useState } from 'react'
import { api, type ApiQuote } from './api'

/**
 * Live quotes for tokenized-stock symbols (basket / trade views).
 * Real market data via /api/market/quotes — when the upstream fails the
 * hook returns an error and callers render "unavailable", never a
 * fabricated price. Refreshes every 60s.
 */
export function useQuotes(symbols: string[], refreshMs = 60_000) {
  const [quotes, setQuotes] = useState<Record<string, ApiQuote>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const key = symbols.join(',')

  useEffect(() => {
    let cancelled = false
    if (!key) {
      setLoading(false)
      return
    }
    const list = key.split(',')

    async function tick() {
      try {
        const data = await api.getQuotes(list)
        if (cancelled) return
        setQuotes(data.quotes)
        setError(null)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'market data unavailable')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    tick()
    const id = setInterval(tick, refreshMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [key, refreshMs])

  return { quotes, error, loading }
}
