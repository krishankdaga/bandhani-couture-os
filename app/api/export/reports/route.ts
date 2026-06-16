import { NextRequest } from "next/server";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { csvResponse, toCsv } from "@/lib/csv";
import { dateRangeScope } from "@/lib/report-filters";
import { prisma } from "@/lib/prisma";
import { resolveOptionalStoreScope, resolveStoreScope } from "@/lib/scope";

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "reports.export"); if (isApiError(user)) return user;
  try {
    const url = new URL(request.url);
    const storeId = url.searchParams.get("storeId");
    const scope = resolveStoreScope(user, storeId);
    const optionalScope = resolveOptionalStoreScope(user, storeId);
    const dated = dateRangeScope(url.searchParams.get("dateFrom"), url.searchParams.get("dateTo"));

    const [leads, customers, orders, delayedOrders, inventory, purchases] = await Promise.all([
      prisma.lead.count({ where: { ...scope, ...dated } }),
      prisma.customer.count({ where: { ...scope, ...dated } }),
      prisma.order.count({ where: { ...scope, ...dated } }),
      prisma.order.count({ where: { ...scope, ...dated, delayState: { in: ["YELLOW", "RED"] } } }),
      prisma.inventoryItem.findMany({ where: optionalScope, select: { quantity: true, reorderAt: true } }),
      prisma.purchase.count({ where: { ...optionalScope, ...dated } }),
    ]);
    const lowStock = inventory.filter((item) => item.reorderAt !== null && Number(item.quantity) <= Number(item.reorderAt)).length;
    return csvResponse("bandhani-report-summary.csv", toCsv(["Metric", "Value"], [["Leads", leads], ["Customers", customers], ["Orders", orders], ["Delayed Orders", delayedOrders], ["Inventory Items", inventory.length], ["Low Stock", lowStock], ["Purchases", purchases]]));
  } catch (error) {
    return validationError(error);
  }
}
