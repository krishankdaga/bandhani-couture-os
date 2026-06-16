
import { Role } from "@prisma/client";

export const INVENTORY_ROLES: Role[] = [Role.OWNER, Role.PARTNER, Role.STORE_MANAGER, Role.INVENTORY_TEAM, Role.PRODUCTION_MANAGER];
export const PURCHASE_ROLES: Role[] = [Role.OWNER, Role.PARTNER, Role.STORE_MANAGER, Role.PURCHASE_TEAM, Role.ACCOUNTS_TEAM];
export const PRICING_ROLES: Role[] = [Role.OWNER, Role.PARTNER, Role.STORE_MANAGER, Role.ACCOUNTS_TEAM];
export const REPORT_ROLES: Role[] = [Role.OWNER, Role.PARTNER, Role.STORE_MANAGER, Role.ACCOUNTS_TEAM];
export const INCENTIVE_ROLES: Role[] = [Role.OWNER, Role.PARTNER, Role.ACCOUNTS_TEAM];
export const WHATSAPP_ROLES: Role[] = [Role.OWNER, Role.PARTNER, Role.STORE_MANAGER, Role.STYLIST];
export const SETTINGS_ROLES: Role[] = [Role.OWNER, Role.PARTNER];
