
import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { REPORT_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";
import { optionalStoreScope, storeScope } from "@/lib/scope";

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "reports.view");
  if (isApiError(user)) return user;

  const [
    leads,
    customers,
    orders,
    delayedOrders,
    inventoryItems,
    lowStock,
    purchases,
    incentives,
  ] = await Promise.all([
    prisma.lead.count({ where: storeScope(user) }),
    prisma.customer.count({ where: storeScope(user) }),
    prisma.order.count({ where: storeScope(user) }),
    prisma.order.count({ where: { ...storeScope(user), delayState: { in: ["YELLOW", "RED"] } } }),
    prisma.inventoryItem.count({ where: optionalStoreScope(user) }),
    prisma.inventoryItem.findMany({
      where: {
        ...optionalStoreScope(user),
        reorderAt: { not: null },
      },
      select: {
        quantity: true,
        reorderAt: true,
      },
    }),
    prisma.purchase.count({ where: optionalStoreScope(user) }),
    prisma.incentive.aggregate({ _sum: { amount: true } }),
  ]);

  return NextResponse.json({
    summary: {
      leads,
      customers,
      orders,
      delayedOrders,
      inventoryItems,
      lowStock: lowStock.filter((item) => Number(item.quantity) <= Number(item.reorderAt)).length,
      purchases,
      incentivePayable: incentives._sum.amount || 0,
    },
  });
}
