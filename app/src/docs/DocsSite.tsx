import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { DOC_PAGES, DOC_GROUPS } from './pages'

const EASE = [0.22, 1, 0.36, 1] as const

function SidebarLink({
  title,
  active,
  onClick,
}: {
  title: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="block w-full rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors"
      style={{
        background: active ? 'var(--surface-raised)' : 'transparent',
        color: active ? 'var(--ink)' : 'var(--ink-soft)',
        fontWeight: active ? 600 : 400,
        boxShadow: active ? 'inset 0 0 0 1px var(--line)' : 'none',
      }}
    >
      {title}
    </button>
  )
}

export function DocsSite() {
  const nav = useNavigate()
  const { slug } = useParams()
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  const currentIndex = useMemo(() => {
    if (!slug) return 0
    const i = DOC_PAGES.findIndex((p) => p.slug === slug)
    return i === -1 ? 0 : i
  }, [slug])

  const page = DOC_PAGES[currentIndex]
  const prev = currentIndex > 0 ? DOC_PAGES[currentIndex - 1] : null
  const next = currentIndex < DOC_PAGES.length - 1 ? DOC_PAGES[currentIndex + 1] : null

  // scroll to top whenever the page changes
  useEffect(() => {
    window.scrollTo({ top: 0 })
    setMobileOpen(false)
  }, [page.slug])

  const go = (s: string) => nav(`/docs/${s}`)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return DOC_PAGES.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.slug.includes(q) ||
        (p.keywords ?? []).some((k) => k.toLowerCase().includes(q)),
    )
  }, [query])

  const grouped = useMemo(() => {
    const byGroup = new Map<string, typeof DOC_PAGES>()
    for (const p of DOC_PAGES) {
      const list = byGroup.get(p.group) ?? []
      list.push(p)
      byGroup.set(p.group, list)
    }
    return DOC_GROUPS.map((g) => ({ group: g, pages: byGroup.get(g.name) ?? [] })).filter(
      (g) => g.pages.length > 0,
    )
  }, [])

  const sidebar = (
    <div className="flex h-full flex-col gap-5 overflow-y-auto px-3 pb-8 pt-2">
      {/* search */}
      <div className="relative px-1">
        <Search
          size={14}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--ink-soft)' }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search docs…"
          className="w-full rounded-lg border py-2 pl-9 pr-8 text-[13px] outline-none"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--ink-soft)' }}
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {filtered ? (
        <div className="flex flex-col gap-1 px-1">
          <span className="t-mono px-2 text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--ink-soft)' }}>
            {filtered.length} result{filtered.length === 1 ? '' : 's'}
          </span>
          {filtered.map((p) => (
            <SidebarLink
              key={p.slug}
              title={p.title}
              active={p.slug === page.slug}
              onClick={() => go(p.slug)}
            />
          ))}
          {filtered.length === 0 && (
            <span className="t-small px-2 py-2" style={{ color: 'var(--ink-soft)' }}>
              Nothing matches “{query}”. Try “wallet”, “swap”, “memory”, “api”.
            </span>
          )}
        </div>
      ) : (
        grouped.map(({ group, pages }) => (
          <div key={group.name} className="flex flex-col gap-1">
            <span
              className="t-mono px-2 text-[10px] uppercase tracking-[0.1em]"
              style={{ color: 'var(--ink-soft)' }}
            >
              {group.name}
            </span>
            {pages.map((p) => (
              <SidebarLink
                key={p.slug}
                title={p.title}
                active={p.slug === page.slug}
                onClick={() => go(p.slug)}
              />
            ))}
          </div>
        ))
      )}
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--field)' }}>
      {/* top bar */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="icon-button lg:hidden"
            aria-label="Open docs menu"
          >
            <Menu size={18} />
          </button>
          <button
            onClick={() => nav('/docs')}
            className="flex items-center gap-2"
            aria-label="Docs home"
          >
            <BrandMark size={20} />
            <span className="wordmark text-[15px]">cluster</span>
            <span className="t-mono text-[11px]" style={{ color: 'var(--ink-soft)' }}>
              docs
            </span>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => nav('/')} className="t-small px-3 py-1.5 font-medium">
              Back to site
            </button>
            <span className="t-mono hidden text-[11px] sm:block" style={{ color: 'var(--ink-soft)' }}>
              {DOC_PAGES.length} pages
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1200px] gap-10 px-4 sm:px-6">
        {/* desktop sidebar */}
        <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-[248px] shrink-0 border-r py-6 lg:block" style={{ borderColor: 'var(--line)' }}>
          {sidebar}
        </aside>

        {/* mobile sidebar */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-40 lg:hidden"
                style={{ background: 'rgba(23,23,23,0.3)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
              />
              <motion.div
                className="fixed inset-y-0 left-0 z-50 w-[280px] lg:hidden"
                style={{ background: 'var(--surface)' }}
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="wordmark text-[15px]">docs</span>
                  <button onClick={() => setMobileOpen(false)} className="icon-button" aria-label="Close menu">
                    <X size={18} />
                  </button>
                </div>
                {sidebar}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* content */}
        <motion.main
          key={page.slug}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="min-w-0 flex-1 py-8 pb-24"
        >
          <div className="max-w-[760px]">
            {/* breadcrumb */}
            <div className="t-mono mb-3 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
              <span>{page.group}</span>
              <span>/</span>
              <span style={{ color: 'var(--ink)' }}>{page.title}</span>
            </div>

            <h1 className="t-display text-[30px] leading-tight sm:text-[34px]">{page.title}</h1>
            <p className="t-lead mt-3 text-[15px]">{page.tagline}</p>

            <div className="mt-8">{page.body}</div>

            {/* prev / next */}
            <div className="mt-14 grid grid-cols-1 gap-3 border-t pt-6 sm:grid-cols-2" style={{ borderColor: 'var(--line)' }}>
              {prev ? (
                <button
                  onClick={() => go(prev.slug)}
                  className="group flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-[var(--surface-raised)]"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <span className="t-mono flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em]" style={{ color: 'var(--ink-soft)' }}>
                    <ArrowLeft size={11} /> Previous
                  </span>
                  <span className="text-[13.5px] font-medium">{prev.title}</span>
                </button>
              ) : (
                <span />
              )}
              {next ? (
                <button
                  onClick={() => go(next.slug)}
                  className="group flex flex-col items-end gap-1 rounded-xl border px-4 py-3 text-right transition-colors hover:bg-[var(--surface-raised)] sm:col-start-2"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <span className="t-mono flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em]" style={{ color: 'var(--ink-soft)' }}>
                    Next <ArrowRight size={11} />
                  </span>
                  <span className="text-[13.5px] font-medium">{next.title}</span>
                </button>
              ) : null}
            </div>

            {/* footer links */}
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href="https://github.com/finchagentic/cluster-skill"
                target="_blank"
                rel="noreferrer"
                className="t-small inline-flex items-center gap-1.5"
                style={{ color: 'var(--ink-soft)' }}
              >
                <ExternalLink size={13} /> Skill repo on GitHub
              </a>
            </div>
          </div>
        </motion.main>
      </div>
    </div>
  )
}
