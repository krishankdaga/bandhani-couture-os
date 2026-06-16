import { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { selectModules, type AssistantContext, type ModuleKey } from "@/lib/assistant";
import { getEmployeePerformance } from "@/lib/employee-performance";
import { stockStanding } from "@/lib/inventory";
import { hasPermission, type Permission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { optionalStoreScope, storeScope } from "@/lib/scope";

/**
 * The assistant's context-builder layer. Each getXContext() turns one module
 * into a compact, structured snapshot — never the whole table — and every query
 * is store-scoped for non-owners so a manager can never read another store's
 * data. buildAssistantContext() picks only the modules a question needs and the
 * user is permitted to see, then runs the relevant builders in parallel.
 */

type Dates = { now: Date; today: Date; weekEnd: Date; monthStart: Date; ninetyAgo: Date };
type Scoped = Pick<SessionUser, "companyStatus" | "storeId">;

const n = (value: unknown) => Number(value ?? 0);

/** Permission each module requires; null = available to any assistant user. */
const MODULE_PERMISSION: Record<ModuleKey, Permission | null> = {
  orders: "orders.view",
  production: "production.view",
  inventory: "inventory.view",
  purchases: "purchases.view",
  customers: "customers.view",
  leads: "leads.view",
  employees: "employees.view",
  incentives: "incentives.view",
  stores: "reports.view",
  notifications: null,
  audit: "audit.view",
};

/** User ids inside the caller's store (null = owner / unrestricted). */
async function storeUserIds(user: Scoped): Promise<string[] | null> {
  if (user.companyStatus === "OWNER" || !user.storeId) return null;
  const users = await prisma.user.findMany({ where: { storeId: user.storeId }, select: { id: true } });
  return users.map((item) => item.id);
}

export async function getOrderContext(user: Scoped, { today, weekEnd }: Dates) {
  const scope = storeScope(user);
  const active: Prisma.OrderWhereInput = { ...scope, status: { notIn: ["DELIVERED", "CANCELLED"] } };
  const select = { orderNumber: true, delayState: true, deliveryDate: true, orderValue: true, customer: { select: { name: true } }, stylist: { select: { name: true } } };
  const [counts, delayed, dueThisWeek] = await Promise.all([
    prisma.order.groupBy({ by: ["delayState"], where: active, _count: { _all: true } }),
    prisma.order.findMany({ where: { ...active, delayState: "RED" }, select, orderBy: { deliveryDate: "asc" }, take: 15 }),
    prisma.order.findMany({ where: { ...active, deliveryDate: { gte: today, lt: weekEnd } }, select, orderBy: { deliveryDate: "asc" }, take: 15 }),
  ]);
  const byState = Object.fromEntries(counts.map((c) => [c.delayState, c._count._all]));
  const fmt = (o: (typeof delayed)[number]) => ({ orderNumber: o.orderNumber, customer: o.customer.name, stylist: o.stylist?.name ?? null, delayState: o.delayState, deliveryDate: o.deliveryDate, value: n(o.orderValue) });
  return {
    activeTotal: counts.reduce((s, c) => s + c._count._all, 0),
    delayedCount: byState.RED ?? 0,
    atRiskCount: byState.YELLOW ?? 0,
    onTrackCount: byState.GREEN ?? 0,
    delayed: delayed.map(fmt),
    dueThisWeek: dueThisWeek.map(fmt),
  };
}

export async function getProductionContext(user: Scoped, { now }: Dates) {
  const orderScope = { order: storeScope(user) };
  const [overdue, byType, redStages] = await Promise.all([
    prisma.productionStage.findMany({
      where: { ...orderScope, status: { not: "COMPLETED" }, OR: [{ dueDate: { lt: now } }, { delayState: "RED" }] },
      select: { type: true, status: true, delayState: true, dueDate: true, owner: { select: { name: true } }, order: { select: { orderNumber: true, customer: { select: { name: true } } } } },
      orderBy: { dueDate: "asc" }, take: 15,
    }),
    prisma.productionStage.groupBy({ by: ["type"], where: { ...orderScope, status: { not: "COMPLETED" }, delayState: { in: ["YELLOW", "RED"] } }, _count: { _all: true } }),
    prisma.productionStage.findMany({ where: { ...orderScope, status: { not: "COMPLETED" }, delayState: "RED" }, select: { order: { select: { orderNumber: true } } }, take: 100 }),
  ]);
  const bottlenecks = byType.map((t) => ({ stage: t.type, atRisk: t._count._all })).sort((a, b) => b.atRisk - a.atRisk);
  return {
    overdueStages: overdue.map((s) => ({ order: s.order.orderNumber, customer: s.order.customer.name, stage: s.type, status: s.status, delayState: s.delayState, dueDate: s.dueDate, owner: s.owner?.name ?? null })),
    bottlenecks,
    mostDelayedStage: bottlenecks[0] ?? null,
    stuckOrders: [...new Set(redStages.map((s) => s.order.orderNumber))],
  };
}

export async function getInventoryContext(user: Scoped) {
  const items = await prisma.inventoryItem.findMany({
    where: optionalStoreScope(user),
    select: { sku: true, name: true, category: true, quantity: true, reorderAt: true, unit: true, costPrice: true, allocations: { select: { requiredQty: true, consumedQty: true, order: { select: { status: true } } } } },
  });
  const lowStock: Array<Record<string, unknown>> = [];
  const reserved: Array<Record<string, unknown>> = [];
  const valueByCategory = new Map<string, number>();
  let totalStockValue = 0;
  for (const item of items) {
    const s = stockStanding(item);
    const value = s.onHand * n(item.costPrice);
    totalStockValue += value;
    valueByCategory.set(item.category, (valueByCategory.get(item.category) ?? 0) + value);
    if (s.belowReorder || s.shortage > 0) lowStock.push({ sku: item.sku, name: item.name, category: item.category, quantity: s.onHand, reorderAt: s.reorderAt, unit: item.unit, shortage: s.shortage });
    if (s.reserved > 0) reserved.push({ sku: item.sku, name: item.name, reserved: s.reserved, available: s.available, unit: item.unit });
  }
  lowStock.sort((a, b) => n(b.shortage) - n(a.shortage) || n(a.quantity) - n(b.quantity));
  reserved.sort((a, b) => n(b.reserved) - n(a.reserved));
  return {
    lowStockCount: lowStock.length,
    lowStock: lowStock.slice(0, 20),
    reserved: reserved.slice(0, 20),
    totalStockValue: Math.round(totalStockValue),
    valueByCategory: [...valueByCategory.entries()].map(([category, value]) => ({ category, value: Math.round(value) })).sort((a, b) => b.value - a.value),
  };
}

export async function getPurchaseContext(user: Scoped, { now, today, weekEnd }: Dates) {
  const scope = optionalStoreScope(user);
  const [pending, topVendors] = await Promise.all([
    prisma.purchase.findMany({ where: { ...scope, status: { in: ["REQUESTED", "ORDERED"] } }, select: { purchaseNo: true, vendorName: true, status: true, totalAmount: true, expectedDate: true }, orderBy: { expectedDate: "asc" }, take: 20 }),
    prisma.purchase.groupBy({ by: ["vendorName"], where: scope, _count: { _all: true }, _sum: { totalAmount: true }, orderBy: { _count: { vendorName: "desc" } }, take: 10 }),
  ]);
  const overdue = pending.filter((p) => p.expectedDate && p.expectedDate < now);
  const dueThisWeek = pending.filter((p) => p.expectedDate && p.expectedDate >= today && p.expectedDate < weekEnd);
  return {
    pendingCount: pending.length,
    overdueCount: overdue.length,
    dueThisWeekCount: dueThisWeek.length,
    pendingReceipt: pending.map((p) => ({ purchaseNo: p.purchaseNo, vendor: p.vendorName, status: p.status, amount: n(p.totalAmount), expectedDate: p.expectedDate, overdue: !!(p.expectedDate && p.expectedDate < now) })),
    topVendors: topVendors.map((v) => ({ vendor: v.vendorName, purchases: v._count._all, totalSpend: n(v._sum.totalAmount) })),
  };
}

export async function getCustomerContext(user: Scoped, { ninetyAgo }: Dates) {
  const scope = storeScope(user);
  const [totals, inactive] = await Promise.all([
    prisma.order.groupBy({ by: ["customerId"], where: { ...scope, status: { not: "CANCELLED" } }, _sum: { orderValue: true }, _count: { _all: true }, orderBy: { _sum: { orderValue: "desc" } }, take: 10 }),
    prisma.customer.findMany({ where: { ...scope, orders: { none: { createdAt: { gte: ninetyAgo } } } }, select: { name: true, phone: true, store: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const customers = await prisma.customer.findMany({ where: { id: { in: totals.map((t) => t.customerId) } }, select: { id: true, name: true, phone: true, store: { select: { name: true } } } });
  const map = new Map(customers.map((c) => [c.id, c]));
  return {
    topCustomers: totals.map((t) => ({ name: map.get(t.customerId)?.name ?? "Unknown", phone: map.get(t.customerId)?.phone ?? null, store: map.get(t.customerId)?.store.name ?? null, orders: t._count._all, totalValue: n(t._sum.orderValue) })),
    inactiveSince: "90 days",
    inactiveCustomers: inactive.map((c) => ({ name: c.name, phone: c.phone, store: c.store.name })),
  };
}

export async function getLeadContext(user: Scoped, { today }: Dates) {
  const scope = storeScope(user);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const [statusCounts, followUps, conversions] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    prisma.lead.findMany({ where: { ...scope, followUpDate: { lte: tomorrow }, status: { in: ["NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED"] } }, select: { name: true, phone: true, status: true, followUpDate: true, stylist: { select: { name: true } } }, orderBy: { followUpDate: "asc" }, take: 20 }),
    prisma.lead.groupBy({ by: ["stylistId"], where: { ...scope, status: "CONVERTED", stylistId: { not: null } }, _count: { _all: true }, orderBy: { _count: { stylistId: "desc" } }, take: 10 }),
  ]);
  const total = statusCounts.reduce((s, c) => s + c._count._all, 0);
  const byStatus = Object.fromEntries(statusCounts.map((c) => [c.status, c._count._all]));
  const converted = byStatus.CONVERTED ?? 0;
  const stylists = await prisma.user.findMany({ where: { id: { in: conversions.flatMap((c) => (c.stylistId ? [c.stylistId] : [])) } }, select: { id: true, name: true } });
  const stylistMap = new Map(stylists.map((s) => [s.id, s.name]));
  return {
    total,
    converted,
    lost: byStatus.LOST ?? 0,
    conversionRate: total ? Math.round((converted / total) * 100) : 0,
    followUpsDueCount: followUps.length,
    followUpsDue: followUps.map((l) => ({ name: l.name, phone: l.phone, status: l.status, followUpDate: l.followUpDate, stylist: l.stylist?.name ?? null })),
    topStylists: conversions.map((c) => ({ stylist: c.stylistId ? stylistMap.get(c.stylistId) ?? null : null, conversions: c._count._all })),
  };
}

export async function getEmployeeContext(user: Scoped) {
  const rows = await getEmployeePerformance(user, {});
  const pending = await prisma.productionStage.groupBy({ by: ["ownerId"], where: { order: storeScope(user), status: { not: "COMPLETED" }, ownerId: { not: null } }, _count: { _all: true }, orderBy: { _count: { ownerId: "desc" } }, take: 10 });
  const nameById = new Map(rows.map((r) => [r.id, r.name]));
  const missing = pending.flatMap((p) => (p.ownerId && !nameById.has(p.ownerId) ? [p.ownerId] : []));
  if (missing.length) {
    const extra = await prisma.user.findMany({ where: { id: { in: missing } }, select: { id: true, name: true } });
    extra.forEach((u) => nameById.set(u.id, u.name));
  }
  return {
    topByActivity: rows.slice(0, 10).map((r) => ({ name: r.name, role: r.companyRoleName ?? r.role, store: r.storeName, activity: r.activityCount, leads: r.leadsHandled, conversions: r.conversions, inventoryMovements: r.inventoryMovements, incentiveAmount: r.incentiveAmount })),
    mostActive: rows[0] ? { name: rows[0].name, activity: rows[0].activityCount } : null,
    pendingProductionWork: pending.map((p) => ({ employee: p.ownerId ? nameById.get(p.ownerId) ?? "Unknown" : "Unassigned", openStages: p._count._all })),
  };
}

export async function getIncentiveContext(user: Scoped) {
  const ids = await storeUserIds(user);
  const where = ids ? { userId: { in: ids } } : {};
  const byStatus = await prisma.incentive.groupBy({ by: ["status"], where, _count: { _all: true }, _sum: { amount: true } });
  const stat = (status: "PENDING" | "APPROVED" | "PAID") => {
    const row = byStatus.find((r) => r.status === status);
    return { count: row?._count._all ?? 0, amount: n(row?._sum.amount) };
  };
  return {
    pendingApproval: stat("PENDING"),
    unpaid: stat("APPROVED"),
    paid: stat("PAID"),
  };
}

export async function getStoreContext(user: Scoped) {
  const scope = storeScope(user);
  const storeWhere = user.companyStatus === "OWNER" ? {} : user.storeId ? { id: user.storeId } : {};
  const [stores, valueAgg, orderAgg, delayedAgg] = await Promise.all([
    prisma.store.findMany({ where: storeWhere, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.order.groupBy({ by: ["storeId"], where: { ...scope, status: { not: "CANCELLED" } }, _sum: { orderValue: true } }),
    prisma.order.groupBy({ by: ["storeId"], where: scope, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["storeId"], where: { ...scope, delayState: { in: ["YELLOW", "RED"] }, status: { notIn: ["DELIVERED", "CANCELLED"] } }, _count: { _all: true } }),
  ]);
  const revenue = new Map(valueAgg.map((r) => [r.storeId, n(r._sum.orderValue)]));
  const orders = new Map(orderAgg.map((r) => [r.storeId, r._count._all]));
  const delayed = new Map(delayedAgg.map((r) => [r.storeId, r._count._all]));
  const rows = stores
    .map((s) => ({ store: s.name, revenue: revenue.get(s.id) ?? 0, orders: orders.get(s.id) ?? 0, delayedOrders: delayed.get(s.id) ?? 0 }))
    .sort((a, b) => b.revenue - a.revenue);
  return {
    stores: rows,
    topByRevenue: rows[0] ?? null,
    mostDelays: [...rows].sort((a, b) => b.delayedOrders - a.delayedOrders)[0] ?? null,
  };
}

export async function getNotificationContext(user: SessionUser, { now, today }: Dates) {
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const scope = storeScope(user);
  const [delayedOrders, redStages, overduePurchases, overdueFollowUps, pardons] = await Promise.all([
    hasPermission(user, "orders.view") ? prisma.order.count({ where: { ...scope, delayState: "RED", status: { notIn: ["DELIVERED", "CANCELLED"] } } }) : Promise.resolve(null),
    hasPermission(user, "production.view") ? prisma.productionStage.count({ where: { order: scope, status: { not: "COMPLETED" }, delayState: "RED" } }) : Promise.resolve(null),
    hasPermission(user, "purchases.view") ? prisma.purchase.count({ where: { ...optionalStoreScope(user), status: { in: ["REQUESTED", "ORDERED"] }, expectedDate: { lt: now } } }) : Promise.resolve(null),
    hasPermission(user, "leads.view") ? prisma.lead.count({ where: { ...scope, followUpDate: { lte: tomorrow }, status: { in: ["NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED"] } } }) : Promise.resolve(null),
    user.companyStatus === "OWNER" ? prisma.delayPardon.count({ where: { status: "REQUESTED" } }) : Promise.resolve(null),
  ]);
  return {
    critical: { delayedOrders, redProductionStages: redStages, overduePurchases },
    warning: { overdueFollowUps, pendingPardons: pardons },
    note: "Counts reflect this user's permitted scope. Open the Notifications centre for the per-alert read/unread state.",
  };
}

export async function getAuditContext(_user: Scoped) {
  const recent = await prisma.auditLog.findMany({
    where: { entity: { not: "AssistantQuery" }, action: { notIn: ["QUERY", "RATE_LIMITED"] } },
    select: { action: true, entity: true, entityId: true, createdAt: true, user: { select: { name: true } } },
    orderBy: { createdAt: "desc" }, take: 15,
  });
  return { recentChanges: recent.map((a) => ({ action: a.action, entity: a.entity, by: a.user?.name ?? "System", at: a.createdAt })) };
}

const BUILDERS: Record<ModuleKey, (user: SessionUser, dates: Dates) => Promise<unknown>> = {
  orders: getOrderContext,
  production: getProductionContext,
  inventory: (user) => getInventoryContext(user),
  purchases: getPurchaseContext,
  customers: getCustomerContext,
  leads: getLeadContext,
  employees: (user) => getEmployeeContext(user),
  incentives: (user) => getIncentiveContext(user),
  stores: (user) => getStoreContext(user),
  notifications: getNotificationContext,
  audit: (user) => getAuditContext(user),
};

/**
 * Orchestrator: pick the modules a question needs, drop any the user is not
 * permitted to see, build them in parallel, and return a compact structured
 * context. Only relevant slices of the database are ever assembled.
 */
export async function buildAssistantContext(user: SessionUser, question: string): Promise<AssistantContext> {
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const ninetyAgo = new Date(today); ninetyAgo.setDate(ninetyAgo.getDate() - 90);
  const dates: Dates = { now, today, weekEnd, monthStart, ninetyAgo };

  const selected = selectModules(question).filter((key) => {
    const permission = MODULE_PERMISSION[key];
    return permission === null || hasPermission(user, permission);
  });

  const entries = await Promise.all(selected.map(async (key) => [key, await BUILDERS[key](user, dates)] as const));

  return {
    generatedAt: now.toISOString(),
    role: user.companyStatus,
    storeScoped: user.companyStatus !== "OWNER",
    modules: Object.fromEntries(entries),
  };
}
