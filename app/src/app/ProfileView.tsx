import { useEffect, useState } from 'react'
import { useAppKitAccount } from '@reown/appkit/react'
import { useAppKit } from '@reown/appkit/react'
import { useSignMessage } from 'wagmi'
import { api, signChallenge, type ApiCredits, type ApiSocial } from '@/lib/api'
import {
  Wallet, Check, Lock, Zap, Twitter, AlertTriangle, Loader2, CheckCircle,
} from 'lucide-react'

interface ProfileViewProps {
  onConnect: () => void
}

function shortAddr(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

function fmtUsd(n: number) {
  return '$' + n.toFixed(2)
}

export function ProfileView({ onConnect }: ProfileViewProps) {
  const { address, isConnected } = useAppKitAccount()
  const { open } = useAppKit()
  const { signMessageAsync } = useSignMessage()
  const wallet = address ?? ''

  const [credits, setCredits] = useState<ApiCredits | null>(null)
  const [social, setSocial] = useState<ApiSocial | null>(null)
  const [loadingCredits, setLoadingCredits] = useState(false)
  const [loadingSocial, setLoadingSocial] = useState(false)

  // X linking
  const [xHandle, setXHandle] = useState('')
  const [linkingX, setLinkingX] = useState(false)
  const [linkErr, setLinkErr] = useState<string | null>(null)

  // Tip
  const [tipTo, setTipTo] = useState('')
  const [tipAmount, setTipAmount] = useState('')
  const [tipping, setTipping] = useState(false)
  const [tipMsg, setTipMsg] = useState<string | null>(null)

  // Load credits + social when connected
  useEffect(() => {
    if (!wallet) { setCredits(null); setSocial(null); return }
    setLoadingCredits(true)
    api.getCredits(wallet).then(c => setCredits(c)).catch(() => {}).finally(() => setLoadingCredits(false))
    setLoadingSocial(true)
    api.getSocial(wallet).then(s => setSocial(s)).catch(() => {}).finally(() => setLoadingSocial(false))
  }, [wallet])

  const handleConnect = () => {
    if (onConnect) onConnect()
    else open()
  }

  const handleLinkX = async () => {
    if (!wallet || !xHandle.trim()) return
    setLinkingX(true)
    setLinkErr(null)
    try {
      const sig = await signChallenge(wallet, signMessageAsync)
      await api.linkX(wallet, sig, xHandle.trim())
      // Reload social
      const s = await api.getSocial(wallet)
      setSocial(s)
      setXHandle('')
    } catch (e) {
      setLinkErr(e instanceof Error ? e.message : 'Failed to link X account')
    } finally {
      setLinkingX(false)
    }
  }

  const handleTip = async () => {
    if (!wallet || !tipTo.trim() || !tipAmount.trim()) return
    setTipping(true)
    setTipMsg(null)
    try {
      const sig = await signChallenge(wallet, signMessageAsync)
      await api.tip(wallet, sig, tipTo.trim(), tipAmount.trim())
      setTipMsg('Tip recorded!')
      setTipTo('')
      setTipAmount('')
    } catch (e) {
      setTipMsg(e instanceof Error ? e.message : 'Tip failed')
    } finally {
      setTipping(false)
    }
  }

  // NOT CONNECTED
  if (!isConnected || !wallet) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ padding: 48, textAlign: 'center', maxWidth: 360, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--field)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Wallet size={32} style={{ color: 'var(--ink-soft)' }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Connect your wallet</h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 24 }}>
            Connect to view your profile, manage credits, and access premium features.
          </p>
          <button onClick={handleConnect} className="pill pill-accent" style={{ width: '100%', padding: '10px 0', fontSize: 14, fontWeight: 600 }}>
            Connect Wallet
          </button>
        </div>
      </div>
    )
  }

  const initials = wallet.slice(2, 6).toUpperCase()
  const creditRem = credits ? credits.remaining_usd : null
  const fmtUsd = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ─── Avatar + Plan ─── */}
      <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 20, boxShadow: 'var(--shadow-card)' }}>
        {/* Avatar */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.72) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'monospace',
        }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>{shortAddr(wallet)}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-dim)', background: 'var(--field)', border: '1px solid var(--line)', borderRadius: 99, padding: '2px 8px' }}>Free Plan</span>
          </div>
          {/* 3 stat chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-soft)', background: 'var(--field)', border: '1px solid var(--line)', borderRadius: 99, padding: '4px 10px' }}>
              0 agents run
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-soft)', background: 'var(--field)', border: '1px solid var(--line)', borderRadius: 99, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
              {loadingCredits ? <Loader2 size={11} className="animate-spin" /> : (creditRem !== null ? fmtUsd(creditRem) : '$—')} credit left
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-dim)', background: 'var(--field)', border: '1px solid var(--line)', borderRadius: 99, padding: '4px 10px', opacity: 0.6 }}>
              $CLST: Coming soon
            </span>
          </div>
        </div>
      </div>

      {/* ─── BILLING ─── */}
      <div className="card" style={{ padding: 20, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Billing</div>
          <span style={{ fontSize: 11, color: 'var(--ink-dim)' }}>Pay-per-token — no subscription</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
          {[
            { l: 'Granted credit', v: credits ? fmtUsd(credits.granted_usd) : '$—' },
            { l: 'Used', v: credits ? fmtUsd(credits.used_usd) : '$—' },
            { l: 'Remaining', v: creditRem !== null ? fmtUsd(creditRem) : '$—', accent: true },
            { l: 'Requests', v: credits ? credits.requests.toLocaleString() : '0' },
          ].map(s => (
            <div key={s.l} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', background: 'var(--field)' }}>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-dim)' }}>{s.l}</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 3, fontVariantNumeric: 'tabular-nums', color: s.accent ? 'var(--ink)' : undefined }}>{s.v}</div>
            </div>
          ))}
        </div>
        <div style={{ borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden', background: 'var(--field)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', fontSize: 12.5 }}>
            <span style={{ color: 'var(--ink-soft)' }}>Top-ups</span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-dim)' }}>Cooming soon — every wallet starts with $5 of inference credit, free</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', fontSize: 12.5, borderTop: '1px solid var(--line)' }}>
            <span style={{ color: 'var(--ink-soft)' }}>Billing model</span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-dim)' }}>Metered per request — tokens × model rate, no monthly plan</span>
          </div>
        </div>
      </div>

      {/* ─── Connected Accounts ─── */}
      <div className="card" style={{ padding: 20, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Connected Accounts</div>

        {loadingSocial ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-soft)', fontSize: 13 }}>
            <Loader2 size={14} className="animate-spin" /> Loading...
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--field)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Twitter size={16} style={{ color: 'var(--ink-soft)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>X / Twitter</div>
              {social?.x_linked && social.x_handle ? (
                <div style={{ fontSize: 12, color: 'var(--signal)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Check size={11} /> @{social.x_handle}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>Not linked</div>
              )}
            </div>
            {!(social?.x_linked) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  value={xHandle}
                  onChange={e => setXHandle(e.target.value)}
                  placeholder="@handle"
                  style={{
                    height: 32, width: 120, borderRadius: 99, border: '1px solid var(--line)',
                    background: 'var(--field)', padding: '0 12px', fontSize: 12.5,
                    color: 'var(--ink)', outline: 'none',
                  }}
                />
                <button
                  onClick={() => void handleLinkX()}
                  disabled={linkingX || !xHandle.trim()}
                  className="pill pill-ink pill-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {linkingX ? <Loader2 size={12} className="animate-spin" /> : null}
                  Link X
                </button>
              </div>
            )}
          </div>
        )}
        {linkErr && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertTriangle size={12} /> {linkErr}
          </div>
        )}
      </div>

      {/* ─── Send $CLST Tip ─── */}
      <div className="card" style={{ padding: 20, position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Send $CLST Tip</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={tipTo}
            onChange={e => setTipTo(e.target.value)}
            placeholder="Recipient address (0x…)"
            disabled={!isConnected}
            style={{
              flex: 2, minWidth: 200, height: 36, borderRadius: 99, border: '1px solid var(--line)',
              background: 'var(--field)', padding: '0 14px', fontSize: 12.5,
              color: 'var(--ink)', outline: 'none',
            }}
          />
          <input
            value={tipAmount}
            onChange={e => setTipAmount(e.target.value)}
            placeholder="Amount"
            disabled={!isConnected}
            style={{
              flex: 1, minWidth: 80, height: 36, borderRadius: 99, border: '1px solid var(--line)',
              background: 'var(--field)', padding: '0 14px', fontSize: 12.5,
              color: 'var(--ink)', outline: 'none',
            }}
          />
          <button
            onClick={() => void handleTip()}
            disabled={!isConnected || tipping || !tipTo.trim() || !tipAmount.trim()}
            className="pill pill-accent pill-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {tipping ? <Loader2 size={13} className="animate-spin" /> : null}
            Send
          </button>
        </div>
        {tipMsg && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: tipMsg === 'Tip recorded!' ? 'var(--signal)' : 'var(--danger)' }}>
            {tipMsg}
          </div>
        )}
        {/* Dimmed overlay when not connected */}
        {!isConnected && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(13,13,13,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(2px)', borderRadius: 'inherit',
          }}>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Coming soon</span>
          </div>
        )}
      </div>

      {/* ─── Danger Zone ─── */}
      <div className="card" style={{ padding: 20, opacity: 0.5, border: '1px solid rgba(255,255,255,0.15)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>Danger Zone</div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: 0 }}>Account deletion and data export will be available here.</p>
      </div>
    </div>
  )
}
