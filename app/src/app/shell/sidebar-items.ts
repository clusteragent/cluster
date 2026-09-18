import {
  LayoutDashboard,
  ChartBar,
  MessageSquare,
  HandCoins,
  Terminal,
  UserRound,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

/** Cluster navigation — same shape as the shadcn-admin reference. */
export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Platform",
    items: [
      {
        id: "portfolio",
        title: "Dashboard",
        url: "portfolio",
        icon: LayoutDashboard,
      },
      {
        id: "markets",
        title: "Markets",
        url: "markets",
        icon: ChartBar,
      },
      {
        id: "chat",
        title: "Chat",
        url: "chat",
        icon: MessageSquare,
      },
      {
        id: "distribution",
        title: "Distribution",
        url: "distribution",
        icon: HandCoins,
      },
    ],
  },
  {
    id: 2,
    label: "Developer",
    items: [
      {
        id: "settings",
        title: "API & Settings",
        url: "settings",
        icon: Terminal,
      },
    ],
  },
  {
    id: 3,
    label: "Account",
    items: [
      {
        id: "profile",
        title: "Profile",
        url: "profile",
        icon: UserRound,
      },
      {
        id: "settings2",
        title: "Preferences",
        url: "settings",
        icon: Settings,
      },
    ],
  },
];
