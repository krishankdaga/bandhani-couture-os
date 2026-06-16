
import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { dateRangeScope } from "@/lib/report-filters";
import { resolveOptionalStoreScope, resolveStoreScope } from "@/lib/scope";

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "reports.view");
  if (isApiError(user)) return user;

  try {
    const url = new URL(request.url);
    const requestedStoreId = url.searchParams.get("storeId");

    const scope = resolveStoreScope(user, requestedStoreId);
    const optionalScope = resolveOptionalStoreScope(user, requestedStoreId);
    // Optional createdAt range; absent => all-time (previous behaviour).
    const dated = dateRangeScope(url.searchParams.get("dateFrom"), url.searchParams.get("dateTo"));

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
      prisma.lead.count({ where: { ...scope, ...dated } }),
      prisma.customer.count({ where: { ...scope, ...dated } }),
      prisma.order.count({ where: { ...scope, ...dated } }),
      prisma.order.count({ where: { ...scope, ...dated, delayState: { in: ["YELLOW", "RED"] } } }),
      prisma.inventoryItem.count({ where: optionalScope }),
      prisma.inventoryItem.findMany({
        where: {
          ...optionalScope,
          reorderAt: { not: null },
        },
        select: {
          quantity: true,
          reorderAt: true,
        },
      }),
      prisma.purchase.count({ where: { ...optionalScope, ...dated } }),
      prisma.incentive.aggregate({ _sum: { amount: true }, where: dated }),
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
  } catch (error) {
    return validationError(error);
  }
}
