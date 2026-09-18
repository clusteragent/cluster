import { useState, type ReactNode } from 'react'
import { Copy, Check, Info, AlertTriangle, Lightbulb } from 'lucide-react'

/** A single documentation page. */
export interface DocPage {
  slug: string
  title: string
  tagline: string
  group: string
  body: ReactNode
  keywords?: string[]
}

/** Dark code block with a copy button — the one used across all docs. */
export function Code({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable — select manually */
    }
  }
  return (
    <div className="relative mt-3 overflow-hidden rounded-xl" style={{ background: 'var(--night)' }}>
      <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <span className="t-mono text-[10.5px] tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {label ?? 'shell'}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 t-mono text-[10.5px]"
          style={{ color: copied ? '#ffffff' : 'rgba(255,255,255,0.55)' }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 t-mono text-[12.5px] leading-relaxed" style={{ color: '#e5e5e5' }}>
        {code}
      </pre>
    </div>
  )
}

/** Inline monospace. */
export function Mono({ children }: { children: ReactNode }) {
  return <span className="t-mono text-[12px]">{children}</span>
}

/** Note / warning / tip callout. */
export function Callout({ kind = 'note', children }: { kind?: 'note' | 'warn' | 'tip'; children: ReactNode }) {
  const map = {
    note: { icon: <Info size={14} />, color: 'var(--ink-soft)' },
    warn: { icon: <AlertTriangle size={14} />, color: 'var(--danger)' },
    tip: { icon: <Lightbulb size={14} />, color: 'var(--signal)' },
  }[kind]
  return (
    <div
      className="mt-4 flex gap-3 rounded-xl border px-4 py-3"
      style={{ borderColor: 'var(--line)', background: 'var(--surface-raised)' }}
    >
      <span className="mt-0.5 shrink-0" style={{ color: map.color }}>
        {map.icon}
      </span>
      <div className="t-small min-w-0">{children}</div>
    </div>
  )
}

/** Data table — head row + body rows. */
export function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--line)' }}>
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr style={{ background: 'var(--surface-raised)' }}>
            {head.map((h) => (
              <th
                key={h}
                className="t-mono whitespace-nowrap px-4 py-2.5 text-[10.5px] uppercase tracking-[0.06em]"
                style={{ color: 'var(--ink-soft)', borderBottom: '1px solid var(--line)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td
                  key={j}
                  className="px-4 py-2.5 align-top"
                  style={{ borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--line)' }}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Endpoint badge — method + path for the API reference. */
export function Endpoint({ method, path }: { method: 'GET' | 'POST'; path: string }) {
  const color = method === 'GET' ? 'var(--signal)' : 'var(--ink)'
  return (
    <div className="mt-5 flex items-center gap-2.5">
      <span
        className="t-mono rounded-md px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.05em]"
        style={{ color, background: 'var(--surface-raised)', boxShadow: 'inset 0 0 0 1px var(--line)' }}
      >
        {method}
      </span>
      <span className="t-mono text-[13px] font-medium">{path}</span>
    </div>
  )
}
