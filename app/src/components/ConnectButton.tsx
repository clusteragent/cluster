import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useDisconnect } from 'wagmi'
import { Wallet, LogOut } from 'lucide-react'
import { useState } from 'react'

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** Real "Connect Wallet" button — opens the Reown AppKit modal (WalletConnect QR + injected). */
export function ConnectButton({ variant = 'pill', dark = false }: { variant?: 'pill' | 'sidebar'; dark?: boolean }) {
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { disconnect } = useDisconnect()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!isConnected || !address) {
    if (dark) {
      return (
        <button onClick={() => open()}
          className="flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-[12.5px] font-medium transition-all hover:bg-white hover:text-black"
          style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.8)' }}>
          <Wallet size={13} /> Connect
        </button>
      )
    }
    return (
      <button onClick={() => open()} className="pill pill-ink pill-sm flex items-center gap-1.5">
        <Wallet size={15} /> <span className="hidden sm:inline">Connect wallet</span><span className="sm:hidden">Connect</span>
      </button>
    )
  }

  if (variant === 'sidebar') {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border px-3 py-2.5" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
        <button
          onClick={() => open({ view: 'Account' })}
          className="grid h-8 w-8 place-items-center rounded-full"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Wallet size={14} />
        </button>
        <span className="flex-1 leading-tight text-left">
          <span className="t-mono block text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{shortAddr(address)}</span>
          <span className="flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: 'var(--signal)' }}>
            <i className="live-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--signal)' }} /> Connected
          </span>
        </span>
        <button onClick={() => disconnect()} className="icon-button" title="Disconnect" style={{ color: 'var(--ink-soft)' }}>
          <LogOut size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
        className="pill pill-surface t-mono flex items-center gap-2 text-[14px]"
      >
        <span className="live-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--signal)' }} />
        {shortAddr(address)}
      </button>
      {menuOpen && (
        <div
          className="card absolute right-0 top-full z-10 mt-2 w-44 overflow-hidden p-1"
          style={{ background: 'var(--surface-raised)' }}
        >
          <button
            onClick={() => open({ view: 'Account' })}
            className="w-full rounded-xl px-3 py-2 text-left text-[13px] hover:bg-white/5"
            style={{ color: 'var(--ink)' }}
          >
            Account
          </button>
          <button
            onClick={() => disconnect()}
            className="w-full rounded-xl px-3 py-2 text-left text-[13px] hover:bg-white/5"
            style={{ color: 'var(--danger)' }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
