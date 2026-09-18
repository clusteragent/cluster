import { useEffect, useState } from 'react'
import { api, signChallenge, type ApiKey, type ApiUsageSummary } from '@/lib/api'
import { useAppKitAccount } from '@reown/appkit/react'
import { useSignMessage } from 'wagmi'
import {
  KeyRound, Plus, Copy, Check, Trash2, Terminal, Loader2,
  AlertTriangle, ShieldCheck, BookOpen, Settings, Moon, Bell,
  AlertOctagon, Activity,
} from 'lucide-react'

function fmtDate(iso: string | null): string {
  if (!iso) return 'never'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function SectionDivider() {
  return <div style={{ height: 1, background: 'var(--line)', margin: '8px 0' }} />
}

function ComingSoon() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: '#929292',
      background: '#efefef', borderRadius: 99, padding: '2px 7px', marginLeft: 8,
    }}>Coming soon</span>
  )
}

export function SettingsView({ onDocs }: { onDocs: () => void }) {
  const { address, isConnected } = useAppKitAccount()
  const { signMessageAsync } = useSignMessage()
  const wallet = address ?? ''

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [fresh, setFresh] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | false>(false)
  const [err, setErr] = useState<string | null>(null)
  const [usage, setUsage] = useState<ApiUsageSummary | null>(null)

  const load = async () => {
    if (!wallet) return
    setLoading(true)
    setErr(null)
    try {
      const signature = await signChallenge(wallet, signMessageAsync)
      const data = await api.listKeys(wallet, signature)
      setKeys(data.keys)
      try {
        const sig2 = await signChallenge(wallet, signMessageAsync)
        setUsage(await api.keyUsage(wallet, sig2))
      } catch { /* usage panel optional */ }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load keys')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const id = setInterval(() => {
      if (!wallet) return
      ;(async () => {
        try {
          const sig = await signChallenge(wallet, signMessageAsync)
          setUsage(await api.keyUsage(wallet, sig))  // realtime metering refresh
        } catch { /* optional */ }
      })()
    }, 10_000)
    return () => clearInterval(id)
  }, [wallet]) // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    if (!wallet || !name.trim()) return
    setCreating(true)
    setErr(null)
    try {
      const signature = await signChallenge(wallet, signMessageAsync)
      const res = await api.createKey(wallet, signature, name.trim())
      setFresh(res.key)
      setName('')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create key')
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (id: number) => {
    if (!wallet) return
    try {
      const signature = await signChallenge(wallet, signMessageAsync)
      await api.revokeKey(wallet, signature, id)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to revoke key')
    }
  }

  const copy = async (text: string, key = 'default') => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(false), 1600)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin + '/api' : 'https://cluster.xyz/api'

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Settings size={20} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Settings</h1>
        </div>
        <button onClick={onDocs} className="pill pill-sm" style={{ border: '1px solid var(--line)', color: 'var(--ink-soft)', background: 'transparent', display: 'flex', alignItems: 'center', gap: 6 }}>
          <BookOpen size={13} /> API docs
        </button>
      </div>

      {/* ─── A) API Keys ─── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        {/* Section header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={15} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>API Keys</span>
            <span className="chip" style={{ background: 'var(--field)', color: 'var(--ink-soft)', fontSize: 11 }}>{keys.length}</span>
            {loading && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--ink-soft)' }} />}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void create() }}
              placeholder="Key name (e.g. bot-prod)"
              disabled={!isConnected}
              style={{
                height: 36, flex: '1 1 150px', minWidth: 0, borderRadius: 99, border: '1px solid var(--line)',
                background: 'var(--field)', padding: '0 14px', fontSize: 12.5,
                color: 'var(--ink)', outline: 'none', opacity: isConnected ? 1 : 0.5,
              }}
            />
            <button
              onClick={() => void create()}
              disabled={!isConnected || creating || !name.trim()}
              className="pill pill-ink"
              style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 5, height: 36 }}
            >
              {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Generate new key
            </button>
          </div>
        </div>

        {/* Description */}
        <div style={{ padding: '10px 20px 0', color: 'var(--ink-soft)', fontSize: 12.5 }}>
          Generate a key to call the Cluster endpoint from your own app.
        </div>

        {/* Wallet warning */}
        {!isConnected && (
          <div style={{ margin: '12px 20px', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--warn)' }}>
            <AlertTriangle size={14} /> Connect a wallet — keys are issued against your wallet identity.
          </div>
        )}

        {/* Fresh key banner */}
        {fresh && (
          <div style={{ margin: '12px 20px', padding: '14px', borderRadius: 12, border: '1px solid var(--accent)', background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 10 }}>
              <ShieldCheck size={14} /> Key created — copy it now, it is shown once
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: 'monospace', fontSize: 12.5, padding: '8px 12px', borderRadius: 10,
                background: 'var(--field)', color: 'var(--ink)', border: '1px solid var(--line)',
              }}>{fresh}</code>
              <button onClick={() => void copy(fresh, 'fresh')} className="pill pill-ink pill-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {copied === 'fresh' ? <Check size={13} /> : <Copy size={13} />}
                {copied === 'fresh' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <button onClick={() => setFresh(null)} style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-soft)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Dismiss
            </button>
          </div>
        )}

        {/* Keys table */}
        {keys.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)' }}>
            No keys yet. Generate one to call the endpoint from outside the app.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
            <thead>
              <tr style={{ color: 'var(--ink-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th style={{ padding: '8px 20px', textAlign: 'left', fontWeight: 600 }}>Key name</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Prefix</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Created</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Last used</th>
                <th style={{ padding: '8px 12px', width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} style={{ borderTop: '1px solid var(--line)', fontSize: 13 }}>
                  <td style={{ padding: '10px 20px', fontWeight: 500 }}>
                    {k.name}
                    {k.revoked && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--danger)', background: 'rgba(255,255,255,0.1)', borderRadius: 99, padding: '1px 6px', marginLeft: 8 }}>revoked</span>}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--ink-soft)' }}>{k.prefix}…</td>
                  <td style={{ padding: '10px 12px', color: 'var(--ink-soft)' }}>{fmtDate(k.created_at)}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--ink-soft)' }}>{fmtDate(k.last_used_at)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    {!k.revoked && (
                      <button
                        onClick={() => void revoke(k.id)}
                        title="Revoke"
                        style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {err && <div style={{ margin: '0 20px 16px', padding: '8px 12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 12.5, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={13} /> {err}
        </div>}
      </div>

      <SectionDivider />

      {/* ─── A2) Usage (per API key, per request metering) ─── */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Activity size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>Usage</span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginLeft: 4 }}>metered per request</span>
        </div>
        {!usage ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', padding: '10px 0' }}>
            {wallet ? 'No usage yet — requests made with your keys appear here.' : 'Connect a wallet to see usage.'}
          </div>
        ) : (
          <>
            {/* totals strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '12px 0 14px' }}>
              {[
                { label: 'Requests (30d)', value: String(usage.totals.recent_30d.requests) },
                { label: 'Prompt tokens (30d)', value: usage.totals.recent_30d.prompt_tokens.toLocaleString() },
                { label: 'Completion tokens (30d)', value: usage.totals.recent_30d.completion_tokens.toLocaleString() },
                { label: 'Cost (30d)', value: `$${usage.totals.recent_30d.cost_usd.toFixed(4)}` },
              ].map(s => (
                <div key={s.label} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', background: 'var(--field)' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-dim)' }}>{s.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                </div>
              ))}
            </div>
            {/* per-key table */}
            {usage.keys.length > 0 && (
              <div style={{ borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 0.9fr 1fr', gap: 8, padding: '8px 12px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-dim)', borderBottom: '1px solid var(--line)', background: 'var(--field)' }}>
                  <span>Key</span><span>Reqs</span><span>Tokens</span><span>Cost</span><span>Last used</span>
                </div>
                {usage.keys.map((k, i) => (
                  <div key={k.key_id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 0.9fr 1fr', gap: 8, padding: '9px 12px', fontSize: 12.5, borderBottom: i < usage.keys.length - 1 ? '1px solid var(--line)' : undefined, alignItems: 'center' }}>
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-dim)' }}>{k.prefix}…</span>
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{k.all.requests}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{(k.all.prompt_tokens + k.all.completion_tokens).toLocaleString()}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>${k.all.cost_usd.toFixed(4)}</span>
                    <span style={{ color: 'var(--ink-soft)', fontSize: 11.5 }}>{k.last_used ? new Date(k.last_used).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'never'}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <SectionDivider />

      {/* ─── B) Endpoint ─── */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Terminal size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>Endpoint</span>
        </div>
        <div style={{ borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden', background: 'var(--field)', marginBottom: 12 }}>
          {[
            { label: 'Base URL', value: baseUrl, copyKey: 'base' },
            { label: 'Models', value: 'GET /api/chat/models', copyKey: null },
            { label: 'Chat', value: 'POST /api/chat', copyKey: null },
          ].map((row, i) => (
            <div key={row.label} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
              borderTop: i > 0 ? '1px solid var(--line)' : undefined,
            }}>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)', width: 80, flexShrink: 0 }}>{row.label}</span>
              <code style={{ fontSize: 12.5, fontFamily: 'monospace', color: 'var(--ink)', flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{row.value}</code>
              {row.copyKey && (
                <button
                  onClick={() => void copy(baseUrl, row.copyKey!)}
                  style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)' }}
                >
                  {copied === row.copyKey ? <Check size={12} /> : <Copy size={12} />}
                </button>
              )}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: 0 }}>
          Compatible with OpenAI SDK — use your API key as the bearer token.
        </p>
      </div>

      <SectionDivider />

      {/* ─── C) Preferences ─── */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Moon size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>Preferences</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Theme toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Moon size={14} style={{ color: 'var(--ink-soft)' }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Theme</span>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Dark (current)</span>
              <ComingSoon />
            </div>
            <div style={{ width: 40, height: 22, borderRadius: 99, background: 'var(--line)', position: 'relative', cursor: 'not-allowed' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--ink-dim)', position: 'absolute', top: 3, left: 3 }} />
            </div>
          </div>
          {/* Notifications toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={14} style={{ color: 'var(--ink-soft)' }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Notifications</span>
              <ComingSoon />
            </div>
            <div style={{ width: 40, height: 22, borderRadius: 99, background: 'var(--line)', position: 'relative', cursor: 'not-allowed' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--ink-dim)', position: 'absolute', top: 3, left: 3 }} />
            </div>
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* ─── D) Danger Zone ─── */}
      <div className="card" style={{ padding: 20, border: '1px solid rgba(255,255,255,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <AlertOctagon size={15} style={{ color: 'var(--danger)' }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--danger)' }}>Danger Zone</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Clear chat history</div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Permanently delete all conversations.</div>
          </div>
          <button
            disabled
            title="Coming soon"
            style={{
              padding: '7px 16px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.3)',
              background: 'transparent', color: 'var(--danger)', fontSize: 13, fontWeight: 500,
              cursor: 'not-allowed', opacity: 0.4,
            }}
          >
            Clear history
          </button>
        </div>
      </div>
    </div>
  )
}
