/**
 * NavMain — ported from the shadcn-admin dashboard zip.
 * Adapted: no router links (AgentIndex uses view state), active state
 * driven by `activeView` + `onView` callbacks from AppShell.
 * Quick Create row replaced with "Run Agent" primary action.
 */
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type {
  NavBadge,
  NavGroup,
  NavMainItem,
  NavMainLinkItem,
  NavMainParentItem,
} from "./sidebar-items";

interface NavMainProps {
  readonly items: readonly NavGroup[];
  readonly activeView: string;
  readonly onView: (v: string) => void;
}

interface NavItemProps {
  readonly item: NavMainItem;
  readonly activeView: string;
  readonly onView: (v: string) => void;
}

function hasSubItems(item: NavMainItem): item is NavMainParentItem {
  return Boolean(item.subItems?.length);
}

export function NavMain({ items, activeView, onView }: NavMainProps) {
  return (
    <>
            {items.map((group) => (
        <SidebarGroup key={group.id}>
          {group.label && (
            <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">
              {group.label}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  activeView={activeView}
                  onView={onView}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

function NavItem({ item, activeView, onView }: NavItemProps) {
  if (!hasSubItems(item)) {
    return <NavLinkItem item={item} activeView={activeView} onView={onView} />;
  }
  return (
    <NavCollapsibleItem
      item={item}
      activeView={activeView}
      onView={onView}
    />
  );
}

function NavLinkItem({ item, activeView, onView }: { item: NavMainLinkItem; activeView: string; onView: (v: string) => void }) {
  const isActive = activeView === item.url;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        aria-disabled={item.disabled}
        tooltip={item.title}
        isActive={isActive}
        onClick={() => onView(item.url)}
        className="cursor-pointer"
      >
        {item.icon ? <item.icon /> : <span className="size-4" />}
        <span>{item.title}</span>
      </SidebarMenuButton>
      <NavItemBadge badge={item.badge} />
    </SidebarMenuItem>
  );
}

function NavCollapsibleItem({ item, activeView, onView }: { item: NavMainParentItem; activeView: string; onView: (v: string) => void }) {
  const isActive = item.subItems.some((sub) => sub.url === activeView);
  return (
    <SidebarMenuItem>
      <Collapsible
        defaultOpen={isActive}
        className="group/collapsible"
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={isActive} className="cursor-pointer">
            {item.icon ? <item.icon /> : <span className="size-4" />}
            <span>{item.title}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.subItems.map((sub) => (
              <SidebarMenuSubItem key={sub.id}>
                <SidebarMenuSubButton
                  asChild
                  isActive={activeView === sub.url}
                >
                  <button
                    onClick={() => onView(sub.url)}
                    className="w-full cursor-pointer text-left"
                    style={{ background: "transparent", border: "none" }}
                  >
                    <span>{sub.title}</span>
                  </button>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
      <NavItemBadge badge={item.badge} />
    </SidebarMenuItem>
  );
}

function NavItemBadge({ badge }: { badge?: NavBadge }) {
  if (!badge) return null;
  return (
    <SidebarMenuBadge
      className={cn(
        "pointer-events-none opacity-100 transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0",
        badge === "new" && "text-white",
        badge === "soon" && "text-muted-foreground",
      )}
    >
      {badge === "new" ? "New" : "Soon"}
    </SidebarMenuBadge>
  );
}
