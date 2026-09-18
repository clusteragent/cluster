/**
 * AppShell — rebuilt with the shadcn-admin dashboard pattern.
 * SidebarProvider + AppSidebar (wide, collapsible, grouped nav, user
 * dropdown) + SidebarInset main area with header.
 */
import { useEffect, useState } from 'react'
import { type AppView } from './Sidebar'
import { Search, Bell, User, ChevronDown, Sun, Moon } from 'lucide-react'
import { AppSidebar } from './shell/AppSidebar'
import { PortfolioView } from './PortfolioView'
import { DistributionView } from './DistributionView'
import { MarketsView } from './MarketsView'
import { ChatView } from './ChatView'
import { SettingsView } from './SettingsView'
import { ProfileView } from './ProfileView'
import { RunModal } from './RunModal'
import { AnimatePresence, motion } from 'framer-motion'
import { type Agent, type HistoryEvent } from '@/data/agents'
import { api, signChallenge } from '@/lib/api'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useSignMessage } from 'wagmi'
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTheme } from '@/lib/theme'

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  if (diffMs < 5 * 60_000) return 'Now'
  return d.toLocaleDateString(undefined, { weekday: 'short' })
}

export function AppShell({ onBack, onDocs }: { onBack: () => void; onDocs: () => void }) {
  const { address, isConnected } = useAppKitAccount()
  const { open } = useAppKit()
  const { signMessageAsync } = useSignMessage()
  const wallet = address ?? ''
  const [view, setView] = useState<AppView>('portfolio')
  const [history, setHistory] = useState<HistoryEvent[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalAgent, setModalAgent] = useState<Agent | null>(null)
  const [, setCredit] = useState<number | null>(null)

  const loadHistory = async () => {
    if (!wallet) return
    try {
      const signature = await signChallenge(wallet, signMessageAsync)
      const data = await api.getHistory(wallet, signature)
      setHistory(data.events.map((e) => ({
        id: String(e.id), agentId: e.agent_id, label: e.agent_name ?? e.agent_id,
        detail: e.detail, day: dayLabel(e.created_at), status: 'logged' as const,
      })))
    } catch { setHistory([]) }
  }

  const loadCredit = async () => {
    if (!wallet) { setCredit(null); return }
    try {
      const c = await api.getCredits(wallet)
      setCredit(c.remaining_usd)
    } catch { setCredit(null) }
  }

  useEffect(() => { loadHistory(); loadCredit() }, [wallet]) // eslint-disable-line react-hooks/exhaustive-deps

  const openUpload = () => { setModalAgent(null); setModalOpen(true) }
  const runAgent = (a: Agent) => { setModalAgent(a); setModalOpen(true) }

  const handleSubmit = async (agent: Agent, label: string) => {
    if (!wallet) return
    try {
      const signature = await signChallenge(wallet, signMessageAsync)
      await api.tryAgent(agent.id, wallet, signature, label)
      await loadHistory()
    } catch { /* noop */ }
  }

  return (
    <TooltipProvider>
    <SidebarProvider style={{ '--sidebar-width': '16rem' } as React.CSSProperties}>
      <AppSidebar
        view={view}
        onView={(v) => setView(v as AppView)}
        onBack={onBack}
      />
      <SidebarInset className="min-w-0 overflow-x-clip">
        <Header view={view} onView={setView} />
        <div className={view === 'chat' ? 'flex-1 overflow-hidden' : 'flex-1 overflow-y-auto'}>
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className={view === 'chat' ? 'h-full p-4 md:p-6' : 'min-h-full p-4 md:p-6'}
            >
              {view === 'portfolio' && (
                <PortfolioView
                  history={history} connected={isConnected}
                  onConnect={() => open()} onUpload={openUpload}
                  onBrowse={() => setView('agents')}
                  onViewIndex={() => setView('markets')}
                  onViewDistribution={() => setView('distribution')}
                  onChat={() => setView('chat')}
                />
              )}
              {view === 'markets' && <MarketsView onDocs={onDocs} />}
              {view === 'distribution' && <DistributionView onDocs={onDocs} />}
              {view === 'chat' && <ChatView onCredit={setCredit} />}
              {view === 'settings' && <SettingsView onDocs={onDocs} />}
              {view === 'profile' && <ProfileView onConnect={() => open()} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </SidebarInset>

      <AnimatePresence>
        {modalOpen && (
          <RunModal
            agent={modalAgent} connected={isConnected}
            onConnect={() => open()}
            onClose={() => setModalOpen(false)}
            onSubmit={handleSubmit}
          />
        )}
      </AnimatePresence>
    </SidebarProvider>
    </TooltipProvider>
  )
}

/** Header — shadcn-admin pattern: trigger | separator | search | theme/notifications right */
function Header({ view, onView }: { view: AppView; onView: (v: AppView) => void }) {
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()

  const viewLabels: Record<AppView, string> = {
    portfolio: 'Dashboard', markets: 'Markets', chat: 'Chat',
    agents: 'Agents', distribution: 'Distribution', settings: 'Settings', profile: 'Profile',
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b" style={{ borderColor: 'var(--line)' }}>
      <div className="flex w-full items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-1 lg:gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
          <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{viewLabels[view]}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* search */}
          <div
            className="hidden h-8 w-56 items-center gap-2 rounded-lg border px-2.5 md:flex"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <Search size={14} style={{ color: 'var(--ink-dim)' }} />
            <input
              placeholder="Search…"
              className="w-full bg-transparent text-[12.5px] outline-none"
              style={{ color: 'var(--ink)' }}
            />
            <kbd
              className="rounded px-1 py-0.5 text-[10px]"
              style={{ background: 'var(--surface-raised)', color: 'var(--ink-dim)', border: '1px solid var(--line)' }}
            >
              ⌘K
            </kbd>
          </div>
          {/* theme toggle */}
          <ThemeToggle />
          {/* notifications */}
          <button
            onClick={() => onView('distribution')}
            title="Notifications"
            className="relative grid h-8 w-8 place-items-center rounded-lg"
            style={{ color: 'var(--ink-soft)' }}
          >
            <Bell size={15} />
            <span
              className="absolute top-0.5 right-0.5 flex h-[13px] min-w-[13px] items-center justify-center rounded-full px-0.5 text-[8px] font-bold"
              style={{ background: 'var(--accent)', color: '#000', border: '1.5px solid var(--field)' }}
            >2</span>
          </button>
          {/* wallet avatar */}
          <button
            onClick={() => open()}
            title="Wallet"
            className="grid h-8 w-8 place-items-center rounded-full text-[10.5px] font-bold"
            style={{ background: 'var(--surface-raised)', color: 'var(--ink)', border: '1px solid var(--line)' }}
          >
            {isConnected && address ? address.slice(2, 4).toUpperCase() : <User size={13} />}
          </button>
        </div>
      </div>
    </header>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      aria-label="Toggle theme"
      className="grid h-8 w-8 place-items-center rounded-lg transition-colors"
      style={{ color: 'var(--ink-soft)', background: 'transparent', border: 'none', cursor: 'pointer' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}
