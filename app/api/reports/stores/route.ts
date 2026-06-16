import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { dateRangeScope } from "@/lib/report-filters";
import { prisma } from "@/lib/prisma";
import { resolveOptionalStoreScope, resolveStoreScope } from "@/lib/scope";

/**
 * Per-store comparison for the Reports page. Owners see every store (or one when
 * a specific storeId is requested); managers/employees are always pinned to their
 * own store regardless of the storeId query param, so they cannot read other
 * stores' figures. Inventory/purchase records with no store are shared and are
 * not attributed to any single store.
 */
export async function GET(request: NextRequest) {
  const user = await requireUser(request, "reports.view");
  if (isApiError(user)) return user;

  try {
    const url = new URL(request.url);
    const requestedStoreId = url.searchParams.get("storeId");

    const scope = resolveStoreScope(user, requestedStoreId);
    const optionalScope = resolveOptionalStoreScope(user, requestedStoreId);
    const dated = dateRangeScope(url.searchParams.get("dateFrom"), url.searchParams.get("dateTo"));

    // Which stores this user may see, mirroring the scope above.
    const pinnedStoreId =
      user.companyStatus !== "OWNER"
        ? user.storeId
        : requestedStoreId && requestedStoreId !== "all"
          ? requestedStoreId
          : null;
    const storeWhere = pinnedStoreId ? { id: pinnedStoreId } : {};

    const [stores, ordersAgg, valueAgg, delayedAgg, leadsAgg, customersAgg, purchasesAgg, inventory] =
      await Promise.all([
        prisma.store.findMany({ where: storeWhere, orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.order.groupBy({ by: ["storeId"], where: { ...scope, ...dated }, _count: { _all: true } }),
        prisma.order.groupBy({ by: ["storeId"], where: { ...scope, ...dated, status: { not: "CANCELLED" } }, _sum: { orderValue: true } }),
        prisma.order.groupBy({ by: ["storeId"], where: { ...scope, ...dated, delayState: { in: ["YELLOW", "RED"] } }, _count: { _all: true } }),
        prisma.lead.groupBy({ by: ["storeId"], where: { ...scope, ...dated }, _count: { _all: true } }),
        prisma.customer.groupBy({ by: ["storeId"], where: { ...scope, ...dated }, _count: { _all: true } }),
        prisma.purchase.groupBy({ by: ["storeId"], where: { ...optionalScope, ...dated, status: { in: ["REQUESTED", "ORDERED"] } }, _count: { _all: true } }),
        // Low stock is a current-stock snapshot, so it ignores the date range.
        prisma.inventoryItem.findMany({ where: { ...optionalScope, reorderAt: { not: null } }, select: { storeId: true, quantity: true, reorderAt: true } }),
      ]);

    const countBy = (rows: Array<{ storeId: string | null; _count: { _all: number } }>) =>
      new Map(rows.map((r) => [r.storeId, r._count._all]));
    const orders = countBy(ordersAgg);
    const delayed = countBy(delayedAgg);
    const leads = countBy(leadsAgg);
    const customers = countBy(customersAgg);
    const purchasesPending = countBy(purchasesAgg);
    const orderValue = new Map(valueAgg.map((r) => [r.storeId, Number(r._sum.orderValue ?? 0)]));

    const lowStock = new Map<string, number>();
    for (const item of inventory) {
      if (item.storeId && Number(item.quantity) <= Number(item.reorderAt)) {
        lowStock.set(item.storeId, (lowStock.get(item.storeId) ?? 0) + 1);
      }
    }

    const rows = stores.map((s) => ({
      storeId: s.id,
      storeName: s.name,
      orders: orders.get(s.id) ?? 0,
      orderValue: orderValue.get(s.id) ?? 0,
      delayedOrders: delayed.get(s.id) ?? 0,
      leads: leads.get(s.id) ?? 0,
      customers: customers.get(s.id) ?? 0,
      purchasesPending: purchasesPending.get(s.id) ?? 0,
      lowStock: lowStock.get(s.id) ?? 0,
    }));

    return NextResponse.json({ stores: rows });
  } catch (error) {
    return validationError(error);
  }
}
