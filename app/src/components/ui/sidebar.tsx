/**
 * sidebar.tsx — Tailwind v3-compatible reimplementation of the
 * shadcn/ui sidebar primitives (the zip ships v4 syntax which our
 * Tailwind 3.4 setup can't parse). Same API & visual behavior:
 * SidebarProvider / Sidebar / SidebarInset / SidebarTrigger +
 * SidebarHeader/Content/Footer, SidebarGroup(+Label/Content),
 * SidebarMenu(+Item/Button/Badge), SidebarMenuSub(+Item/Button).
 * Dark tokens wired to the app palette (--field-alt/--surface/--line).
 */
import * as React from "react"
import { PanelLeft } from "lucide-react"

import { cn } from "@/lib/utils"

const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_ICON = "3.5rem"

type SidebarContext = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  toggleSidebar: () => void
}

const SidebarContextReact = React.createContext<SidebarContext | null>(null)

export function useSidebar() {
  const ctx = React.useContext(SidebarContextReact)
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider.")
  return ctx
}

export function SidebarProvider({
  defaultOpen = true,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & { defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(
    () => (typeof window !== "undefined" ? window.innerWidth >= 768 : defaultOpen),
  )
  const toggleSidebar = React.useCallback(() => { setOpen((o) => !o) }, [])

  const ctx = React.useMemo<SidebarContext>(
    () => ({ state: open ? "expanded" : "collapsed", open, setOpen, toggleSidebar }),
    [open, toggleSidebar],
  )

  return (
    <SidebarContextReact.Provider value={ctx}>
      <div
        className={cn("flex h-screen w-full overflow-hidden", className)}
        style={{
          "--sidebar-width": SIDEBAR_WIDTH,
          "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
          ...style,
        } as React.CSSProperties}
        {...props}
      >
        {children}
      </div>
    </SidebarContextReact.Provider>
  )
}

export function Sidebar({
  side = "left",
  className,
  children,
  ...props
}: React.ComponentProps<"aside"> & { side?: "left" | "right" }) {
  const { state, open, setOpen } = useSidebar()
  const collapsed = state === "collapsed"

  // Spacer div reserves layout width; the panel itself is fixed so
  // content never overlaps — same trick as the reference implementation.
  // Mobile (<md): the same open state drives a slide-over drawer with backdrop.
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={() => { setOpen(false) }}
          />
          <aside
            data-mobile=""
            className={cn("absolute inset-y-0 flex h-full w-[16rem] flex-col overflow-hidden", className)}
            style={{
              left: 0,
              background: "var(--field-alt)",
              borderRight: side === "left" ? "1px solid var(--line)" : undefined,
              borderLeft: side === "right" ? "1px solid var(--line)" : undefined,
              animation: "sidebar-in 0.2s ease",
            }}
          >
            {children}
          </aside>
        </div>
      )}
      <div
        aria-hidden
        className="hidden shrink-0 transition-[width] duration-200 ease-linear md:block"
        style={{ width: collapsed ? SIDEBAR_WIDTH_ICON : SIDEBAR_WIDTH }}
      />
      <aside
        data-collapsible={collapsed ? "icon" : "offcanvas"}
        className={cn("fixed inset-y-0 z-20 hidden h-svh flex-col overflow-hidden md:flex", className)}
        style={{
          [side]: 0,
          width: collapsed ? SIDEBAR_WIDTH_ICON : SIDEBAR_WIDTH,
          background: "var(--field-alt)",
          borderRight: side === "left" ? "1px solid var(--line)" : undefined,
          borderLeft: side === "right" ? "1px solid var(--line)" : undefined,
          transition: "width 0.2s ease-linear",
        } as React.CSSProperties}
        {...props}
      >
        {children}
      </aside>
    </>
  )
}

export function SidebarInset({ className, style, children, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      className={cn("relative flex min-w-0 flex-1 flex-col overflow-hidden", className)}
      style={{ background: "var(--field)", ...style }}
      {...props}
    >
      {children}
    </main>
  )
}

export function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar()
  return (
    <button
      onClick={(e) => { toggleSidebar(); onClick?.(e) }}
      aria-label="Toggle sidebar"
      className={cn("grid h-8 w-8 place-items-center rounded-lg", className)}
      style={{ color: "var(--ink-soft)", background: "transparent", border: "none", cursor: "pointer" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-raised)" }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
      {...props}
    >
      <PanelLeft size={16} />
    </button>
  )
}

/* ── structural sections ─────────────────────────────────────────── */

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-header" className={cn("flex flex-col gap-2 p-3", className)} {...props} />
}

export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn("flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-2", className)}
      {...props}
    />
  )
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-footer" className={cn("flex flex-col gap-2 p-3", className)} {...props} />
}

export function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-group" className={cn("relative flex w-full min-w-0 flex-col", className)} {...props} />
}

export function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn("flex h-7 shrink-0 items-center rounded-md px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]", className)}
      style={{ color: "var(--ink-dim)" }}
      {...props}
    />
  )
}

export function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-group-content" className={cn("w-full text-sm", className)} {...props} />
}

/* ── menu ────────────────────────────────────────────────────────── */

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="sidebar-menu" className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="sidebar-menu-item" className={cn("group/menu-item relative", className)} {...props} />
}

export function SidebarMenuButton({
  isActive = false,
  tooltip,
  size = "default",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isActive?: boolean
  tooltip?: string
  size?: "default" | "lg"
}) {
  return (
    <button
      title={tooltip}
      data-active={isActive}
      className={cn(
        "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-lg p-2 text-left text-[13px] outline-none transition-colors",
        size === "lg" && "p-2.5",
        className,
      )}
      style={{
        background: isActive ? "var(--surface-raised)" : "transparent",
        color: isActive ? "var(--ink)" : "var(--ink-soft)",
        fontWeight: isActive ? 600 : 500,
        cursor: "pointer",
        border: "none",
        ...(isActive ? { boxShadow: "inset 0 0 0 1px var(--line)" } : {}),
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        if (!isActive) el.style.background = "var(--surface-raised)"
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        if (!isActive) el.style.background = "transparent"
      }}
      {...props}
    >
      {children}
    </button>
  )
}

export function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      className={cn("pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold", className)}
      style={{ color: "var(--ink-dim)" }}
      {...props}
    />
  )
}

export function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      className={cn("mx-3.5 flex min-w-0 translate-x-px flex-col gap-0.5 border-l px-2.5 py-0.5", className)}
      style={{ borderColor: "var(--line)" }}
      {...props}
    />
  )
}

export function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="sidebar-menu-sub-item" className={cn("", className)} {...props} />
}

export function SidebarMenuSubButton({
  isActive = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { isActive?: boolean }) {
  return (
    <button
      data-active={isActive}
      className={cn("flex w-full items-center gap-2 overflow-hidden rounded-md px-2 py-1 text-left text-[12.5px] outline-none", className)}
      style={{
        background: isActive ? "var(--surface-raised)" : "transparent",
        color: isActive ? "var(--ink)" : "var(--ink-dim)",
        cursor: "pointer",
        border: "none",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)" }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = isActive ? "var(--ink)" : "var(--ink-dim)" }}
      {...props}
    >
      {children}
    </button>
  )
}
