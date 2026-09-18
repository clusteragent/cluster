/**
 * AppSidebar — ported from the shadcn-admin dashboard zip.
 * Wide sidebar with: brand header, NavMain groups (icons + labels + badges),
 * SupportCard, and NavUser (avatar + wallet + dropdown) at the bottom.
 */
import { BrandMark } from "@/components/BrandMark"
import { useAppKitAccount } from "@reown/appkit/react"

import {
  useSidebar,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NavMain } from "./nav-main"
import { NavUser } from "./nav-user"
import { sidebarItems } from "./sidebar-items"

export function AppSidebar({ view, onView, onBack, ...props }: React.ComponentProps<typeof Sidebar> & {
  view: string
  onView: (v: string) => void
  onBack: () => void
}) {
  const { address, isConnected } = useAppKitAccount()
  const { setOpen } = useSidebar()

  // Close the mobile drawer whenever a nav item (or back) is clicked
  const handleView = (v: string) => {
    onView(v)
    if (typeof window !== "undefined" && window.innerWidth < 768) setOpen(false)
  }

  // Map Cluster views onto the sidebar items: clicking routes to onView
  const items = sidebarItems.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.disabled),
  }))

  const user = {
    name: isConnected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Guest",
    email: isConnected ? "Wallet connected" : "Not connected",
    avatar: "",
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Back to site"
              onClick={() => { onBack(); if (typeof window !== "undefined" && window.innerWidth < 768) setOpen(false) }}
            >
              <BrandMark size={26} />
              <span className="font-semibold text-base">cluster</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} activeView={view} onView={handleView} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
