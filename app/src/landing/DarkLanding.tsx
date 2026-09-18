/**
 * DarkLanding — direct adaptation of the Hirael Mindloop template.
 * Uses the ACTUAL background videos from the template (not particle canvas).
 * Email/SUBSCRIBE pill removed — replaced with "Open app" CTAs.
 *
 * Structure: Navbar → Hero(video) → Search → Mission(video) → Solution(video) → CTA(HLS video) → Footer
 */
import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue, AnimatePresence } from 'framer-motion'
import { ArrowRight, ShieldCheck, Brain, Vault, Repeat, LineChart, ArrowLeftRight, PieChart, Bot, KeyRound, Blocks, Copy } from 'lucide-react'
import { Link } from 'react-router'
import { Wordmark } from '@/components/BrandMark'
import { ConnectButton } from '@/components/ConnectButton'
import { api, type ApiIndex } from '@/lib/api'
import { BasketGlance } from './BasketGlance'
import { LiveFlow } from './LiveFlow'
import { PayoutTicker } from './PayoutTicker'

const EASE = [0.22, 1, 0.36, 1] as const

// ─── Mindloop template assets ────────────────────────────────────────────────
const HERO_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_120549_0cd82c36-56b3-4dd9-b190-069cfc3a623f.mp4'
const MISSION_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_132944_a0d124bb-eaa1-4082-aa30-2310efb42b4b.mp4'
const SOLUTION_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_125119_8e5ae31c-0021-4396-bc08-f7aebeb877a2.mp4'
const CTA_HLS = 'https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8'

const INTEGRATIONS: { name: string; icon?: string }[] = [
  { name: 'Claude', icon: '/brands/claude.jpg' },
  { name: 'Codex', icon: '/brands/codex.jpg' },
  { name: 'Hermes', icon: '/brands/hermes.jpg' },
  { name: 'Cursor', icon: '/brands/cursor.jpg' },
  { name: 'Windsurf', icon: '/brands/windsurf.jpg' },
  { name: 'OpenBB', icon: '/brands/openbb.jpg' },
  { name: 'Robinhood', icon: '/brands/robinhood.jpg' },
  { name: 'OpenClaw', icon: '/brands/openclaw.jpg' },
  { name: 'PONS', icon: '/brands/pons.jpg' },
  { name: 'npm', icon: '/brands/npm.jpg' },
  { name: 'GitHub', icon: '/brands/github.png' },
]
const FOOTER_LINKS = [
  { heading: 'PLATFORM', links: ['Agent Console', 'Live Markets', 'In-App Swap', 'Basket Index', 'Distribution'] },
  { heading: 'CAPABILITIES', links: ['Research Agent', 'Trading Agent', 'Memory Agent', 'Finance Agent', 'Analysis Agent'] },
  { heading: 'RESOURCES', links: ['Documentation', 'API Reference', 'Swap Guide', 'On-Chain Verify', 'MCP Server'] },
  { heading: 'GET STARTED', links: ['Try an Agent', 'Connect Wallet', 'Buy $CLST', 'Join Community', 'Read the Docs'] },
]

// ─── icons ────────────────────────────────────────────────────────────────────
function XIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41Z" /></svg>
}
function TelegramIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M23.9 3.6 20.3 20.5c-.27 1.2-.98 1.5-1.98.93l-5.5-4.05-2.65 2.55c-.29.29-.54.54-1.1.54l.39-5.57L19.6 5.9c.44-.39-.1-.61-.68-.22L6.4 13.9.97 12.2c-1.18-.37-1.2-1.18.25-1.75L22.5 2.03c.98-.36 1.84.22 1.4 1.57Z" /></svg>
}

// ─── Serif accent ─────────────────────────────────────────────────────────────
function Serif({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>{children}</span>
}

// ─── fade-up hook ─────────────────────────────────────────────────────────────
function useFadeUp() {
  const reduce = useReducedMotion() ?? false
  return (delay = 0) => ({
    initial: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-100px' } as const,
    transition: reduce ? { duration: 0 } : { duration: 0.6, delay, ease: EASE },
  })
}

// ─── liquid-glass ────────────────────────────────────────────────────────────
function Glass({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={className} style={{
      background: 'rgba(255,255,255,0.01)',
      backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)',
      position: 'relative', overflow: 'hidden', ...style,
    }}>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', padding: '1.4px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, transparent 40%, transparent 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%)',
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor', maskComposite: 'exclude', pointerEvents: 'none',
      }} />
      {children}
    </div>
  )
}

// ─── Avatar row ───────────────────────────────────────────────────────────────
function AvatarRow() {
  const tones = [['#dcdcdc', '#8f8f8f'], ['#bfbfbf', '#6f6f6f'], ['#a6a6a6', '#545454']]
  return (
    <div className="flex -space-x-2">
      {tones.map((t, i) => (
        <span key={i} className="inline-flex h-8 w-8 overflow-hidden rounded-full border-2 border-black">
          <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden>
            <defs><linearGradient id={`av-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t[0]} /><stop offset="100%" stopColor={t[1]} /></linearGradient></defs>
            <rect width="32" height="32" fill={`url(#av-${i})`} />
            <circle cx="16" cy="13" r="5" fill="#0a0a0a" opacity="0.28" />
            <path d="M6 30c0-5.5 4.5-9 10-9s10 3.5 10 9Z" fill="#0a0a0a" opacity="0.28" />
          </svg>
        </span>
      ))}
    </div>
  )
}

// ─── Word scroll reveal ───────────────────────────────────────────────────────
function Word({ token, index, total, progress, reduce, highlight }: {
  token: string; index: number; total: number; progress: MotionValue<number>; reduce: boolean; highlight: boolean
}) {
  const start = index / total
  const end = (index + 0.9) / total
  const opacity = useTransform(progress, [start, end], [0.15, 1])
  return <motion.span style={reduce ? undefined : { opacity, color: highlight ? '#ffffff' : undefined }}>{token}{' '}</motion.span>
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ onEnter }: { onEnter: () => void }) {
  const fade = useFadeUp()
  return (
    <section id="home" className="relative flex h-dvh w-full flex-col items-center justify-center overflow-hidden">
      <video className="absolute inset-0 h-full w-full object-cover" src={HERO_VIDEO} autoPlay loop muted playsInline aria-hidden />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-64" style={{ background: 'linear-gradient(to top, #000 0%, transparent 100%)' }} />
      <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 90% 55% at 50% 42%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.28) 55%, transparent 100%)' }} />
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-28 text-center md:pt-32">
        <motion.div {...fade(0)} className="hidden">
          <AvatarRow />
        </motion.div>
        <motion.h1 {...fade(0.1)} className="mt-6 w-full text-[2.35rem] leading-[1.05] font-medium tracking-[-1.5px] sm:text-5xl md:text-7xl lg:text-8xl" style={{ textShadow: '0 2px 18px rgba(0,0,0,0.65)' }}>
          Give your agents <Serif>the market.</Serif>
        </motion.h1>
        <motion.p {...fade(0.2)} className="mt-6 w-full max-w-xl text-[15px] sm:text-lg" style={{ color: 'rgba(240,240,240,0.92)', textShadow: '0 1px 12px rgba(0,0,0,0.8)' }}>
          AI agent index for finance, research, trading and memory agents. Hold $CLST. Earn multi stock from the basket.
        </motion.p>
        {/* CTA buttons — NO email/SUBSCRIBE */}
        <motion.div {...fade(0.3)} className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <motion.button onClick={onEnter} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="rounded-lg bg-white px-8 py-3.5 text-sm font-semibold text-black">Open app</motion.button>
          <motion.button onClick={() => document.getElementById('use-cases')?.scrollIntoView({ behavior: 'smooth' })} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="rounded-lg px-8 py-3.5 text-sm font-semibold text-white" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)' }}>How it works</motion.button>
        </motion.div>
        <motion.div {...fade(0.4)} className="mt-5">
          <button
            onClick={() => { navigator.clipboard?.writeText('0x0000000000000000000000000000000000000000').catch(() => {}) }}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2 font-mono text-[12px] transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }}
            title="Copy contract address"
          >
            <span style={{ color: 'rgba(255,255,255,0.35)' }}>CA:</span>
            <span>0x0000000000000000000000000000000000000000</span>
            <Copy size={11} style={{ color: 'rgba(255,255,255,0.35)' }} />
          </button>
          <p className="mt-2 text-[10.5px]" style={{ color: 'rgba(255,255,255,0.28)' }}>$CLST cooming soon — contract address goes live at launch. Tap to copy.</p>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Install (skill install — npm / GitHub / MCP, ala finchagentic) ─────────
function Install() {
  const fade = useFadeUp()
  const [copied, setCopied] = useState<string | false>(false)
  const copy = async (id: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(false), 1600) } catch { /* clipboard unavailable */ }
  }
  /* Inline runtime marks (monochrome, matches landing aesthetic) */
function ClaudeMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 4v16M4 12h16M6.3 6.3l11.4 11.4M17.7 6.3L6.3 17.7" />
    </svg>
  )
}
function NpmMark() {
  return (
    <span className="grid h-5 w-5 place-items-center rounded-[4px] text-[7px] font-black tracking-tighter" style={{ background: 'rgba(255,255,255,0.9)', color: '#000' }}>npm</span>
  )
}
function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="rgba(255,255,255,0.85)">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.66.41.36.77 1.05.77 2.13v3.16c0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  )
}

const INSTALLS: { id: string; name: string; cmd: string; icon?: string; svg?: React.ReactNode }[] = [
    { id: 'claude', name: 'Claude Code', svg: <ClaudeMark />, cmd: 'claude mcp add cluster --transport http https://agentindex-api.fly.dev/mcp' },
    { id: 'codex', name: 'Codex', icon: '/brands/codex.jpg', cmd: 'codex mcp add cluster --url https://agentindex-api.fly.dev/mcp' },
    { id: 'hermes', name: 'Hermes', icon: '/brands/hermes.jpg', cmd: 'hermes skill install https://raw.githubusercontent.com/rimurucook/cluster/main/skill/SKILL.md' },
    { id: 'openclaw', name: 'OpenClaw', icon: '/brands/openclaw.jpg', cmd: 'openclaw mcp add cluster https://agentindex-api.fly.dev/mcp' },
    { id: 'npm', name: 'npm', svg: <NpmMark />, cmd: 'npm install cluster' },
    { id: 'github', name: 'GitHub', svg: <GithubMark />, cmd: 'git clone https://github.com/rimurucook/cluster' },
  ]
  return (
    <section id="install" className="px-5 pb-6 pt-32 sm:px-10 md:pt-48">
      <div className="mx-auto max-w-5xl text-center">
        <motion.h2 {...fade(0)} className="text-5xl tracking-[-2px] md:text-7xl lg:text-8xl">
          Install the <Serif>skill.</Serif> Anywhere.
        </motion.h2>
        <motion.p {...fade(0.1)} className="mx-auto mt-8 mb-16 max-w-2xl text-lg" style={{ color: 'rgba(255,255,255,0.45)' }}>
          One skill, every agent runtime. Claude, Codex, Hermes, OpenClaw — or pull it straight from npm and GitHub. Finance, research, trading and memory skills ship inside.
        </motion.p>
        <div className="mb-20 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {INSTALLS.map((it, i) => (
            <motion.div key={it.id} {...fade(0.06 * i)} className="min-w-0 rounded-2xl p-4 text-left" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  {it.icon ? (
                    <img src={it.icon} alt={it.name} className="h-5 w-5 rounded-md object-cover" style={{ border: '1px solid rgba(255,255,255,0.12)' }} />
                  ) : it.svg ? (
                    it.svg
                  ) : (
                    <span className="h-2 w-2 rounded-full" style={{ background: 'rgba(255,255,255,0.35)' }} />
                  )}
                  {it.name}
                </span>
                <button onClick={() => copy(it.id, it.cmd)} className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium transition-colors" style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }}>
                  {copied === it.id ? <>Copied</> : <>Copy</>}
                </button>
              </div>
              <code className="block max-w-full overflow-x-auto whitespace-nowrap rounded-lg px-3 py-2.5 font-mono text-[11px] code-scroll" style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>
                $ {it.cmd}
              </code>
            </motion.div>
          ))}
        </div>
        <motion.p {...fade(0)} className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
          MCP transport for tools. SKILL.md for the recipe. Same skill file everywhere.
        </motion.p>
      </div>
    </section>
  )
}

// ─── Mission ──────────────────────────────────────────────────────────────────
function Mission() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion() ?? false
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.4'] })
  const P1 = "We are building the finance layer for agentic AI — where agents earn, the index grows, and every holder collects from the basket. No staking, no lockup, no fake yield."
  const P2 = "A protocol where memory, skills, and on-chain execution flow together, with less friction and more meaning for everyone involved."
  const highlights = ['agents', 'earn,', 'index', 'grows,', 'holder', 'collects']
  const tokens1 = P1.split(' ').map(w => ({ text: w, highlight: highlights.includes(w) }))
  const tokens2 = P2.split(' ').map(w => ({ text: w, highlight: false }))
  const total = tokens1.length + tokens2.length
  return (
    <section id="philosophy" className="px-5 pb-20 pt-0 sm:px-10 md:pb-32">
      <div className="mx-auto flex max-w-4xl flex-col items-center">
        <video className="w-full max-w-[800px] rounded-2xl object-cover" src={MISSION_VIDEO} autoPlay loop muted playsInline aria-hidden />
        <div ref={ref} className="mt-16 w-full text-center md:mt-20">
          <p className="text-2xl font-medium tracking-[-1px] md:text-4xl lg:text-5xl" style={{ color: 'rgba(224,224,224,0.9)' }}>
            {tokens1.map((t, i) => <Word key={i} token={t.text} index={i} total={total} progress={scrollYProgress} reduce={reduce} highlight={t.highlight} />)}
          </p>
          <p className="mt-10 text-xl font-medium md:text-2xl lg:text-3xl" style={{ color: 'rgba(224,224,224,0.9)' }}>
            {tokens2.map((t, i) => <Word key={i} token={t.text} index={tokens1.length + i} total={total} progress={scrollYProgress} reduce={reduce} highlight={t.highlight} />)}
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── Solution ─────────────────────────────────────────────────────────────────
function Solution() {
  const fade = useFadeUp()
  const FEATURES = [
    { title: 'Agent Console', description: 'Run finance, research, trading and memory agents. Every action logs on-chain to your wallet.' },
    { title: 'Live Markets', description: 'Real stock quotes, candlestick charts, and in-app swap via Uniswap v3 on Robinhood Chain.' },
    { title: 'Tokenized Basket', description: '193 verified stock tokens. 19 in the payout basket. Every address confirmed on-chain.' },
    { title: 'Auto Distribution', description: 'Agent fees pool, buy the basket, and push to every $CLST holder — pro-rata, automatically.' },
  ]
  return (
    <section id="how-it-works" className="border-t border-white/[0.06] px-5 py-20 sm:px-10 md:py-32">
      <div className="mx-auto max-w-6xl">
        <motion.p {...fade(0)} className="text-xs uppercase tracking-[3px]" style={{ color: 'rgba(255,255,255,0.35)' }}>SOLUTION</motion.p>
        <motion.h2 {...fade(0.1)} className="mt-6 max-w-3xl text-4xl tracking-[-1px] md:text-6xl">The platform for <Serif>meaningful</Serif> agents</motion.h2>
        <motion.div {...fade(0.2)} className="mt-12">
          <video className="aspect-[3/1] w-full rounded-2xl object-cover" src={SOLUTION_VIDEO} autoPlay loop muted playsInline aria-hidden />
        </motion.div>
        <div className="mt-16 grid gap-8 md:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} {...fade(0.1 * i)}>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{f.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA with HLS background (from Mindloop template) ────────────────────────
function HlsBackgroundVideo({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video) return
    let hls: InstanceType<typeof import('hls.js')['default']> | undefined
    let cancelled = false
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      const el = ref.current
      if (!el) return
      if (Hls.isSupported()) {
        hls = new Hls()
        hls.loadSource(src)
        hls.attachMedia(el)
      } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
        el.src = src
      }
    })
    return () => { cancelled = true; hls?.destroy() }
  }, [src])
  return <video ref={ref} className={className} autoPlay loop muted playsInline aria-hidden />
}

function CTA({ onEnter }: { onEnter: () => void }) {
  const fade = useFadeUp()
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06] px-5 py-24 sm:px-10 md:py-36">
      <HlsBackgroundVideo
        src={CTA_HLS}
        className="absolute inset-0 z-0 h-full w-full object-cover"
      />
      <div aria-hidden className="absolute inset-0 z-[1]" style={{ background: 'rgba(0,0,0,0.45)' }} />
      <motion.div {...fade(0)} className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center">
        <h2 className="text-4xl tracking-[-1px] md:text-6xl">Start Your <Serif>Journey</Serif></h2>
        <p className="mt-6 max-w-lg text-lg" style={{ color: 'rgba(255,255,255,0.55)' }}>Run agents today. Own the index when $CLST ships. No credit card, no email — your wallet is the account.</p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <motion.button onClick={onEnter} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="rounded-lg bg-white px-8 py-3.5 text-sm font-semibold text-black">Open app</motion.button>
          <motion.button onClick={() => document.getElementById('philosophy')?.scrollIntoView({ behavior: 'smooth' })} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="inline-flex rounded-lg px-8 py-3.5 text-sm font-semibold text-white" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)' }}>Learn more</motion.button>
        </div>
      </motion.div>
    </section>
  )
}

// ─── Basket + Mechanism (unified section) ─────────────────────────────────────
function CapabilitiesSection() {
  const fade = useFadeUp()
  const CAPS: { icon: string; title: string; desc: string; badge: string; tags: string[] }[] = [
    {
      icon: 'Brain', title: 'Persistent memory', desc: 'The agent remembers your watchlist, positions and research across sessions — not just the current chat.',
      badge: 'CORE', tags: ['memory_add', 'memory_search'],
    },
    {
      icon: 'Vault', title: 'The vault', desc: 'Fees accumulate in the vault; the keeper bot sweeps the 19-name payout basket at live market prices.',
      badge: 'MECHANISM', tags: ['vault_balance', 'vault_history'],
    },
    {
      icon: 'Repeat', title: 'Payout cycles', desc: '$CLST holders are paid pro-rata every cycle. Every transfer lands on the public feed, per address.',
      badge: 'MECHANISM', tags: ['distributions', 'payroll'],
    },
    {
      icon: 'LineChart', title: 'Live quotes & movers', desc: 'Realtime quotes, gainers/losers, sector heat and Yahoo news across the 192-instrument universe.',
      badge: 'MCP', tags: ['get_quotes', 'get_movers', 'get_news'],
    },
    {
      icon: 'ArrowLeftRight', title: 'Swap on 4663', desc: 'Execute real swaps on Robinhood Chain via Uniswap v3 routing — quote, approve, swap, confirm.',
      badge: 'MCP', tags: ['quote_swap', 'execute_swap'],
    },
    {
      icon: 'PieChart', title: 'Index & basket', desc: 'Full index composition, weights and the payout basket — re-verified on-chain, never invented.',
      badge: 'MCP', tags: ['get_index', 'payout_basket'],
    },
    {
      icon: 'Bot', title: 'Run agents', desc: 'Spawn finance, research, analysis, crypto, trade and news agents — each with its own skill pack.',
      badge: 'CORE', tags: ['agent_run', 'agent_list'],
    },
    {
      icon: 'KeyRound', title: 'API keys & metering', desc: 'Self-serve keys with per-request metering: requests, tokens, USD — visible in realtime.',
      badge: 'CORE', tags: ['create_key', 'usage'],
    },
    {
      icon: 'Blocks', title: 'Works everywhere MCP runs', desc: 'Claude, Codex, Hermes, OpenClaw — or plain npm and GitHub. One SKILL.md, every runtime.',
      badge: 'MCP', tags: ['mcp', 'skill.md'],
    },
  ]
  const ICONS: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
    Brain, Vault, Repeat, LineChart, ArrowLeftRight, PieChart, Bot, KeyRound, Blocks,
  }
  return (
    <section id="index" className="relative border-t border-white/[0.05]">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 60%)' }} />
      <div className="relative mx-auto max-w-[1100px] px-5 py-14 sm:px-8 sm:py-20 lg:px-14">
        <motion.div {...fade(0)} className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[3px]" style={{ color: 'rgba(255,255,255,0.3)' }}>MCP CAPABILITIES</p>
            <h2 className="text-4xl tracking-[-1px] md:text-6xl">Memory. Agents. <Serif>Tools that stick.</Serif></h2>
          </div>
          <p className="max-w-[34ch] text-[13px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Cluster is not one skill — it is a whole toolbox: memory, the vault, live markets, swaps and payout cycles, exposed over MCP.
          </p>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CAPS.map((c, i) => {
            const Icon = ICONS[c.icon]
            return (
              <motion.div key={c.title} {...fade(0.04 * i)} className="rounded-2xl p-5" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex size-8 items-center justify-center rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}>
                    {Icon && <Icon size={15} style={{ color: 'rgba(255,255,255,0.8)' }} />}
                  </div>
                  <span className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]" style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)' }}>{c.badge}</span>
                </div>
                <p className="mt-3.5 text-[14.5px] font-semibold tracking-tight">{c.title}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>{c.desc}</p>
                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  {c.tags.map((t) => (
                    <span key={t} className="rounded-md px-1.5 py-0.5 font-mono text-[9.5px]" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}>{t}</span>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>

        <motion.div {...fade(0.2)} className="mt-6 flex flex-col items-start justify-between gap-3 rounded-2xl px-5 py-4 sm:flex-row sm:items-center" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-[12.5px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Cooming soon — nothing settles until $CLST launches; payout figures stay honest zeros until the first cycle lands.
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.3)' }}>fees → basket → holders</span>
        </motion.div>
      </div>
    </section>
  )
}


/* ══════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════ */
export function DarkLanding({ onEnter }: { onEnter: () => void }) {
  return (
    <div style={{ background: '#000000', color: '#ffffff', fontFamily: 'Inter, -apple-system, sans-serif' }}>

      {/* ── NAVBAR ─────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 px-5 py-4 sm:px-10 md:px-16">
        <nav className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Wordmark size={24} text={16} beta={false} dark /></button>
            <div className="hidden items-center gap-6 ps-4 lg:flex">
              {['How it works', 'Philosophy', 'Install'].map((item) => (
                <button key={item} onClick={() => {
                  const id = item === 'How it works' ? 'how-it-works' : item === 'Philosophy' ? 'philosophy' : 'use-cases'
                  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
                }} className="text-sm transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.55)' }}>{item}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 sm:flex">
              <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="X" className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.5)' }}><XIcon /></a>
              <a href="https://t.me" target="_blank" rel="noreferrer" aria-label="Telegram" className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.5)' }}><TelegramIcon /></a>
            </span>
            <button onClick={onEnter} className="hidden px-3 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-100 sm:block" style={{ color: 'rgba(255,255,255,0.6)' }}>Open app</button>
            <ConnectButton dark />
          </div>
        </nav>
      </header>

      <Hero onEnter={onEnter} />

      {/* ── INTEGRATED WITH ────────────────────────────── */}
      <section className="overflow-hidden border-t border-white/[0.05]">
        <p className="mb-6 pt-10 text-center text-[10.5px] uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.3)' }}>Integrated with</p>
        <div className="dark-marquee pb-10">
          <div className="dark-marquee-track flex w-max items-center gap-12">
            {[...INTEGRATIONS, ...INTEGRATIONS].map((n, i) => (
              <span key={`${n.name}-${i}`} className="flex items-center gap-2.5 whitespace-nowrap text-[15px] font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {n.icon ? (
                  <img src={n.icon} alt={n.name} className="h-7 w-7 rounded-lg object-cover" style={{ border: '1px solid rgba(255,255,255,0.15)' }} />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold" style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.75)' }}>{n.name.slice(0,1)}</span>
                )}
                {n.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <Install />
      <Mission />
      <Solution />
      <CapabilitiesSection />
      <CTA onEnter={onEnter} />

      {/* ── FOOTER ─────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] px-5 py-12 sm:px-10 md:px-16">
        <div className="mx-auto max-w-[1100px]">
          <div className="grid grid-cols-2 gap-8 pb-10 sm:grid-cols-4">
            {FOOTER_LINKS.map((col) => (
              <div key={col.heading}>
                <p className="mb-4 font-mono text-[9.5px] uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.26)' }}>{col.heading}</p>
                <ul className="space-y-2.5">
                  {col.links.map((l) => {
                    return <li key={l}><a href="#" onClick={(e) => { e.preventDefault(); onEnter() }} className="block text-[12.5px] transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.5)' }}>{l}</a></li>
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-white/[0.05] pt-6 sm:flex-row">
            <span className="flex items-center gap-2"><Wordmark size={16} text={12} beta={false} dark /><span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>$CLST is cooming soon. Not investment advice.</span></span>
            <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>© 2026 AGENTINDEX. ALL RIGHTS RESERVED.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
