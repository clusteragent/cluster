import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Wordmark } from '@/components/BrandMark'
import { AgentAvatar } from '@/components/AgentAvatar'
import { ConnectButton } from '@/components/ConnectButton'
import { AGENTS } from '@/data/agents'
import {
  ArrowRight, ShieldCheck, Bot, KeyRound, LineChart, Radio,
  Receipt, Landmark, Layers, HandCoins, Copy, Check,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useAgentQuotes } from '@/lib/useAgentQuotes'
import { api, type ApiIndex } from '@/lib/api'
import { LandingDocs } from './LandingDocs'
import { StockMarquee } from './StockMarquee'
import { BasketGlance } from './BasketGlance'
import { LiveFlow } from './LiveFlow'
import { PayoutTicker } from './PayoutTicker'

const EASE = [0.22, 1, 0.36, 1] as const

function ContractChip() {
  const [copied, setCopied] = useState(false)
  const ca = 'Cooming soon'
  const copy = async () => {
    try { await navigator.clipboard.writeText(ca); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* noop */ }
  }
  return (
    <button onClick={copy} className="t-mono inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] transition-colors"
      style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--line)', color: 'var(--ink-soft)' }}>
      <span style={{ color: 'var(--ink)', fontWeight: 500 }}>CA:</span> {ca}
      {copied ? <Check size={10} style={{ color: 'var(--signal)' }} /> : <Copy size={10} />}
    </button>
  )
}

function Rise({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.6, ease: EASE, delay }}>
      {children}
    </motion.div>
  )
}

function XIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41Z" /></svg>
}
function TelegramIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M23.9 3.6 20.3 20.5c-.27 1.2-.98 1.5-1.98.93l-5.5-4.05-2.65 2.55c-.29.29-.54.54-1.1.54l.39-5.57L19.6 5.9c.44-.39-.1-.61-.68-.22L6.4 13.9.97 12.2c-1.18-.37-1.2-1.18.25-1.75L22.5 2.03c.98-.36 1.84.22 1.4 1.57Z" /></svg>
}

/** Mini agent console — desktop right-side visual anchor */
function AgentConsole({ quotes, onEnter }: { quotes: ReturnType<typeof useAgentQuotes>['quotes']; onEnter: () => void }) {
  const live = AGENTS.filter((a) => quotes[a.id] && !('error' in quotes[a.id])).slice(0, 5)
  return (
    <div className="card w-full max-w-[440px] overflow-hidden" style={{ boxShadow: '0 20px 60px -24px rgba(23,23,23,0.22)' }}>
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--line)', background: 'var(--surface-raised)' }}>
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
          <span className="live-dot" /> Agent console
        </span>
        <span className="t-mono text-[10px]" style={{ color: 'var(--ink-soft)' }}>ROBINHOOD CHAIN · 4663</span>
      </div>
      {live.map((a, i) => {
        const q = quotes[a.id] as { symbol: string; price: number; change_pct: number }
        return (
          <motion.button key={a.id} onClick={onEnter}
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: EASE, delay: 0.3 + i * 0.07 }}
            className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#f5f5f5]"
            style={{ borderColor: 'var(--line)' }}>
            <AgentAvatar agent={a} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium">{a.name}</span>
              <span className="block text-[11.5px] line-clamp-1" style={{ color: 'var(--ink-soft)' }}>{a.blurb}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="t-mono block text-[11.5px]">{q.symbol}</span>
              <span className="t-mono block text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                ${q.price.toLocaleString()}{' '}
                <span className={q.change_pct >= 0 ? 'delta-up' : 'delta-down'}>
                  {q.change_pct >= 0 ? '+' : ''}{q.change_pct}%
                </span>
              </span>
            </span>
          </motion.button>
        )
      })}
      <div className="px-4 py-2.5" style={{ background: 'var(--surface-raised)' }}>
        <span className="text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>+ {AGENTS.length - live.length} more in the index</span>
      </div>
    </div>
  )
}

const STEPS = [
  { icon: <Bot size={17} strokeWidth={1.8} />, t: 'Run the agents', d: 'Research, trading, memory, analysis — any capability free to try. Every run logs to your activity.' },
  { icon: <KeyRound size={17} strokeWidth={1.8} />, t: 'Hold $CLST', d: 'One token, one proportional claim on the whole basket. No staking, no lockup, no snapshot.' },
  { icon: <LineChart size={17} strokeWidth={1.8} />, t: 'Collect the payout', d: 'Agent fees pool, buy the basket, get pushed to every holder automatically — sized by balance.' },
]

const LOOP = [
  { icon: <Receipt size={17} strokeWidth={1.8} />, t: 'Fee settles', d: 'Per swap, report, or query.' },
  { icon: <Landmark size={17} strokeWidth={1.8} />, t: 'Vault buys', d: 'Fees buy the whole basket.' },
  { icon: <Layers size={17} strokeWidth={1.8} />, t: 'Token = claim', d: 'Your $CLST = your slice.' },
  { icon: <HandCoins size={17} strokeWidth={1.8} />, t: 'Holders paid', d: 'Pro-rata, automatically.' },
]

export function Landing({ onEnter }: { onEnter: () => void }) {
  const { quotes } = useAgentQuotes()
  const [index, setIndex] = useState<ApiIndex | null>(null)
  useEffect(() => { api.getIndex().then(setIndex).catch(() => {}) }, [])

  return (
    <div className="on-field min-h-screen">
      {/* ── header ── */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between px-4 sm:px-8 lg:px-14"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)' }}>
        <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
          <Wordmark size={26} text={18} />
        </a>
        <nav className="flex items-center gap-0.5">
          <a href="https://x.com" target="_blank" rel="noreferrer" className="icon-button" aria-label="X" style={{ width: 34, height: 34 }}><XIcon /></a>
          <a href="https://t.me" target="_blank" rel="noreferrer" className="icon-button" aria-label="Telegram" style={{ width: 34, height: 34 }}><TelegramIcon /></a>
          <button onClick={onEnter} className="t-small hidden px-3 py-1.5 font-medium sm:block" style={{ color: 'var(--ink-soft)' }}>Open app</button>
          <button onClick={onEnter} className="t-small px-3 py-1.5 font-medium sm:hidden" style={{ color: 'var(--ink-soft)' }}>App</button>
          <Link to="/docs" className="t-small hidden px-3 py-1.5 font-medium sm:block" style={{ color: 'var(--ink-soft)' }}>Docs</Link>
          <ConnectButton />
        </nav>
      </header>

      {/* ── hero ── */}
      <section className="relative overflow-hidden pt-14">
        <div className="grid-overlay" />
        <div className="mx-auto max-w-[1100px] px-4 pb-8 pt-14 sm:px-8 sm:pt-18 lg:grid lg:grid-cols-[1fr_460px] lg:items-center lg:gap-12 lg:px-14 lg:pt-20 lg:pb-14">
          <Rise>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="t-mono inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.1em]"
                style={{ background: 'rgba(23,23,23,0.05)', boxShadow: 'inset 0 0 0 1px var(--line)', color: 'var(--ink-soft)' }}>Cooming soon</span>
              <span className="t-mono text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>
                {AGENTS.length} agents · {index?.stock_count ?? '193'} stocks
              </span>
            </div>
            <h1 className="font-bold tracking-tight" style={{ fontSize: 'clamp(2.2rem, 6vw, 4.25rem)', lineHeight: 1.06, letterSpacing: '-0.035em', maxWidth: '16ch' }}>
              Financial agents<br />you can run.<br />
              <span style={{ color: 'var(--signal)' }}>An index you can own.</span>
            </h1>
            <p className="mt-4 max-w-[44ch] text-[0.9375rem] leading-relaxed sm:text-[1rem]" style={{ color: 'var(--ink-soft)' }}>
              {AGENTS.length} agents explore markets. $CLST turns the same data into one position — hold the token, own {index?.stock_count ?? '193'} tokenized stocks on Robinhood Chain.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button onClick={onEnter} className="pill pill-ink text-[0.9375rem]">Try the agents <ArrowRight size={15} /></button>
              <a href="#how" className="pill pill-surface text-[0.9375rem]">How it works</a>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="t-small flex items-center gap-1.5" style={{ color: 'var(--ink-soft)' }}>
                <ShieldCheck size={11} /> No wallet needed to browse.
              </p>
              <ContractChip />
            </div>
          </Rise>
          {/* desktop right: agent console */}
          <div className="hidden justify-end lg:flex rise-in" style={{ animationDelay: '0.25s' }}>
            <AgentConsole quotes={quotes} onEnter={onEnter} />
          </div>
        </div>
      </section>

      {/* ── stock marquee ── */}
      <div className="border-t border-b" style={{ borderColor: 'var(--line)' }}>
        <StockMarquee />
      </div>

      {/* ── how it works ── */}
      <section id="how" style={{ background: 'var(--field-alt)' }}>
        <div className="mx-auto max-w-[1100px] px-4 py-12 sm:px-8 sm:py-18 lg:px-14">
          <Rise>
            <p className="t-mono mb-2.5 text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--signal)' }}>How it works</p>
            <h2 className="font-bold" style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              Two halves,<br />one index.
            </h2>
            <p className="mt-3 max-w-[38ch] text-[0.9375rem] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              Running agents is how you use the index. Holding $CLST is how you own a piece of it.
            </p>
          </Rise>
          <div className="mt-8 space-y-0">
            {STEPS.map((s, i) => (
              <Rise key={s.t} delay={0.07 * i}>
                <div className="flex items-start gap-4 border-t py-5 last:border-b sm:gap-6" style={{ borderColor: 'var(--line)' }}>
                  <span className="t-mono mt-0.5 w-5 shrink-0 text-[11.5px] font-medium" style={{ color: 'var(--signal)' }}>0{i + 1}</span>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>{s.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] font-semibold">{s.t}</p>
                    <p className="mt-0.5 text-[0.875rem] leading-relaxed" style={{ color: 'var(--ink-soft)', maxWidth: '46ch' }}>{s.d}</p>
                  </div>
                </div>
              </Rise>
            ))}
          </div>
        </div>
      </section>

      {/* ── agents ── */}
      <section id="agents" className="on-field">
        <div className="mx-auto max-w-[1100px] px-4 py-12 sm:px-8 sm:py-18 lg:px-14">
          <Rise>
            <p className="t-mono mb-2.5 text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--signal)' }}>The index</p>
            <h2 className="font-bold" style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              Every agent,<br />on the record.
            </h2>
          </Rise>
          <div className="card mt-7 overflow-hidden">
            {AGENTS.map((a, i) => {
              const q = quotes[a.id] && !('error' in quotes[a.id]) ? (quotes[a.id] as { symbol: string; price: number; change_pct: number }) : null
              return (
                <Rise key={a.id} delay={Math.min(i * 0.02, 0.16)}>
                  <button onClick={onEnter}
                    className="group flex w-full items-center gap-3 border-t px-4 py-3 text-left transition-colors first:border-t-0 hover:bg-[#f9f9f9] sm:px-5"
                    style={{ borderColor: 'var(--line)' }}>
                    <AgentAvatar agent={a} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="text-[13.5px] font-semibold">{a.name}</span>
                        <span className="t-mono text-[10.5px]" style={{ color: 'var(--ink-soft)' }}>{a.ticker}</span>
                      </span>
                      <span className="block text-[12px] leading-snug line-clamp-1" style={{ color: 'var(--ink-soft)' }}>{a.blurb}</span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-2 sm:flex">
                      {q && (
                        <span className="t-mono text-right text-[11px]">
                          <span style={{ color: 'var(--ink-soft)' }}>{q.symbol}</span> ${q.price.toLocaleString()}{' '}
                          <span className={q.change_pct >= 0 ? 'delta-up' : 'delta-down'}>{q.change_pct >= 0 ? '+' : ''}{q.change_pct}%</span>
                        </span>
                      )}
                      <span className="t-mono rounded-full px-2.5 py-0.5 text-[10px]" style={{ background: 'var(--field-alt)', color: 'var(--ink-soft)' }}>{a.category}</span>
                      <ArrowRight size={12} style={{ color: 'var(--ink-soft)' }} />
                    </span>
                  </button>
                </Rise>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── basket glance ── */}
      <section id="index" style={{ background: 'var(--field-alt)' }}>
        <div className="mx-auto max-w-[1100px] px-4 py-12 sm:px-8 sm:py-18 lg:px-14">
          <Rise>
            <p className="t-mono mb-2.5 text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--signal)' }}>The basket</p>
            <h2 className="font-bold" style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              The basket,<br />in plain sight.
            </h2>
            <p className="mt-3 max-w-[40ch] text-[0.9375rem] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              Every address re-verified on Robinhood Chain. Symbol, supply, confirmed.
            </p>
          </Rise>
          <Rise delay={0.1} className="mt-7">
            <BasketGlance onEnter={onEnter} />
          </Rise>
        </div>
      </section>

      {/* ── fee loop ── */}
      <section id="fees" className="on-field">
        <div className="mx-auto max-w-[1100px] px-4 py-12 sm:px-8 sm:py-18 lg:px-14">
          <Rise>
            <p className="t-mono mb-2.5 text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--signal)' }}>The mechanism</p>
            <h2 className="font-bold" style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              Fees in.<br />Basket out.
            </h2>
            <p className="mt-3 max-w-[40ch] text-[0.9375rem] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              Every run pays a fee. Fees buy the basket. Basket goes to holders. No claim screen.
            </p>
          </Rise>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {LOOP.map((s, i) => (
              <Rise key={s.t} delay={0.06 * i}>
                <div className="card p-4">
                  <div className="flex items-center justify-between">
                    <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: 'var(--surface-raised)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>{s.icon}</span>
                    <span className="t-mono text-[10.5px]" style={{ color: 'var(--signal)' }}>0{i + 1}</span>
                  </div>
                  <p className="mt-3 text-[13px] font-semibold">{s.t}</p>
                  <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: 'var(--ink-soft)' }}>{s.d}</p>
                </div>
              </Rise>
            ))}
          </div>
          <Rise delay={0.18} className="mt-4">
            <p className="t-small flex items-center gap-1.5" style={{ color: 'var(--ink-soft)' }}>
              <ShieldCheck size={11} /> Cooming soon — no fees settle until $CLST launches.
            </p>
          </Rise>
          <Rise delay={0.22} className="mt-7">
            <div className="card overflow-hidden p-5 sm:p-6">
              <div className="mb-1 flex items-center justify-between">
                <span className="t-mono text-[9.5px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-soft)' }}>Live mechanism</span>
                <span className="t-mono text-[9.5px] uppercase tracking-[0.1em]" style={{ color: 'var(--ink-soft)' }}>fees → basket → holders</span>
              </div>
              <LiveFlow />
            </div>
          </Rise>
          <Rise delay={0.28} className="mt-4">
            <PayoutTicker />
          </Rise>
        </div>
      </section>

      {/* ── docs ── */}
      <LandingDocs />

      {/* ── footer CTA ── */}
      <section className="on-night">
        <div className="mx-auto max-w-[1100px] px-4 py-14 sm:px-8 sm:py-18 lg:px-14">
          <div className="flex flex-col items-start justify-between gap-7 sm:flex-row sm:items-center">
            <Rise>
              <p className="t-mono mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>
                <Radio size={10} /> Cooming soon
              </p>
              <h2 className="font-bold" style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                Run the agents today.<br />Own the index when $CLST ships.
              </h2>
            </Rise>
            <Rise delay={0.1}>
              <button onClick={onEnter} className="pill pill-ink shrink-0">Get started <ArrowRight size={15} /></button>
            </Rise>
          </div>
        </div>
        <div className="border-t px-4 py-4 sm:px-8" style={{ borderColor: 'var(--line)' }}>
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 lg:px-0">
            <span className="flex items-center gap-2">
              <Wordmark size={19} text={14} beta={false} />
              <span className="text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>$CLST is cooming soon. Not investment advice.</span>
            </span>
            <span className="t-mono text-[10px]" style={{ color: 'var(--ink-soft)' }}>
              {AGENTS.length} AGENTS · {index?.stock_count ?? 193} STOCKS · CHAIN 4663
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
