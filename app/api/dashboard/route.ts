import { DelayState, OrderStatus, StageStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { aggregateOrderDelay, calculateStageDelay, stageLabels } from "@/lib/delay";
import { recommendedPurchaseQty, stockStanding } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { optionalStoreScope, storeScope } from "@/lib/scope";

const ACTIVE_ORDER_STATUSES = [OrderStatus.CONFIRMED, OrderStatus.IN_PRODUCTION, OrderStatus.READY];
const ACTIVE_LEAD_STATUSES = ["NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED"] as const;
const HIGH_VALUE_THRESHOLD = 100000;

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "dashboard.view");
  if (isApiError(user)) return user;

  try {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
    const storeWhere = storeScope(user);
    const canViewAudit = user.permissions.includes("audit.view");

    const [activeLeadsToday, followUpsDueToday, activeOrders, recentAudit, followUps, inventoryCandidates, pendingPurchases] = await Promise.all([
      prisma.lead.count({
        where: { ...storeWhere, createdAt: { gte: today, lt: tomorrow }, status: { in: [...ACTIVE_LEAD_STATUSES] } },
      }),
      prisma.lead.count({
        where: { ...storeWhere, followUpDate: { gte: today, lt: tomorrow }, status: { in: [...ACTIVE_LEAD_STATUSES] } },
      }),
      prisma.order.findMany({
        where: { ...storeWhere, status: { in: ACTIVE_ORDER_STATUSES } },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          stylist: { select: { name: true } },
          pardons: { where: { status: "APPROVED" }, select: { id: true } },
          stages: { include: { pardons: { where: { status: "APPROVED" }, select: { id: true } } }, orderBy: { sequence: "asc" } },
        },
        orderBy: { deliveryDate: "asc" },
      }),
      canViewAudit ? prisma.auditLog.findMany({
        include: { user: { select: { name: true, role: true } } }, orderBy: { createdAt: "desc" }, take: 8,
      }) : Promise.resolve([]),
      hasPermission(user, "leads.view") ? prisma.lead.findMany({
        where: { ...storeWhere, followUpDate: { gte: today, lt: tomorrow }, status: { in: [...ACTIVE_LEAD_STATUSES] } },
        select: { id: true, name: true, phone: true, status: true, followUpDate: true, stylist: { select: { name: true } } }, orderBy: { followUpDate: "asc" }, take: 6,
      }) : Promise.resolve([]),
      hasPermission(user, "inventory.view") ? prisma.inventoryItem.findMany({
        where: { ...optionalStoreScope(user) }, select: { id: true, sku: true, name: true, quantity: true, reorderAt: true, unit: true, allocations: { select: { requiredQty: true, consumedQty: true, order: { select: { status: true } } } } }, orderBy: { quantity: "asc" },
      }) : Promise.resolve([]),
      hasPermission(user, "purchases.view") ? prisma.purchase.findMany({
        where: { ...optionalStoreScope(user), status: { in: ["REQUESTED", "ORDERED"] } }, select: { id: true, purchaseNo: true, vendorName: true, status: true, expectedDate: true, totalAmount: true }, orderBy: { expectedDate: "asc" }, take: 6,
      }) : Promise.resolve([]),
    ]);

    const evaluatedOrders = activeOrders.map((order) => {
      const stages = order.stages.map((stage) => ({
        ...stage,
        currentDelay: calculateStageDelay({
          dueDate: stage.dueDate,
          status: stage.status,
          hasEverBeenRed: stage.hasEverBeenRed,
          pardonApproved: stage.pardons.length > 0,
          now,
        }),
      }));
      const hasEverBeenRed = order.hasEverBeenRed || stages.some((stage) => stage.hasEverBeenRed || stage.currentDelay === DelayState.RED);
      const currentDelay = aggregateOrderDelay(stages.map((stage) => stage.currentDelay), hasEverBeenRed, order.pardons.length > 0);
      return { ...order, stages, currentDelay };
    });

    const deliveriesDue = evaluatedOrders.filter((order) => order.deliveryDate >= today && order.deliveryDate <= weekEnd);
    const highValueOrders = evaluatedOrders
      .filter((order) => Number(order.orderValue) >= HIGH_VALUE_THRESHOLD)
      .sort((a, b) => Number(b.orderValue) - Number(a.orderValue))
      .slice(0, 6);

    const openStages = evaluatedOrders.flatMap((order) => order.stages
      .filter((stage) => stage.status !== StageStatus.COMPLETED)
      .map((stage) => ({ ...stage, order: { id: order.id, orderNumber: order.orderNumber, customer: order.customer } })));

    const bottleneckMap = openStages.reduce<Record<string, { count: number; red: number; yellow: number }>>((acc, stage) => {
      if (stage.currentDelay === DelayState.GREEN) return acc;
      const current = acc[stage.type] ?? { count: 0, red: 0, yellow: 0 };
      current.count += 1;
      if (stage.currentDelay === DelayState.RED) current.red += 1;
      if (stage.currentDelay === DelayState.YELLOW) current.yellow += 1;
      acc[stage.type] = current;
      return acc;
    }, {});

    const bottlenecks = Object.entries(bottleneckMap)
      .map(([type, counts]) => ({ type, label: stageLabels[type as keyof typeof stageLabels], ...counts }))
      .sort((a, b) => b.red - a.red || b.count - a.count);

    const inventoryStandings = inventoryCandidates.map((item) => ({ item, standing: stockStanding(item) }));
    const lowStock = inventoryStandings
      .filter(({ standing }) => standing.belowReorder)
      .slice(0, 6)
      .map(({ item }) => ({ id: item.id, sku: item.sku, name: item.name, quantity: item.quantity, reorderAt: item.reorderAt, unit: item.unit }));
    const shortages = inventoryStandings
      .filter(({ standing }) => standing.shortage > 0)
      .sort((a, b) => b.standing.shortage - a.standing.shortage)
      .slice(0, 6)
      .map(({ item, standing }) => ({ id: item.id, sku: item.sku, name: item.name, unit: item.unit, shortage: standing.shortage, recommendedQty: recommendedPurchaseQty(standing) }));
    return NextResponse.json({
      generatedAt: now,
      companyStatus: user.companyStatus,
      companyRoleName: user.companyRoleName,
      permissions: user.permissions,
      highValueThreshold: HIGH_VALUE_THRESHOLD,
      metrics: {
        activeLeadsToday,
        followUpsDueToday,
        activeOrders: evaluatedOrders.length,
        ordersAtRisk: evaluatedOrders.filter((order) => order.currentDelay === DelayState.YELLOW).length,
        delayedOrders: evaluatedOrders.filter((order) => order.currentDelay === DelayState.RED).length,
        deliveriesDueThisWeek: deliveriesDue.length,
        materialShortages: shortages.length,
      },
      deliveriesDue: deliveriesDue.slice(0, 6).map((order) => ({
        id: order.id, orderNumber: order.orderNumber, orderValue: order.orderValue, deliveryDate: order.deliveryDate,
        priority: order.priority, delayState: order.currentDelay, customer: order.customer, stylist: order.stylist,
      })),
      highValueOrders: highValueOrders.map((order) => ({
        id: order.id, orderNumber: order.orderNumber, orderValue: order.orderValue, deliveryDate: order.deliveryDate,
        priority: order.priority, delayState: order.currentDelay, customer: order.customer, stylist: order.stylist,
      })),
      bottlenecks,
      recentAudit,
      followUps,
      lowStock,
      shortages,
      pendingPurchases,
    });
  } catch (error) {
    return validationError(error);
  }
}
