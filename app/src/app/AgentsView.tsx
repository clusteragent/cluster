import { useState } from 'react'
import { AgentAvatar } from '@/components/AgentAvatar'
import { AGENTS, CATEGORIES } from '@/data/agents'
import type { Agent, AgentCategory } from '@/data/agents'
import { ChevronRight } from 'lucide-react'

interface AgentsViewProps {
  onRun: (agent: Agent) => void
  onChat: () => void
}

export function AgentsView({ onRun }: AgentsViewProps) {
  const [cat, setCat] = useState<'All' | AgentCategory>('All')

  // Only show categories that actually exist in AGENTS
  const existingCats = CATEGORIES.filter(c => {
    if (c === 'All') return true
    return AGENTS.some(a => a.category === c && a.id)
  })

  const filtered = AGENTS.filter(a => {
    if (!a.id) return false
    if (cat === 'All') return true
    return a.category === cat
  })

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', margin: 0 }}>Agent Index</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 6 }}>
          Run finance, research and trading agents on-chain.
        </p>
      </div>

      {/* Category filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {existingCats.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              padding: '6px 14px',
              borderRadius: 99,
              border: '1px solid',
              cursor: 'pointer',
              transition: 'all 0.15s',
              borderColor: cat === c ? 'var(--accent)' : 'var(--line)',
              background: cat === c ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: cat === c ? 'var(--accent)' : 'var(--ink-soft)',
            }}
          >{c}</button>
        ))}
      </div>

      {/* Agent grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 12,
      }}>
        {filtered.map(agent => (
          <AgentCard key={agent.id} agent={agent} onRun={onRun} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-soft)', fontSize: 14 }}>
          No agents in this category.
        </div>
      )}
    </div>
  )
}

function AgentCard({ agent, onRun }: { agent: Agent; onRun: (a: Agent) => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--surface-raised)' : 'var(--surface)',
        borderRadius: 16,
        padding: 16,
        boxShadow: hovered
          ? '0 0 0 1px rgba(255,255,255,0.35), var(--shadow-card)'
          : '0 0 0 1px var(--line), var(--shadow-card)',
        transition: 'all 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'default',
      }}
    >
      {/* Top row: avatar + category chip */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <AgentAvatar agent={agent} size={40} />
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          fontFamily: 'monospace',
          color: 'var(--ink-dim)',
          background: 'var(--field)',
          borderRadius: 6,
          padding: '3px 7px',
          marginTop: 2,
        }}>{agent.category}</span>
      </div>

      {/* Name + ticker */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{agent.name}</div>
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--ink-dim)', marginTop: 2 }}>{agent.ticker}</div>
      </div>

      {/* Blurb */}
      <p style={{
        fontSize: 12,
        color: 'var(--ink-soft)',
        lineHeight: 1.5,
        margin: 0,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        flex: 1,
      }}>{agent.blurb}</p>

      {/* Run button */}
      <button
        onClick={() => onRun(agent)}
        style={{
          fontSize: 12,
          fontWeight: 500,
          padding: '6px 14px',
          borderRadius: 99,
          border: '1px solid var(--line)',
          background: hovered ? 'rgba(255,255,255,0.12)' : 'transparent',
          color: hovered ? 'var(--accent)' : 'var(--ink-soft)',
          cursor: 'pointer',
          transition: 'all 0.15s',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          alignSelf: 'flex-start',
        }}
      >
        Run agent <ChevronRight size={12} />
      </button>
    </div>
  )
}
