/**
 * Thin client for the Cluster backend (server/app).
 * Dev server proxies /api to AGENTINDEX_API_URL (default localhost:8000) —
 * see vite.config.ts. In production, deploy the backend behind the same
 * origin/reverse-proxy path, or set VITE_API_BASE.
 */
const BASE = import.meta.env.VITE_API_BASE ?? ''

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    if (res.status === 401) {
      // session expired/invalid — drop cached sessions; the caller's next
      // attempt re-signs once automatically.
      sessionCache.clear()
    }
    const text = await res.text().catch(() => res.statusText)
    let detail = text
    try { detail = JSON.parse(text).detail ?? text } catch { /* keep raw */ }
    throw new Error(`Cluster API ${res.status}: ${detail}`)
  }
  return res.json() as Promise<T>
}

export interface ApiActivityEvent {
  id: number
  agent_id: string
  agent_name?: string
  detail: string
  status: 'logged'
  created_at: string
}

export interface ApiPortfolio {
  wallet: string
  agents_tried_count: number
  activity: ApiActivityEvent[]
}

export interface ApiStock {
  address: string
  symbol: string
  name: string
  verified: boolean
}

export interface ApiIndex {
  clst_token_address: string | null
  clst_deployed: boolean
  stock_count: number
  verified_on_chain_count: number
  chain: string
  chain_id: number
  note: string
  stocks: ApiStock[]
}

export interface ApiQuote {
  symbol: string
  name?: string
  currency?: string
  exchange?: string | null
  price: number | null
  previousClose?: number | null
  change?: number | null
  change_pct: number | null
  day_high?: number | null
  day_low?: number | null
  market_time?: number | null
  series?: [number, number][]
  source?: string
}

export interface ApiDistributionCycle {
  at: number | null
  cycle_index: number | null
  usd: number | null
  transfers: number | null
  recipients: number
  assets: { symbol: string; amount: number }[]
}

export interface ApiDistributions {
  live: boolean
  reason: string | null
  detail: string | null
  updated_at: string | null
  mode: string | null
  totals: { cycles: number; distributed_usd: number; recipients: number }
  treasury?: { address: string | null; eth: number | null; updated_at: string | null }
  cycles: ApiDistributionCycle[]
  recent?: unknown[]
  payroll?: { wallet: string; amount?: number; usd?: number; symbol?: string }[]
  recent_buys?: { symbol?: string; usd?: number; amount?: number; tx?: string; at?: string | number }[]
}

/** Fetches a fresh signing challenge for a wallet from the backend. */
async function getChallenge(wallet: string): Promise<{ message: string; expires_in: number }> {
  return req(`/api/auth/challenge?wallet=${encodeURIComponent(wallet)}`)
}

/**
 * A caller that can sign an arbitrary message — matches wagmi's
 * useSignMessage().signMessageAsync shape, so components pass that
 * hook's function straight through without adapting it.
 */
export type MessageSigner = (args: { message: string }) => Promise<string>

/**
 * Auth round-trip, SESSION-BASED: the wallet signs ONCE per 50 minutes.
 * The signature is exchanged for a session token (POST /api/auth/session);
 * every wallet-scoped request then carries the token — no more signing
 * every request. On expiry the next call re-signs automatically.
 */
const SESSION_TTL_MS = 50 * 60 * 1000
const sessionCache = new Map<string, { token: string; expiresAt: number }>()
const sessionPending = new Map<string, Promise<string>>()

async function createSession(wallet: string, signer: MessageSigner): Promise<string> {
  const { message } = await getChallenge(wallet)
  const signature = await signer({ message })
  const res = await req<{ session_token: string; expires_in: number }>('/api/auth/session', {
    method: 'POST',
    body: JSON.stringify({ wallet, signature }),
  })
  return res.session_token
}

export async function signChallenge(wallet: string, signer: MessageSigner): Promise<string> {
  const w = wallet.toLowerCase()
  const cached = sessionCache.get(w)
  if (cached && Date.now() < cached.expiresAt) return cached.token
  // coalesce concurrent callers onto one signing prompt
  const inflight = sessionPending.get(w)
  if (inflight) return inflight
  const p = (async () => {
    try {
      const token = await createSession(w, signer)
      sessionCache.set(w, { token, expiresAt: Date.now() + SESSION_TTL_MS })
      return token
    } finally {
      sessionPending.delete(w)
    }
  })()
  sessionPending.set(w, p)
  return p
}

/** Force a fresh signature+session (used on 401 recovery). */
export function invalidateSession(wallet: string): void {
  sessionCache.delete(wallet.toLowerCase())
}

export interface ApiUsageTotals { requests: number; prompt_tokens: number; completion_tokens: number; cost_usd: number }
export interface ApiUsageKeyRow { key_id: number; name: string; prefix: string; all: ApiUsageTotals; recent: ApiUsageTotals; last_used: string | null }
export interface ApiUsageSummary { totals: { all: ApiUsageTotals; recent_30d: ApiUsageTotals }; keys: ApiUsageKeyRow[] }

export interface ApiNewsItem { title: string; link: string; publisher: string; published: string | null; summary: string }
export interface ApiNews { items: ApiNewsItem[]; count: number }

export const api = {
  health: () => req<{ status: string }>('/health'),

  listAgents: (params?: { category?: string; q?: string }) => {
    const qs = new URLSearchParams()
    if (params?.category && params.category !== 'All') qs.set('category', params.category)
    if (params?.q) qs.set('q', params.q)
    const suffix = qs.toString() ? `?${qs}` : ''
    return req<{ count: number; agents: unknown[] }>(`/api/agents${suffix}`)
  },

  /** Logs a wallet trying an agent capability. Never returns a reward — see server/app/routes/runs.py. */
  tryAgent: (agentId: string, wallet: string, signature: string, label?: string) =>
    req<ApiActivityEvent & { reward: 0 }>('/api/runs', {
      method: 'POST',
      body: JSON.stringify({ agent_id: agentId, wallet, signature, label }),
    }),

  getPortfolio: (wallet: string, signature: string) =>
    req<ApiPortfolio>(`/api/portfolio?wallet=${encodeURIComponent(wallet)}&signature=${encodeURIComponent(signature)}`),

  getHistory: (wallet: string, signature: string) =>
    req<{ wallet: string; events: ApiActivityEvent[] }>(
      `/api/portfolio/history?wallet=${encodeURIComponent(wallet)}&signature=${encodeURIComponent(signature)}`,
    ),

  remember: (content: string, wallet: string, signature: string, agentId?: string) =>
    req('/api/memory/retain', {
      method: 'POST',
      body: JSON.stringify({ bank_id: wallet, content, signature, agent_id: agentId }),
    }),

  recall: (query: string, wallet: string, signature: string) =>
    req<{ results: unknown[] }>('/api/memory/recall', {
      method: 'POST',
      body: JSON.stringify({ bank_id: wallet, query, signature }),
    }),

  getAgentQuotes: () =>
    req<{ quotes: Record<string, { symbol: string; price: number; change_pct: number } | { error: string }> }>(
      '/api/market/agent-quotes',
    ),

  /** The $CLST index composition — the basket of tokenized stocks $CLST represents once live. No auth required: it's public catalogue data, not wallet-scoped. */
  getIndex: () => req<ApiIndex>('/api/index'),

  /** The curated payout basket (19 weighted instruments holders are paid in). */
  getPayoutBasket: () => req<ApiPayoutBasket>('/api/index/payout-basket'),

  /** Batch quotes + sparkline series for basket symbols. Real market data (Yahoo spark proxy); 502s rather than inventing a price. */
  getQuotes: (symbols: string[]) =>
    req<{ fetched_at: string; count: number; quotes: Record<string, ApiQuote> }>(
      `/api/market/quotes?symbols=${encodeURIComponent(symbols.join(','))}`,
    ),

  /** The public distribution record. `live: false` until $CLST launches and the keeper bot's first cycle lands — never faked. */
  getDistributions: () => req<ApiDistributions>('/api/distributions'),

  /** Top gainers/losers across the whole tradeable universe (~193 instruments). Cached 2 min server-side. */
  getMovers: (limit = 8) => req<ApiMovers>(`/api/market/movers?limit=${limit}`),

  /** Chain + gas + ETH/USD context for the trade ticket (CoinGecko-backed). */
  getTradeStatus: () =>
    req<{ chain_id: number; router: string; rpc_ok: boolean; gas_price_gwei: number | null; eth_usd: number | null }>(
      '/api/trade/status',
    ),

  /** Day change aggregated by sector, computed from live quotes. */
  getSectors: () => req<{ fetched_at: string; sectors: ApiSector[] }>('/api/market/sectors'),

  /** Real market headlines from the Yahoo Finance RSS feed (server-parsed). */
  getNews: (count = 18) => req<ApiNews>(`/api/market/news?count=${count}`),

  /** One symbol's close series for a timeframe (1d = 5-min bars, else daily). */
  getChart: (symbol: string, tf = '1mo') =>
    req<ApiQuote & { tf: string }>(`/api/market/chart/${encodeURIComponent(symbol)}?tf=${tf}`),

  /** On-chain balances for one address: native ETH + every nonzero ERC-20 stock token (one Multicall3 round-trip server-side). */
  getWalletBalances: (address: string) =>
    req<ApiWalletBalances>(`/api/trade/wallet/${encodeURIComponent(address)}`),

  // ---- chat (vikey gateway proxy) ----

  /** Models available through the gateway, grouped for the picker. */
  getChatModels: () => req<ApiChatModels>('/api/chat/models'),

  /** Remaining inference credit for a wallet ($8 signup grant). */
  getCredits: (wallet: string) =>
    req<ApiCredits>(`/api/chat/credits?wallet=${encodeURIComponent(wallet)}`),

  /** One chat completion. The backend proxies to the gateway and meters usage. */
  chat: (body: { wallet: string; model: string; messages: { role: string; content: string }[]; signature?: string; thinking?: boolean; project_id?: string }) =>
    req<ApiChatReply>('/api/chat', { method: 'POST', body: JSON.stringify(body) }),

  /** Conversation list for a wallet. */
  getConversations: (wallet: string) =>
    req<{ conversations: ApiConversation[] }>(`/api/chat/conversations?wallet=${encodeURIComponent(wallet)}`),

  // ---- API keys ----

  listKeys: (wallet: string, signature: string) =>
    req<{ keys: ApiKey[] }>(`/api/keys?wallet=${encodeURIComponent(wallet)}&signature=${encodeURIComponent(signature)}`),

  createKey: (wallet: string, signature: string, name: string) =>
    req<{ key: string; id: number; name: string; created_at: string }>('/api/keys', {
      method: 'POST',
      body: JSON.stringify({ wallet, signature, name }),
    }),

  keyUsage: (wallet: string, signature: string) =>
    req<ApiUsageSummary>(`/api/keys/usage?wallet=${encodeURIComponent(wallet)}&signature=${encodeURIComponent(signature)}`),

  revokeKey: (wallet: string, signature: string, id: number) =>
    req<{ revoked: boolean }>(`/api/keys/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ wallet, signature }),
    }),

  // ---- social ----

  getSocial: (wallet: string) => req<ApiSocial>(`/api/social/profile?wallet=${encodeURIComponent(wallet)}`),

  linkX: (wallet: string, signature: string, handle: string) =>
    req<{ linked: boolean; handle: string }>('/api/social/link-x', {
      method: 'POST',
      body: JSON.stringify({ wallet, signature, handle }),
    }),

  tip: (wallet: string, signature: string, to: string, amount: string, note?: string) =>
    req<{ recorded: boolean; tx_hash?: string }>('/api/social/tip', {
      method: 'POST',
      body: JSON.stringify({ wallet, signature, to, amount, note }),
    }),
}

export interface ApiChatModels {
  models: { id: string; label: string; group: string; context?: number }[]
  groups: string[]
  credit_usd: number
  note?: string
}

export interface ApiCredits {
  wallet: string
  granted_usd: number
  used_usd: number
  remaining_usd: number
  requests: number
}

export interface ApiChatReply {
  reply: string
  model: string
  usage: { prompt_tokens: number; completion_tokens: number; cost_usd: number }
  credit: { remaining_usd: number; used_usd: number }
}

export interface ApiConversation {
  id: number
  title: string
  model: string
  created_at: string
  messages: number
}

export interface ApiKey {
  id: number
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
  revoked: boolean
}

export interface ApiSocial {
  wallet: string
  x_handle: string | null
  x_linked: boolean
  tips_sent: number
  tips_received: number
  tip_total_usd: number
}

export interface ApiWalletBalances {
  ok: boolean
  wallet: string
  chain_id: number
  eth_wei: string
  /** symbol -> raw wei string; zero balances are omitted server-side */
  balances: Record<string, string>
  nonzero: number
  universe: number
}

export interface ApiMover {
  symbol: string
  name: string
  price: number
  change_pct: number
}

export interface ApiMovers {
  fetched_at: string
  universe: number
  covered: number
  gainers: ApiMover[]
  losers: ApiMover[]
}

export interface ApiSector {
  sector: string
  count: number
  avg_change_pct: number
  advancers: number
  decliners: number
}

export interface ApiPayoutBasketItem {
  symbol: string
  name: string
  address: string
  weight: number
  verified: boolean
}

export interface ApiPayoutBasket {
  count: number
  weight_sum: number
  universe_count: number
  note: string
  basket: ApiPayoutBasketItem[]
}
