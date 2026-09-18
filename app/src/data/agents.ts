export type AgentCategory = 'Finance' | 'Analysis' | 'Crypto' | 'Memory' | 'Research' | 'Trading'

export interface Agent {
  id: string
  name: string
  ticker: string
  category: AgentCategory
  trigger: 'Per task' | 'Per query' | 'Per swap' | 'Per report'
  blurb: string
  // avatar styling
  bg: string
  fg: string
  glyph: 'ledger' | 'prism' | 'nexus' | 'memory' | 'scout' | 'relay' | 'quill' | 'vault' | 'argus' | 'margin' | 'echo' | 'sifter' | 'pivot' | 'oracle' | 'census' | 'remit'
}

// Agent capabilities in the index. These are skills a wallet can try —
// they do NOT pay a per-run reward. The thing that pays is holding
// $CLST itself (once deployed): a proportional claim on the tokenized
// stock basket at /api/index. See PortfolioView / IndexView.
export const AGENTS: Agent[] = [
  { id: 'relay',   name: 'Relay',   ticker: 'RLY',  category: 'Trading',  trigger: 'Per swap',   blurb: 'DEX trading agent. Routes swaps across pools on Robinhood Chain.', bg: '#f5f5f5', fg: '#171717', glyph: 'relay' },
  { id: 'scout',   name: 'Scout',   ticker: 'SCT',  category: 'Research', trigger: 'Per report', blurb: 'Deep-research agent for commissioned reports.', bg: '#f5f5f5', fg: '#171717', glyph: 'scout' },
  { id: 'ledger',  name: 'Ledger',  ticker: 'FIN',  category: 'Finance',  trigger: 'Per task',   blurb: 'Bookkeeping and reconciliation agent.', bg: '#f5f5f5', fg: '#171717', glyph: 'ledger' },
  { id: 'argus',   name: 'Argus',   ticker: 'ARG',  category: 'Analysis', trigger: 'Per query',  blurb: 'On-chain analysis agent watching flows, wallets and whales.', bg: '#f5f5f5', fg: '#171717', glyph: 'argus' },
  { id: 'pivot',   name: 'Pivot',   ticker: 'PVT',  category: 'Trading',  trigger: 'Per swap',   blurb: 'Momentum trading agent for DEX markets.', bg: '#f5f5f5', fg: '#171717', glyph: 'pivot' },
  { id: 'prism',   name: 'Prism',   ticker: 'PRSM', category: 'Analysis', trigger: 'Per query',  blurb: 'Breaks any dataset into signals.', bg: '#f5f5f5', fg: '#171717', glyph: 'prism' },
  { id: 'memoria', name: 'Memoria', ticker: 'MEM',  category: 'Memory',   trigger: 'Per task',   blurb: 'Long-term memory agent — stores and recalls wallet context.', bg: '#f5f5f5', fg: '#171717', glyph: 'memory' },
  { id: 'sifter',  name: 'Sifter',  ticker: 'SFT',  category: 'Research', trigger: 'Per report', blurb: 'Literature and source sifting agent for evidence-grade answers.', bg: '#f5f5f5', fg: '#171717', glyph: 'sifter' },
  { id: 'remit',   name: 'Remit',   ticker: 'RMT',  category: 'Finance',  trigger: 'Per task',   blurb: 'Payments and invoicing agent.', bg: '#f5f5f5', fg: '#171717', glyph: 'remit' },
  { id: 'nexus',   name: 'Nexus',   ticker: 'NXS',  category: 'Crypto',   trigger: 'Per task',   blurb: 'Portfolio agent tracking wallets, positions and yield across chains.', bg: '#f5f5f5', fg: '#171717', glyph: 'nexus' },
  { id: 'echo',    name: 'Echo',    ticker: 'ECH',  category: 'Memory',   trigger: 'Per query',  blurb: 'Conversation memory agent for wallet context.', bg: '#f5f5f5', fg: '#171717', glyph: 'echo' },
  { id: 'census',  name: 'Census',  ticker: 'CNS',  category: 'Analysis', trigger: 'Per query',  blurb: 'Market census agent. Counts, segments and ranks any market.', bg: '#f5f5f5', fg: '#171717', glyph: 'census' },
  { id: 'vault',   name: 'Vault',   ticker: 'VLT',  category: 'Crypto',   trigger: 'Per task',   blurb: 'Treasury agent tracking idle balances.', bg: '#f5f5f5', fg: '#171717', glyph: 'vault' },
  { id: 'quill',   name: 'Quill',   ticker: 'QLL',  category: 'Research', trigger: 'Per report', blurb: 'Writing and synthesis agent for briefs, memos and summaries.', bg: '#f5f5f5', fg: '#171717', glyph: 'quill' },
  { id: 'oracle',  name: 'Oracle',  ticker: 'ORC',  category: 'Crypto',   trigger: 'Per query',  blurb: 'Price and prediction feed agent.', bg: '#f5f5f5', fg: '#171717', glyph: 'oracle' },
  { id: 'margin',  name: 'Margin',  ticker: 'MRG',  category: 'Finance',  trigger: 'Per task',   blurb: 'Risk and margin agent.', bg: '#f5f5f5', fg: '#171717', glyph: 'margin' },
]

export const CATEGORIES: Array<'All' | AgentCategory> = ['All', 'Finance', 'Analysis', 'Crypto', 'Memory', 'Research', 'Trading']

export const POPULAR_IDS = ['relay', 'scout', 'ledger', 'argus']

export interface HistoryEvent {
  id: string
  agentId: string
  label: string
  detail: string
  day: string
  status: 'logged'
}
