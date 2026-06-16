import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { INACTIVE_ORDER_STATUSES, recommendedPurchaseQty, stockStanding } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { optionalStoreScope } from "@/lib/scope";

/**
 * Intelligent purchase recommendations.
 * For every item that is short of its live reservations OR sitting at/below its
 * reorder level, returns the current stock picture, a recommended purchase
 * quantity, the reason, and the active orders affected by any shortage.
 */
export async function GET(request: NextRequest) {
  const user = await requireUser(request, "inventory.view");
  if (isApiError(user)) return user;

  const items = await prisma.inventoryItem.findMany({
    where: optionalStoreScope(user),
    include: {
      allocations: {
        select: {
          requiredQty: true,
          consumedQty: true,
          order: { select: { id: true, orderNumber: true, status: true, deliveryDate: true, customer: { select: { name: true } } } },
        },
      },
    },
  });

  const recommendations = items
    .map((item) => {
      const standing = stockStanding(item);
      const recommended = recommendedPurchaseQty(standing);
      if (recommended <= 0) return null;

      const affectedOrders = standing.shortage > 0
        ? item.allocations
            .filter((a) => a.order && !INACTIVE_ORDER_STATUSES.includes(a.order.status as (typeof INACTIVE_ORDER_STATUSES)[number]))
            .filter((a) => Number(a.requiredQty) - Number(a.consumedQty) > 0)
            .map((a) => ({ id: a.order!.id, orderNumber: a.order!.orderNumber, customer: a.order!.customer?.name ?? "—", deliveryDate: a.order!.deliveryDate }))
            .sort((x, y) => new Date(x.deliveryDate).getTime() - new Date(y.deliveryDate).getTime())
        : [];

      const reasons: string[] = [];
      if (standing.shortage > 0) reasons.push(`Short ${standing.shortage} ${item.unit} against reserved orders`);
      if (standing.belowReorder) reasons.push("At or below reorder level");

      return {
        id: item.id,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        category: item.category,
        onHand: standing.onHand,
        reserved: standing.reserved,
        available: standing.available,
        shortage: standing.shortage,
        reorderAt: standing.reorderAt,
        recommendedQty: recommended,
        estimatedCost: item.costPrice ? Math.round(recommended * Number(item.costPrice)) : null,
        reason: reasons.join(" · "),
        affectedOrders,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.shortage - a.shortage || b.recommendedQty - a.recommendedQty);

  return NextResponse.json({ recommendations, generatedAt: new Date() });
}
