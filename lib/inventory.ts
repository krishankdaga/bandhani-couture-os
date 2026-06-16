import { Prisma } from "@prisma/client";

/**
 * Stock accounting model
 * ------------------------------------------------------------------
 * quantity   = physical stock on hand (adjusted only by StockMovement)
 * reserved   = sum(requiredQty - consumedQty) across allocations on ACTIVE orders
 * available  = quantity - reserved   (can be negative => shortage)
 * shortage   = max(0, reserved - quantity)
 *
 * Allocating reserves stock but does NOT reduce physical quantity.
 * Consuming converts a reserved portion into a physical OUT movement:
 *   quantity -= amount  AND  consumedQty += amount
 * which keeps `available` stable while reducing both reserved and on-hand.
 */

// Orders that no longer hold a live claim on materials.
export const INACTIVE_ORDER_STATUSES = ["DELIVERED", "CANCELLED"] as const;

const dec = (value: Prisma.Decimal | number | string | null | undefined) => Number(value ?? 0);

export type StockStanding = {
  onHand: number;
  reserved: number;
  consumed: number;
  available: number;
  shortage: number;
  reorderAt: number | null;
  belowReorder: boolean;
};

type AllocationLike = {
  requiredQty: Prisma.Decimal | number | string;
  consumedQty: Prisma.Decimal | number | string;
  order?: { status?: string } | null;
};

/** Whether an allocation still reserves stock (its order is active). */
function isLiveAllocation(allocation: AllocationLike) {
  const status = allocation.order?.status;
  // If the caller did not include the order we assume the allocation is live.
  if (!status) return true;
  return !INACTIVE_ORDER_STATUSES.includes(status as (typeof INACTIVE_ORDER_STATUSES)[number]);
}

/** Compute the full stock standing for one inventory item from its allocations. */
export function stockStanding(item: {
  quantity: Prisma.Decimal | number | string;
  reorderAt?: Prisma.Decimal | number | string | null;
  allocations?: AllocationLike[];
}): StockStanding {
  const onHand = dec(item.quantity);
  let reserved = 0;
  let consumed = 0;
  for (const allocation of item.allocations ?? []) {
    consumed += dec(allocation.consumedQty);
    if (isLiveAllocation(allocation)) {
      reserved += Math.max(0, dec(allocation.requiredQty) - dec(allocation.consumedQty));
    }
  }
  const available = onHand - reserved;
  const reorderAt = item.reorderAt === null || item.reorderAt === undefined ? null : dec(item.reorderAt);
  return {
    onHand,
    reserved,
    consumed,
    available,
    shortage: Math.max(0, reserved - onHand),
    reorderAt,
    belowReorder: reorderAt !== null && onHand <= reorderAt,
  };
}

/**
 * Recommended purchase quantity for an item.
 * Covers any shortage (reserved beyond on-hand) plus topping the on-hand
 * back up to the reorder level when it has fallen at/below it.
 * Returns 0 when no action is needed.
 */
export function recommendedPurchaseQty(standing: StockStanding): number {
  const toCoverShortage = standing.shortage;
  const toReachReorder = standing.reorderAt !== null && standing.onHand < standing.reorderAt
    ? standing.reorderAt - standing.onHand
    : 0;
  return Math.max(toCoverShortage, toReachReorder);
}

/** The Prisma include needed to compute a standing with live/inactive awareness. */
export const allocationStandingInclude = {
  allocations: { select: { requiredQty: true, consumedQty: true, order: { select: { status: true } } } },
} satisfies Prisma.InventoryItemInclude;
