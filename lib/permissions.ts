import { CompanyStatus, Role } from "@prisma/client";

export const PERMISSION_GROUPS = [
  { module: "Dashboard", permissions: ["dashboard.view"] },
  { module: "Leads", permissions: ["leads.view", "leads.create", "leads.edit", "leads.convert"] },
  { module: "Customers", permissions: ["customers.view", "customers.create", "customers.edit"] },
  { module: "Orders", permissions: ["orders.view", "orders.create", "orders.edit"] },
  { module: "Production", permissions: ["production.view", "production.edit"] },
  { module: "Inventory", permissions: ["inventory.view", "inventory.create", "inventory.edit", "inventory.delete", "inventory.movement"] },
  { module: "Purchases", permissions: ["purchases.view", "purchases.create", "purchases.receive"] },
  { module: "Pricing", permissions: ["pricing.view", "pricing.create", "pricing.edit"] },
  { module: "Reports", permissions: ["reports.view", "reports.export"] },
  { module: "Incentives", permissions: ["incentives.view", "incentives.create", "incentives.approve", "incentives.pay"] },
  { module: "WhatsApp", permissions: ["whatsapp.view", "whatsapp.edit", "whatsapp.send"] },
  { module: "Employees", permissions: ["employees.view", "employees.create", "employees.edit", "employees.deactivate"] },
  { module: "Roles & Access", permissions: ["roles.view", "roles.create", "roles.edit"] },
  { module: "Settings", permissions: ["settings.view", "settings.edit"] },
  { module: "Audit Logs", permissions: ["audit.view"] },
] as const;

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((group) => group.permissions);
export type Permission = (typeof ALL_PERMISSIONS)[number];

export const LEGACY_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: ALL_PERMISSIONS,
  PARTNER: ALL_PERMISSIONS.filter((permission) => !permission.startsWith("employees.") && !permission.startsWith("roles.")),
  STORE_MANAGER: ["dashboard.view", "leads.view", "leads.create", "leads.edit", "leads.convert", "customers.view", "customers.create", "customers.edit", "orders.view", "orders.create", "orders.edit", "production.view", "production.edit", "inventory.view", "inventory.create", "inventory.edit", "inventory.movement", "purchases.view", "purchases.create", "purchases.receive", "pricing.view", "pricing.create", "reports.view", "reports.export", "whatsapp.view", "whatsapp.edit", "whatsapp.send", "audit.view"],
  STYLIST: ["dashboard.view", "leads.view", "leads.create", "leads.edit", "leads.convert", "customers.view", "customers.create", "customers.edit", "orders.view", "orders.create", "production.view", "whatsapp.view", "whatsapp.send"],
  PRODUCTION_MANAGER: ["dashboard.view", "orders.view", "orders.edit", "production.view", "production.edit", "inventory.view", "inventory.edit", "inventory.movement"],
  QC_TEAM: ["dashboard.view", "production.view", "production.edit"],
  INVENTORY_TEAM: ["dashboard.view", "inventory.view", "inventory.create", "inventory.edit", "inventory.delete", "inventory.movement"],
  PURCHASE_TEAM: ["dashboard.view", "purchases.view", "purchases.create", "purchases.receive"],
  ACCOUNTS_TEAM: ["dashboard.view", "customers.view", "orders.view", "purchases.view", "pricing.view", "pricing.create", "pricing.edit", "reports.view", "reports.export", "incentives.view", "incentives.create", "incentives.approve", "incentives.pay"],
};

export type PermissionSubject = {
  companyStatus: CompanyStatus;
  permissions: string[];
};

export function hasPermission(user: PermissionSubject, permission: Permission) {
  return user.companyStatus === CompanyStatus.OWNER || user.permissions.includes(permission);
}

export function resolvePermissions(input: {
  companyStatus: CompanyStatus;
  legacyRole: Role;
  rolePermissions?: string[];
  overrides?: Array<{ permission: string; granted: boolean }>;
}) {
  if (input.companyStatus === CompanyStatus.OWNER) return [...ALL_PERMISSIONS];
  const resolved = new Set(input.rolePermissions !== undefined ? input.rolePermissions : LEGACY_ROLE_PERMISSIONS[input.legacyRole]);
  for (const override of input.overrides ?? []) override.granted ? resolved.add(override.permission as Permission) : resolved.delete(override.permission as Permission);
  return ALL_PERMISSIONS.filter((permission) => resolved.has(permission));
}

// Kept for compatibility with code that still imports these constants.
export const MANAGEMENT_ROLES: Role[] = [Role.OWNER, Role.PARTNER, Role.STORE_MANAGER];
export const LEAD_WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, Role.STYLIST];
export const ORDER_WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, Role.STYLIST, Role.PRODUCTION_MANAGER];
export const PRODUCTION_WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, Role.PRODUCTION_MANAGER, Role.QC_TEAM];
