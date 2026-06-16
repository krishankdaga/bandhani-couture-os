import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { stockStanding } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { optionalStoreScope, storeScope } from "@/lib/scope";

/**
 * Advanced analytics: sales trend, lead-conversion performance, and per-employee
 * productivity over a date range. Aggregation-only — no schema dependencies.
 * Query params: from=YYYY-MM-DD, to=YYYY-MM-DD (default: last 90 days).
 */
export async function GET(request: NextRequest) {
  const user = await requireUser(request, "reports.view");
  if (isApiError(user)) return user;
  try {
    const url = new URL(request.url);
    const now = new Date();
    const defaultFrom = new Date(now); defaultFrom.setDate(defaultFrom.getDate() - 90);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const from = fromParam ? new Date(fromParam) : defaultFrom;
    const to = toParam ? new Date(toParam) : now;
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new Error("Invalid date");
    to.setHours(23, 59, 59, 999);
    const range = { gte: from, lte: to };

    const scope = storeScope(user);

    const [orders, leads, stages, users, inventory] = await Promise.all([
      prisma.order.findMany({
        where: { ...scope, createdAt: range },
        select: { id: true, orderValue: true, status: true, delayState: true, createdAt: true, stylist: { select: { id: true, name: true } }, payments: { select: { amount: true, kind: true, paidAt: true } } },
      }),
      prisma.lead.findMany({
        where: { ...scope, createdAt: range },
        select: { id: true, source: true, status: true, stylist: { select: { id: true, name: true } } },
      }),
      prisma.productionStage.findMany({
        where: { order: scope, updatedAt: range },
        select: { status: true, hasEverBeenRed: true, owner: { select: { id: true, name: true } } },
      }),
      prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true } }),
      prisma.inventoryItem.findMany({
        where: optionalStoreScope(user),
        select: { quantity: true, costPrice: true, reorderAt: true, allocations: { select: { requiredQty: true, consumedQty: true, order: { select: { status: true } } } } },
      }),
    ]);

    // --- Sales ---
    const billed = orders.filter((o) => o.status !== "CANCELLED");
    const totalRevenue = billed.reduce((s, o) => s + Number(o.orderValue), 0);
    const totalCollected = orders.reduce((s, o) => s + o.payments.reduce((ps, p) => ps + (p.kind === "REFUND" ? -Number(p.amount) : Number(p.amount)), 0), 0);
    const salesByMonthMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of billed) {
      const key = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, "0")}`;
      const cur = salesByMonthMap.get(key) ?? { revenue: 0, orders: 0 };
      cur.revenue += Number(o.orderValue); cur.orders += 1;
      salesByMonthMap.set(key, cur);
    }
    const salesByMonth = [...salesByMonthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, ...v }));

    // --- Lead conversion ---
    const convertedLeads = leads.filter((l) => l.status === "CONVERTED");
    const lostLeads = leads.filter((l) => l.status === "LOST");
    const bySourceMap = new Map<string, { total: number; converted: number }>();
    for (const l of leads) {
      const cur = bySourceMap.get(l.source) ?? { total: 0, converted: 0 };
      cur.total += 1; if (l.status === "CONVERTED") cur.converted += 1;
      bySourceMap.set(l.source, cur);
    }
    const leadsBySource = [...bySourceMap.entries()].map(([source, v]) => ({ source, ...v, rate: v.total ? Math.round((v.converted / v.total) * 100) : 0 })).sort((a, b) => b.total - a.total);

    // --- Employee performance ---
    type Perf = { id: string; name: string; role: string; leads: number; conversions: number; sales: number; salesValue: number; stagesCompleted: number; delaysCaused: number };
    const perfMap = new Map<string, Perf>();
    const ensure = (id: string, name: string, role: string) => {
      if (!perfMap.has(id)) perfMap.set(id, { id, name, role, leads: 0, conversions: 0, sales: 0, salesValue: 0, stagesCompleted: 0, delaysCaused: 0 });
      return perfMap.get(id)!;
    };
    const roleOf = (id: string) => users.find((u) => u.id === id)?.role ?? "";
    for (const l of leads) if (l.stylist) { const p = ensure(l.stylist.id, l.stylist.name, roleOf(l.stylist.id)); p.leads += 1; if (l.status === "CONVERTED") p.conversions += 1; }
    for (const o of billed) if (o.stylist) { const p = ensure(o.stylist.id, o.stylist.name, roleOf(o.stylist.id)); p.sales += 1; p.salesValue += Number(o.orderValue); }
    for (const s of stages) if (s.owner) { const p = ensure(s.owner.id, s.owner.name, roleOf(s.owner.id)); if (s.status === "COMPLETED") p.stagesCompleted += 1; if (s.hasEverBeenRed) p.delaysCaused += 1; }
    const employeePerformance = [...perfMap.values()]
      .map((p) => ({ ...p, conversionRate: p.leads ? Math.round((p.conversions / p.leads) * 100) : 0 }))
      .sort((a, b) => b.salesValue - a.salesValue || b.conversions - a.conversions);

    // --- Inventory valuation ---
    let stockValue = 0; let shortageItems = 0;
    for (const item of inventory) {
      stockValue += Number(item.quantity) * Number(item.costPrice ?? 0);
      if (stockStanding(item).shortage > 0) shortageItems += 1;
    }

    return NextResponse.json({
      range: { from, to },
      sales: {
        totalRevenue,
        totalCollected,
        outstanding: Math.max(0, totalRevenue - totalCollected),
        orderCount: billed.length,
        cancelledCount: orders.length - billed.length,
        averageOrderValue: billed.length ? Math.round(totalRevenue / billed.length) : 0,
        byMonth: salesByMonth,
      },
      leads: {
        total: leads.length,
        converted: convertedLeads.length,
        lost: lostLeads.length,
        conversionRate: leads.length ? Math.round((convertedLeads.length / leads.length) * 100) : 0,
        bySource: leadsBySource,
      },
      employees: employeePerformance,
      inventory: { stockValue: Math.round(stockValue), shortageItems, itemCount: inventory.length },
    });
  } catch (error) {
    return validationError(error);
  }
}
