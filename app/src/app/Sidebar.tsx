import { BrandMark } from '@/components/BrandMark'
import { ConnectButton } from '@/components/ConnectButton'
import {
  LayoutGrid, BarChart3, MessageSquare, Bot, HandCoins,
  Terminal, BookOpen, User, Settings,
} from 'lucide-react'

export type AppView =
  | 'portfolio' | 'agents' | 'markets' | 'distribution'
  | 'chat' | 'settings' | 'profile'

function RailItem({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        width: 40,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#ffffff' : 'var(--ink-dim)',
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        }
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18 }}>
        {icon}
      </span>
    </button>
  )
}

function Divider() {
  return (
    <div
      style={{
        width: 32,
        height: 1,
        background: 'var(--line)',
        margin: '6px auto',
        flexShrink: 0,
      }}
    />
  )
}

export function Sidebar({
  view, onView, onBack, onDocs,
}: {
  view: AppView
  onView: (v: AppView) => void
  onUpload: () => void
  onBack: () => void
  onDocs: () => void
  onCollapse?: () => void
  credit?: number | null
}) {
  return (
    <aside
      style={{
        width: 64,
        minWidth: 64,
        maxWidth: 64,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'var(--field-alt)',
        borderRight: '1px solid var(--line)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ paddingTop: 16, paddingBottom: 12, flexShrink: 0 }}>
        <button
          onClick={onBack}
          title="Back to site"
          aria-label="Back to site"
          style={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 12,
          }}
        >
          <BrandMark size={22} />
        </button>
      </div>

      <Divider />

      {/* GROUP 1 — main nav */}
      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          padding: '6px 0',
          flexShrink: 0,
        }}
      >
        <RailItem active={view === 'portfolio'} icon={<LayoutGrid size={18} />} label="Dashboard" onClick={() => onView('portfolio')} />
        <RailItem active={view === 'markets'} icon={<BarChart3 size={18} />} label="Markets" onClick={() => onView('markets')} />
        <RailItem active={view === 'chat'} icon={<MessageSquare size={18} />} label="Chat" onClick={() => onView('chat')} />
        <RailItem active={view === 'agents'} icon={<Bot size={18} />} label="Agents" onClick={() => onView('agents')} />
        <RailItem active={view === 'distribution'} icon={<HandCoins size={18} />} label="Distribution" onClick={() => onView('distribution')} />
      </nav>

      <Divider />

      {/* GROUP 2 — dev */}
      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          padding: '6px 0',
          flexShrink: 0,
        }}
      >
        <RailItem active={view === 'settings'} icon={<Terminal size={18} />} label="API" onClick={() => onView('settings')} />
        <RailItem active={false} icon={<BookOpen size={18} />} label="Docs" onClick={onDocs} />
      </nav>

      <Divider />

      {/* GROUP 3 — user */}
      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          padding: '6px 0',
          flexShrink: 0,
        }}
      >
        <RailItem active={view === 'profile'} icon={<User size={18} />} label="Profile" onClick={() => onView('profile')} />
        <RailItem active={view === 'settings'} icon={<Settings size={18} />} label="Settings" onClick={() => onView('settings')} />
      </nav>

      {/* spacer */}
      <div style={{ flex: 1 }} />

      {/* Wallet connect at bottom — compact icon only */}
      <div style={{ paddingBottom: 16, flexShrink: 0, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ width: 40, overflow: 'hidden' }}>
          <ConnectButton variant="sidebar" />
        </div>
      </div>
    </aside>
  )
}
