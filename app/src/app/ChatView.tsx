import { useEffect, useMemo, useRef, useState } from 'react'
import { api, signChallenge, type ApiChatModels } from '@/lib/api'
import { useAppKitAccount } from '@reown/appkit/react'
import { useSignMessage } from 'wagmi'
import { Folder, X, Brain,
  Send, Plus, Coins, BrainCircuit,
  LineChart, FlaskConical, Bitcoin, Newspaper, Zap, Loader2,
} from 'lucide-react'
import {
  ModelPicker, OpenAIIcon, ClaudeIcon, GeminiIcon, DeepSeekIcon,
  type PickerProvider, type PickerModel,
} from '@/components/ui/model-picker'

interface Msg { role: 'user' | 'assistant'; content: string; model?: string }

const SKILLS = [
  { id: 'finance', label: 'Finance', icon: LineChart, hint: 'Valuation, filings, ratios' },
  { id: 'research', label: 'Research', icon: FlaskConical, hint: 'Deep dives, comparisons' },
  { id: 'analysis', label: 'Analysis', icon: BrainCircuit, hint: 'Technical + fundamental' },
  { id: 'crypto', label: 'Crypto', icon: Bitcoin, hint: 'On-chain, DEX, wallets' },
  { id: 'trade', label: 'Trade', icon: Zap, hint: 'Quotes, routing, execution' },
  { id: 'news', label: 'News', icon: Newspaper, hint: 'Live market headlines' },
]

/* Model metadata for the picker: provider id per gateway model id prefix,
 * human description, and reasoning/image capability chips (grounded in the
 * gateway catalogue — multimodal models get the image chip). */
const PROVIDER_OF: Record<string, string> = {
  openai: 'openai', anthropic: 'anthropic', gemini: 'google',
  deepseek: 'deepseek', moonshot: 'moonshot', qwen: 'qwen', zai: 'zai', glm: 'zai',
  minimax: 'minimax', xai: 'xai',
}
const PROVIDER_NAME: Record<string, string> = {
  openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', deepseek: 'DeepSeek',
  moonshot: 'Moonshot', qwen: 'Qwen', zai: 'Z.ai', minimax: 'MiniMax', xai: 'xAI',
}
const PROVIDER_ICON: Record<string, React.ReactNode> = {
  openai: <OpenAIIcon className="size-4" />,
  anthropic: <ClaudeIcon className="size-4" />,
  google: <GeminiIcon className="size-4" />,
  deepseek: <img src="/brands/deepseek.jpg" alt="DeepSeek" className="size-4 rounded-full object-cover" />,
  zai: <img src="/brands/zai.jpg" alt="Z.ai" className="size-4 rounded object-cover" />,
  'zai-org': <img src="/brands/zai.jpg" alt="Z.ai" className="size-4 rounded object-cover" />,
  glm: <img src="/brands/zai.jpg" alt="Z.ai" className="size-4 rounded object-cover" />,
  minimax: <img src="/brands/minimax.jpg" alt="MiniMax" className="size-4 rounded object-cover" />,
  qwen: <img src="/brands/qwen.jpg" alt="Qwen" className="size-4 rounded object-cover" />,
  moonshot: <img src="/brands/moonshot.jpg" alt="Moonshot" className="size-4 rounded object-cover" />,
}
const DESCRIPTIONS: Record<string, string> = {
  'openai/gpt-5.6-terra': 'Balanced flagship for long reasoning',
  'openai/gpt-5.6-sol': 'Frontier at a lighter cost',
  'openai/gpt-5.6-luna': 'Fast replies for light work',
  'anthropic/claude-opus-5': 'Deepest reasoning, longest context',
  'anthropic/claude-opus-4.8': 'Previous flagship, still deep',
  'anthropic/claude-sonnet-5': 'Agentic workhorse, great tools',
  'anthropic/claude-sonnet-4.6': 'Balanced everyday Claude',
  'anthropic/claude-fable-5.1': 'Quick drafts at low cost',
  'anthropic/claude-fable-5': 'Cheapest Claude tier',
  'gemini/gemini-3.8-flash': 'Fast multimodal all-rounder',
  'gemini/gemini-3.7-flash-high': 'Deep-think mode, high effort',
  'deepseek/deepseek-v4-pro': 'Strong math and trade planning',
  'deepseek/deepseek-v4.1-flash': 'Very fast, very cheap',
  'deepseek/deepseek-v4-flash': 'Budget fast tier',
  'moonshot/kimi-k3': 'Long-context reasoning',
  'moonshot/kimi-k2.7-code': 'Tuned for code and contracts',
  'qwen/qwen3.8-max': 'Large multilingual generalist',
  'qwen/qwen3.6-plus-uncensored': 'Less-filtered assistant tier',
  'zai/glm-5.3': 'Balanced open flagship',
  'glm/glm-5.3-flash': 'Ultra-fast budget tier',
  'minimax/minimax-m3': 'Efficient balanced tier',
  'anthropic/claude-opus-4.7': 'Legacy flagship',
  'anthropic/claude-opus-4.6': 'Legacy flagship, cheaper',
}

function buildProviders(models: ApiChatModels | null): PickerProvider[] {
  if (!models) return []
  const byProvider = new Map<string, PickerModel[]>()
  for (const m of models.models) {
    const key = (m.id.split('/')[0] ?? '').toLowerCase()
    const provId = PROVIDER_OF[key] ?? key
    const desc = DESCRIPTIONS[m.id] ?? undefined
    const capabilities: ('reasoning' | 'image')[] = []
    if (/opus|deepseek-v4-pro|k3|3.7-flash-high|gpt-6|gpt-5.6-(terra|sol)|qwen3.8/i.test(m.id)) capabilities.push('reasoning')
    if (/gemini|luna|fable|astra|terra|sol/i.test(m.id)) capabilities.push('image')
    const model: PickerModel = {
      id: m.id,
      name: m.label,
      description: desc,
      capabilities: capabilities.length ? capabilities : undefined,
    }
    const list = byProvider.get(provId) ?? []
    list.push(model)
    byProvider.set(provId, list)
  }
  return [...byProvider.entries()].map(([id, list]) => ({
    id,
    name: PROVIDER_NAME[id] ?? id.charAt(0).toUpperCase() + id.slice(1),
    icon: PROVIDER_ICON[id],
    models: list,
  }))
}

export function ChatView({ onCredit }: { onCredit?: (n: number | null) => void }) {
  const { address, isConnected } = useAppKitAccount()
  const { signMessageAsync } = useSignMessage()
  const wallet = address ?? ''
  const [models, setModels] = useState<ApiChatModels | null>(null)
  const [model, setModel] = useState<string>('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [credit, setCredit] = useState<number | null>(null)
  const [skill, setSkill] = useState<string>('finance')
  const [err, setErr] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  const [projects, setProjects] = useState<{ id: string; name: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('cluster-projects') ?? '[]') } catch { return [] }
  })
  const [activeProject, setActiveProject] = useState<string | null>(null)
  const [newProject, setNewProject] = useState('')
  const [showProjects, setShowProjects] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { localStorage.setItem('cluster-projects', JSON.stringify(projects)) }, [projects])

  useEffect(() => {
    api.getChatModels().then((m) => {
      setModels(m)
      setModel((cur) => cur || m.models[0]?.id || '')
    }).catch(() => setModels(null))
  }, [])

  useEffect(() => {
    if (!wallet) { setCredit(null); onCredit?.(null); return }
    api.getCredits(wallet).then((c) => { setCredit(c.remaining_usd); onCredit?.(c.remaining_usd) })
      .catch(() => { setCredit(null); onCredit?.(null) })
  }, [wallet]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, busy])

  const send = async () => {
    const text = input.trim()
    if (!text || busy || !wallet) return
    setErr(null)
    const next: Msg[] = [...msgs, { role: 'user', content: text }]
    setMsgs(next)
    setInput('')
    setBusy(true)
    try {
      const signature = await signChallenge(wallet, signMessageAsync)
      const res = await api.chat({
        wallet, model, signature,
        messages: next.map((m) => ({ role: m.role, content: m.content })),
      })
      setMsgs([...next, { role: 'assistant', content: res.reply, model: res.model }])
      setCredit(res.credit.remaining_usd)
      onCredit?.(res.credit.remaining_usd)
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Request failed'
      if (raw.includes('401')) setErr('Session expired — send again to re-sign with your wallet.')
      else if (raw.includes('402')) setErr('Credit exhausted. Top-ups are not open yet.')
      else if (raw.includes('429')) setErr('Too many requests — wait a minute and try again.')
      else setErr(raw.replace(/Cluster API \d+: /, '').replace(/[{}"\[\]]/g, '').slice(0, 140) || 'Request failed')
      setMsgs(next)
    } finally {
      setBusy(false)
    }
  }

  const pickerProviders = useMemo(() => buildProviders(models), [models])

  return (
    <div className="flex h-full">
      {/* main thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b px-4 py-3 lg:px-6" style={{ borderColor: 'var(--line)' }}>
          <button
            onClick={() => { setMsgs([]); setErr(null) }}
            className="flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12.5px]"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink-soft)' }}
          >
            <Plus size={13} /> New
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowProjects((s) => !s)}
              className="flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12.5px]"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink-soft)' }}
            >
              <Folder size={13} /> {activeProject ? projects.find(p => p.id === activeProject)?.name ?? 'Project' : 'Projects'}
            </button>
            <span className="chip chip-accent">
              <Coins size={11} />
              {credit == null ? '$5 credit' : `$${credit.toFixed(2)}`}
            </span>
          </div>
        </div>

        {showProjects && (
          <div className="border-b px-4 py-3 lg:px-6" style={{ borderColor: 'var(--line)', background: 'var(--field-alt)' }}>
            <div className="mx-auto flex max-w-[720px] flex-wrap items-center gap-2">
              <input
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newProject.trim()) {
                    const pr = { id: `proj-${Date.now()}`, name: newProject.trim() }
                    setProjects([...projects, pr])
                    setActiveProject(pr.id)
                    setMsgs([]); setErr(null)
                    setNewProject('')
                  }
                }}
                placeholder="New project name…"
                className="h-8 min-w-0 flex-1 rounded-full border px-3 text-[12.5px] outline-none"
                style={{ borderColor: 'var(--line)', background: 'var(--field)', color: 'var(--ink)' }}
              />
              {projects.map((p) => (
                <button key={p.id} onClick={() => { setActiveProject(p.id); setMsgs([]); setErr(null) }}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px]"
                  style={{
                    background: activeProject === p.id ? 'var(--accent)' : 'var(--surface)',
                    color: activeProject === p.id ? 'var(--field)' : 'var(--ink-soft)',
                    borderColor: 'var(--line)',
                  }}>
                  {p.name}
                  {activeProject === p.id && (
                    <X size={11} onClick={(e) => { e.stopPropagation(); setActiveProject(null) }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
          {msgs.length === 0 && (
            <div className="mx-auto max-w-[720px]">
              <h2 className="t-display" style={{ fontSize: 'clamp(1.5rem,2.4vw,2rem)' }}>
                Ask the index anything.
              </h2>
              <p className="muted mt-2 text-[14px]">
                Memory-backed agents with finance, research, analysis, crypto and trade skills.
                Every wallet gets <strong style={{ color: 'var(--ink)' }}>$5</strong> of inference credit on first connect.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {[
                  'What is Cluster and how does the payout basket work?',
                  'Compare NVDA and AMD valuation on the tokenized universe.',
                  'Which sectors are leading today and why?',
                  'How do I install the MCP server and connect an agent?',
                ].map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="card card-tile px-3.5 py-3 text-left text-[13px] transition-colors hover:brightness-110"
                    style={{ color: 'var(--ink-soft)' }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mx-auto max-w-[720px] space-y-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`bubble-${m.role === 'user' ? 'user' : 'agent'} max-w-[85%] px-4 py-3 text-[14px] leading-relaxed`}>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  {m.model && (
                    <div className="mt-2 text-[11px] opacity-60">{m.model}</div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bubble-agent flex items-center gap-2 px-4 py-3 text-[13px]" style={{ color: 'var(--ink-soft)' }}>
                  <Loader2 size={14} className="animate-spin" /> Thinking…
                </div>
              </div>
            )}
            {err && (
              <div className="chip chip-bad mx-auto">{err}</div>
            )}
          </div>
        </div>

        {/* composer */}
        <div className="border-t px-4 pb-16 pt-3 lg:px-6 lg:pb-3" style={{ borderColor: 'var(--line)' }}>
          {!isConnected && (
            <div className="mb-2 text-center text-[12px]" style={{ color: 'var(--warn)' }}>
              Connect a wallet to claim your $5 credit and chat.
            </div>
          )}
          <div
            className="mx-auto flex max-w-[720px] items-end gap-2 rounded-[16px] border p-2"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
              rows={1}
              placeholder={isConnected ? 'Ask about markets, filings, on-chain data…' : 'Connect wallet to start'}
              disabled={!isConnected}
              className="max-h-[160px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] outline-none disabled:opacity-50"
              style={{ color: 'var(--ink)' }}
            />
            <button
              onClick={() => void send()}
              disabled={busy || !input.trim() || !isConnected}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}
              aria-label="Send"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          {/* model selector — below the composer */}
          <div className="mx-auto mt-2 flex max-w-[720px] items-center gap-2">
            <button
              onClick={() => setThinking((t) => !t)}
              title="Extended reasoning pass — the model thinks harder before answering"
              className="flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] transition-colors"
              style={{
                background: thinking ? 'var(--accent)' : 'var(--surface)',
                color: thinking ? 'var(--field)' : 'var(--ink-soft)',
                borderColor: 'var(--line)',
              }}
            >
              <Brain size={13} /> Thinking {thinking ? 'on' : 'off'}
            </button>
            <ModelPicker
              providers={pickerProviders}
              value={model}
              onValueChange={(id) => setModel(id)}
              side="top"
              align="start"
              placeholder="Select model"
            />
          </div>
        </div>
      </div>

      {/* skills rail */}
      <aside className="hidden w-[240px] shrink-0 border-l xl:block" style={{ borderColor: 'var(--line)' }}>
        <div className="group-label px-4 pb-2 pt-4">Agent skills</div>
        <div className="space-y-1 px-2.5">
          {SKILLS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSkill(s.id)}
              className="flex w-full items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition-colors"
              style={{
                background: skill === s.id ? 'var(--surface-raised)' : 'transparent',
                boxShadow: skill === s.id ? 'inset 0 0 0 1px var(--line)' : 'none',
              }}
            >
              <s.icon size={15} style={{ color: skill === s.id ? 'var(--accent)' : 'var(--ink-soft)' }} className="mt-0.5 shrink-0" />
              <span>
                <span className="block text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{s.label}</span>
                <span className="block text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>{s.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="mx-2.5 mt-3 rounded-[12px] border p-3" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
            <BrainCircuit size={13} style={{ color: 'var(--accent)' }} /> Memory
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Notes you keep are stored against your wallet and recalled in later sessions.
          </p>
        </div>
      </aside>
    </div>
  )
}
