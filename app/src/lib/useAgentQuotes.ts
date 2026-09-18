import { useEffect, useState } from 'react'
import { api } from './api'

export interface Quote {
  symbol: string
  price: number
  change_pct: number
}

/**
 * Live market quotes for agents that have a real trading analogue
 * (see server/app/routes/market.py::SYMBOL_MAP). Agents without one
 * simply won't have an entry — callers must handle the absence
 * instead of fabricating a number.
 */
export function useAgentQuotes() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .getAgentQuotes()
      .then((data) => {
        if (cancelled) return
        const clean: Record<string, Quote> = {}
        for (const [id, q] of Object.entries(data.quotes)) {
          if ('price' in q) clean[id] = q
        }
        setQuotes(clean)
      })
      .catch(() => {
        // backend or market data unavailable — components fall back to
        // the static reward rate, no fake numbers substituted here
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  return { quotes, loading }
}
