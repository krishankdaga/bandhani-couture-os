import { NextRequest } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { csvResponse, toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { optionalStoreScope, storeScope } from "@/lib/scope";

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "reports.export"); if (isApiError(user)) return user;
  const [leads, customers, orders, delayedOrders, inventory, purchases] = await Promise.all([
    prisma.lead.count({ where: storeScope(user) }), prisma.customer.count({ where: storeScope(user) }), prisma.order.count({ where: storeScope(user) }),
    prisma.order.count({ where: { ...storeScope(user), delayState: { in: ["YELLOW", "RED"] } } }),
    prisma.inventoryItem.findMany({ where: optionalStoreScope(user), select: { quantity: true, reorderAt: true } }),
    prisma.purchase.count({ where: optionalStoreScope(user) }),
  ]);
  const lowStock = inventory.filter((item) => item.reorderAt !== null && Number(item.quantity) <= Number(item.reorderAt)).length;
  return csvResponse("bandhani-report-summary.csv", toCsv(["Metric", "Value"], [["Leads", leads], ["Customers", customers], ["Orders", orders], ["Delayed Orders", delayedOrders], ["Inventory Items", inventory.length], ["Low Stock", lowStock], ["Purchases", purchases]]));
}
