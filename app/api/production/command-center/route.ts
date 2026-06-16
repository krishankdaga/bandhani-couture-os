import { DelayState, OrderStatus, StageStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { aggregateOrderDelay, calculateStageDelay, stageLabels } from "@/lib/delay";
import { INACTIVE_ORDER_STATUSES, recommendedPurchaseQty, stockStanding } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { optionalStoreScope, storeScope } from "@/lib/scope";

const ACTIVE_ORDER_STATUSES = [OrderStatus.CONFIRMED, OrderStatus.IN_PRODUCTION, OrderStatus.READY];

/**
 * Production Command Center: the production manager's single-glance view of
 * everything needing attention — active/delayed/high-risk orders, stage
 * bottlenecks, capacity per team member, and material shortage alerts.
 */
export async function GET(request: NextRequest) {
  const user = await requireUser(request, "production.view");
  if (isApiError(user)) return user;
  try {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

    const orders = await prisma.order.findMany({
      where: { ...storeScope(user), status: { in: ACTIVE_ORDER_STATUSES } },
      include: {
        customer: { select: { id: true, name: true } },
        stylist: { select: { name: true } },
        pardons: { where: { status: "APPROVED" }, select: { id: true } },
        stages: { include: { owner: { select: { id: true, name: true } }, pardons: { where: { status: "APPROVED" }, select: { id: true } } }, orderBy: { sequence: "asc" } },
        materials: { select: { requiredQty: true, consumedQty: true } },
      },
      orderBy: { deliveryDate: "asc" },
    });

    const evaluated = orders.map((order) => {
      const stages = order.stages.map((stage) => ({
        ...stage,
        currentDelay: calculateStageDelay({ dueDate: stage.dueDate, status: stage.status, hasEverBeenRed: stage.hasEverBeenRed, pardonApproved: stage.pardons.length > 0, now }),
      }));
      const hasEverBeenRed = order.hasEverBeenRed || stages.some((s) => s.hasEverBeenRed || s.currentDelay === DelayState.RED);
      const currentDelay = aggregateOrderDelay(stages.map((s) => s.currentDelay), hasEverBeenRed, order.pardons.length > 0);
      const completedStages = stages.filter((s) => s.status === StageStatus.COMPLETED).length;
      const activeStage = stages.find((s) => s.status === StageStatus.IN_PROGRESS) ?? stages.find((s) => s.status !== StageStatus.COMPLETED);
      const required = order.materials.reduce((sum, m) => sum + Number(m.requiredQty), 0);
      const consumed = order.materials.reduce((sum, m) => sum + Number(m.consumedQty), 0);
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customer: order.customer,
        stylist: order.stylist,
        priority: order.priority,
        orderValue: order.orderValue,
        deliveryDate: order.deliveryDate,
        status: order.status,
        delayState: currentDelay,
        completedStages,
        totalStages: stages.length,
        currentStage: activeStage ? { type: activeStage.type, label: stageLabels[activeStage.type as keyof typeof stageLabels], owner: activeStage.owner?.name ?? activeStage.vendorName ?? null, delayState: activeStage.currentDelay } : null,
        materials: { lines: order.materials.length, requiredQty: required, consumedQty: consumed },
        blocked: stages.some((s) => s.status === StageStatus.BLOCKED),
      };
    });

    // Stage bottlenecks: where delayed work is concentrated.
    const openStages = evaluated.flatMap((order) =>
      orders.find((o) => o.id === order.id)!.stages
        .filter((s) => s.status !== StageStatus.COMPLETED)
        .map((s) => ({ type: s.type, delay: calculateStageDelay({ dueDate: s.dueDate, status: s.status, hasEverBeenRed: s.hasEverBeenRed, pardonApproved: s.pardons.length > 0, now }) }))
    );
    const bottleneckMap = openStages.reduce<Record<string, { count: number; red: number; yellow: number }>>((acc, s) => {
      const cur = acc[s.type] ?? { count: 0, red: 0, yellow: 0 };
      cur.count += 1;
      if (s.delay === DelayState.RED) cur.red += 1;
      if (s.delay === DelayState.YELLOW) cur.yellow += 1;
      acc[s.type] = cur;
      return acc;
    }, {});
    const bottlenecks = Object.entries(bottleneckMap)
      .map(([type, c]) => ({ type, label: stageLabels[type as keyof typeof stageLabels], ...c }))
      .sort((a, b) => b.red - a.red || b.count - a.count);

    // Capacity: open (incomplete) stages per assigned team member.
    const capacityMap = new Map<string, { name: string; open: number; red: number }>();
    for (const order of orders) {
      for (const stage of order.stages) {
        if (stage.status === StageStatus.COMPLETED || !stage.owner) continue;
        const entry = capacityMap.get(stage.owner.id) ?? { name: stage.owner.name, open: 0, red: 0 };
        entry.open += 1;
        const delay = calculateStageDelay({ dueDate: stage.dueDate, status: stage.status, hasEverBeenRed: stage.hasEverBeenRed, pardonApproved: stage.pardons.length > 0, now });
        if (delay === DelayState.RED) entry.red += 1;
        capacityMap.set(stage.owner.id, entry);
      }
    }
    const capacity = [...capacityMap.values()].sort((a, b) => b.open - a.open);

    // Shortage alerts (only if user can see inventory).
    let shortages: Array<{ id: string; sku: string; name: string; unit: string; shortage: number; recommendedQty: number }> = [];
    if (hasPermission(user, "inventory.view")) {
      const items = await prisma.inventoryItem.findMany({
        where: optionalStoreScope(user),
        include: { allocations: { select: { requiredQty: true, consumedQty: true, order: { select: { status: true } } } } },
      });
      shortages = items
        .map((item) => ({ item, standing: stockStanding(item) }))
        .filter(({ standing }) => standing.shortage > 0)
        .map(({ item, standing }) => ({ id: item.id, sku: item.sku, name: item.name, unit: item.unit, shortage: standing.shortage, recommendedQty: recommendedPurchaseQty(standing) }))
        .sort((a, b) => b.shortage - a.shortage)
        .slice(0, 12);
    }

    const delayed = evaluated.filter((o) => o.delayState === DelayState.RED);
    const atRisk = evaluated.filter((o) => o.delayState === DelayState.YELLOW);
    const dueThisWeek = evaluated.filter((o) => new Date(o.deliveryDate) >= today && new Date(o.deliveryDate) <= weekEnd);
    const highRisk = evaluated
      .filter((o) => o.delayState !== DelayState.GREEN || o.blocked)
      .sort((a, b) => (a.delayState === DelayState.RED ? -1 : 1) - (b.delayState === DelayState.RED ? -1 : 1) || new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime());

    return NextResponse.json({
      generatedAt: now,
      metrics: {
        activeOrders: evaluated.length,
        delayed: delayed.length,
        atRisk: atRisk.length,
        blocked: evaluated.filter((o) => o.blocked).length,
        dueThisWeek: dueThisWeek.length,
        shortages: shortages.length,
      },
      highRisk: highRisk.slice(0, 12),
      dueThisWeek: dueThisWeek.slice(0, 12),
      bottlenecks,
      capacity,
      shortages,
      canViewInventory: hasPermission(user, "inventory.view"),
    });
  } catch (error) {
    return validationError(error);
  }
}
