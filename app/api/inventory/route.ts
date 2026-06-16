
import { InventoryCategory, StockMovementType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { allocationStandingInclude, recommendedPurchaseQty, stockStanding } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { optionalStoreScope } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  sku: z.string().min(2),
  name: z.string().min(2),
  category: z.nativeEnum(InventoryCategory),
  storeId: z.string().optional().nullable(),
  quantity: z.coerce.number().default(0),
  unit: z.string().default("pcs"),
  reorderAt: z.coerce.number().optional().nullable(),
  costPrice: z.coerce.number().optional().nullable(),
  sellingPrice: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "inventory.view");
  if (isApiError(user)) return user;

  const items = await prisma.inventoryItem.findMany({
    where: optionalStoreScope(user),
    orderBy: { updatedAt: "desc" },
    include: { movements: { orderBy: { createdAt: "desc" }, take: 5 }, ...allocationStandingInclude },
  });

  const enriched = items.map((item) => {
    const standing = stockStanding(item);
    // Drop the raw allocations payload; expose the computed standing instead.
    const { allocations, ...rest } = item;
    void allocations;
    return {
      ...rest,
      reserved: standing.reserved,
      available: standing.available,
      consumed: standing.consumed,
      shortage: standing.shortage,
      recommendedPurchase: recommendedPurchaseQty(standing),
    };
  });

  return NextResponse.json({ items: enriched });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, "inventory.create");
  if (isApiError(user)) return user;

  try {
    const data = schema.parse(await request.json());
    if (user.companyStatus !== "OWNER" && user.storeId && data.storeId && data.storeId !== user.storeId) return NextResponse.json({ error: "You cannot create inventory for another store" }, { status: 403 });

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({ data: {
        ...data, storeId: user.companyStatus !== "OWNER" && user.storeId ? user.storeId : data.storeId,
        movements: data.quantity
          ? {
              create: {
                type: StockMovementType.IN,
                quantity: data.quantity,
                reason: "Opening stock",
                createdById: user.id,
              },
            }
          : undefined,
      }, include: { movements: true } });
      await writeAudit(tx, { userId: user.id, action: "CREATE", entity: "InventoryItem", entityId: created.id, newValue: created });
      return created;
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
