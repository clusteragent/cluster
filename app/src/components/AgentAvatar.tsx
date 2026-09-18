import type { Agent } from '@/data/agents'
import { Repeat2, Search, BookOpen, Eye, TrendingUp, BarChart3, Brain, Filter, Receipt, Wallet, MessageSquare, Layers, Lock, PenLine, Radar, Scale } from 'lucide-react'

// One meaningful lucide icon per agent glyph — matches every other icon
// in the app (Search, Menu, LayoutGrid, etc. are all lucide too), so
// nothing looks like a random hand-drawn shape next to real icons.
const GLYPHS: Record<Agent['glyph'], React.ComponentType<{ size?: number | string; strokeWidth?: number; color?: string }>> = {
  relay: Repeat2, // routes swaps — repeat/loop
  scout: Search, // research/discovery
  ledger: BookOpen, // bookkeeping
  argus: Eye, // watching flows/whales
  pivot: TrendingUp, // momentum trading
  prism: BarChart3, // breaks data into signals
  memory: Brain, // long-term memory
  sifter: Filter, // sifting sources
  remit: Receipt, // payments/invoicing
  nexus: Wallet, // portfolio/wallet tracking
  echo: MessageSquare, // conversation memory
  census: Layers, // segments/ranks a market
  vault: Lock, // treasury
  quill: PenLine, // writing/synthesis
  oracle: Radar, // price/prediction feed
  margin: Scale, // risk/margin balance
}

/* flat = icon only, no circular-chip background (for big tile art).
   Sized relative to the parent container — the tile art sets its own
   box, so we fill ~52% of it like the old viewBox-based SVG did. */
export function AgentAvatar({ agent, size = 44, flat = false }: { agent: Agent; size?: number; flat?: boolean }) {
  const Icon = GLYPHS[agent.glyph]
  if (flat) {
    return <Icon size="52%" strokeWidth={1.75} color={agent.fg} />
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: agent.bg, boxShadow: 'inset 0 0 0 1px var(--line)' }}
    >
      <Icon size={Math.round(size * 0.52)} strokeWidth={1.9} color={agent.fg} />
    </span>
  )
}
