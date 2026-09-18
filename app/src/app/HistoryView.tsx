import { AGENTS, type HistoryEvent } from '@/data/agents'
import { AgentAvatar } from '@/components/AgentAvatar'
import { Clock, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'

const EASE = [0.22, 1, 0.36, 1] as const

export function HistoryView({
  history,
  connected,
  onConnect,
}: {
  history: HistoryEvent[]
  connected: boolean
  onConnect: () => void
}) {
  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-8 sm:px-8 sm:py-10">
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="t-display text-[40px]"
      >
        History
      </motion.h1>
      <p className="mt-2 t-small muted">Every agent capability this wallet has tried.</p>

      {!connected ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
          className="mt-20 flex flex-col items-center text-center"
        >
          <motion.span
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="grid h-14 w-14 place-items-center rounded-full"
            style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-card)' }}
          >
            <Wallet size={22} style={{ color: 'var(--ink-soft)' }} />
          </motion.span>
          <p className="mt-4 text-[16px] font-medium">Connect a wallet</p>
          <p className="mt-1 max-w-[320px] t-small muted">
            History is wallet-scoped — connect to read your own runs.
          </p>
          <button onClick={onConnect} className="pill pill-ink mt-5 flex items-center gap-2">
            <Wallet size={15} /> Connect wallet
          </button>
        </motion.div>
      ) : history.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
          className="mt-20 flex flex-col items-center text-center"
        >
          <motion.span
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="grid h-14 w-14 place-items-center rounded-full"
            style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-card)' }}
          >
            <Clock size={22} style={{ color: 'var(--ink-soft)' }} />
          </motion.span>
          <p className="mt-4 text-[16px] font-medium">Nothing yet</p>
          <p className="mt-1 max-w-[320px] t-small muted">Try an agent capability and it shows up here.</p>
        </motion.div>
      ) : (
        <div className="card mt-8 overflow-hidden">
          {history.map((h, i) => {
            const a = AGENTS.find((x) => x.id === h.agentId)
            return (
              <motion.div
                key={h.id}
                layout
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, ease: EASE, delay: Math.min(i * 0.04, 0.3) }}
                className="flex items-center gap-4 border-t px-6 py-4 first:border-t-0"
                style={{ borderColor: 'var(--line)' }}
              >
                {a && <AgentAvatar agent={a} size={40} />}
                <div className="flex-1">
                  <p className="text-[15px] font-medium">{h.label}</p>
                  <p className="t-small muted">{h.detail}</p>
                </div>
                <span className="t-small muted">{h.day}</span>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
