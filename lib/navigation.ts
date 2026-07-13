import type { LucideIcon } from "lucide-react";
import {
  ClipboardList, Factory, FileClock, Gauge, HeartPulse, KeyRound, MessageSquare, Package, Percent,
  RadioTower, Settings, ShoppingBag, Sparkles, Truck, UserCog, UserRoundSearch, Users, Bot,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type NavGroup = "Workspace" | "Clients & Orders" | "Operations" | "Business" | "Administration";

export const navGroupOrder: NavGroup[] = ["Workspace", "Clients & Orders", "Operations", "Business", "Administration"];

export type NavigationItem = { label: string; href: string; icon: LucideIcon; permission: Permission; ownerOnly?: boolean; group: NavGroup };

export const navigationItems: NavigationItem[] = [
  { label: "Dashboard", href: "/", icon: Gauge, permission: "dashboard.view", group: "Workspace" },
  { label: "Leads", href: "/leads", icon: UserRoundSearch, permission: "leads.view", group: "Clients & Orders" },
  { label: "Customers", href: "/customers", icon: Users, permission: "customers.view", group: "Clients & Orders" },
  { label: "Orders", href: "/orders", icon: ClipboardList, permission: "orders.view", group: "Clients & Orders" },
  { label: "Command Center", href: "/production/command-center", icon: RadioTower, permission: "production.view", group: "Operations" },
  { label: "Production", href: "/production", icon: Factory, permission: "production.view", group: "Operations" },
  { label: "Inventory", href: "/inventory", icon: Package, permission: "inventory.view", group: "Operations" },
  { label: "Purchases", href: "/purchases", icon: ShoppingBag, permission: "purchases.view", group: "Operations" },
  { label: "Reports", href: "/reports", icon: Sparkles, permission: "reports.view", group: "Business" },
  { label: "Incentives", href: "/incentives", icon: Percent, permission: "incentives.view", group: "Business" },
  { label: "WhatsApp Automation", href: "/whatsapp", icon: MessageSquare, permission: "whatsapp.view", group: "Business" },
  { label: "Bandhani Assistant", href: "/assistant", icon: Bot, permission: "reports.view", group: "Business" },
  { label: "Vendors", href: "/vendors", icon: Truck, permission: "vendors.view", group: "Administration" },
  { label: "Employees", href: "/employees", icon: UserCog, permission: "employees.view", group: "Administration" },
  { label: "Roles & Access", href: "/roles", icon: KeyRound, permission: "roles.view", group: "Administration" },
  { label: "Data Health", href: "/data-health", icon: HeartPulse, permission: "audit.view", ownerOnly: true, group: "Administration" },
  { label: "Audit Logs", href: "/audit-logs", icon: FileClock, permission: "audit.view", group: "Administration" },
  { label: "Settings", href: "/settings", icon: Settings, permission: "settings.view", group: "Administration" },
];

export function navigationForPermissions(permissions: string[], isOwner = false) {
  const allowed = new Set(permissions);
  return navigationItems.filter((item) => allowed.has(item.permission) && (!item.ownerOnly || isOwner));
}

/** Navigation grouped into labelled sections for the sidebar. Empty groups are omitted. */
export function groupedNavigation(permissions: string[], isOwner = false) {
  const items = navigationForPermissions(permissions, isOwner);
  return navGroupOrder
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((section) => section.items.length > 0);
}

export function navigationForRole(role: string) {
  const legacy: Record<string, string[]> = {
    OWNER: navigationItems.map((item) => item.permission),
    QC_TEAM: ["dashboard.view", "production.view"],
    INVENTORY_TEAM: ["dashboard.view", "inventory.view"],
    PURCHASE_TEAM: ["dashboard.view", "purchases.view"],
  };
  return navigationForPermissions(legacy[role] ?? ["dashboard.view"], role === "OWNER");
}

export function permissionForPath(pathname: string): Permission | null {
  const item = navigationItems.find((entry) => entry.href !== "/" && pathname.startsWith(entry.href));
  if (pathname === "/") return "dashboard.view";
  return item?.permission ?? null;
}

export function labelForPath(pathname: string) {
  const item = navigationItems.find((entry) => entry.href !== "/" && pathname.startsWith(entry.href));
  return pathname === "/" ? "Dashboard" : item?.label ?? "Couture OS";
}
