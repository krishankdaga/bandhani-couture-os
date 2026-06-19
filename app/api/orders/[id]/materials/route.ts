import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BusinessError, isApiError, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { allocationStandingInclude, stockStanding } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { storeScope } from "@/lib/scope";

const allocateSchema = z.object({
  inventoryItemId: z.string().min(1, "Choose an inventory item"),
  requiredQty: z.coerce.number().positive("Quantity must be greater than zero").max(99_999_999),
  note: z.string().max(300).optional().nullable(),
  sendToDyer: z.boolean().optional().default(false),
  dyeColour: z.string().max(100).optional().nullable(),
  dyeInstructions: z.string().max(500).optional().nullable(),
  allowShortage: z.boolean().optional().default(false),
});

async function findScopedOrder(id: string, user: Awaited<ReturnType<typeof requireUser>>) {
  if (isApiError(user)) return null;
  return prisma.order.findFirst({ where: { id, ...storeScope(user) }, select: { id: true, orderNumber: true, status: true } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "orders.view");
  if (isApiError(user)) return user;
  const { id } = await params;
  const order = await findScopedOrder(id, user);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const materials = await prisma.orderMaterial.findMany({
    where: { orderId: id },
    include: {
      inventoryItem: { include: allocationStandingInclude },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const lines = materials.map((material) => {
    const standing = stockStanding(material.inventoryItem);
    const required = Number(material.requiredQty);
    const consumed = Number(material.consumedQty);
    const costPrice = Number(material.inventoryItem.costPrice ?? 0);
    return {
      id: material.id,
      inventoryItemId: material.inventoryItemId,
      sku: material.inventoryItem.sku,
      name: material.inventoryItem.name,
      unit: material.inventoryItem.unit,
      category: material.inventoryItem.category,
      requiredQty: required,
      consumedQty: consumed,
      remainingQty: Math.max(0, required - consumed),
      // Cost accounting: unit cost from inventory, committed (allocated) vs used (consumed).
      costPrice,
      committedCost: required * costPrice,
      consumedCost: consumed * costPrice,
      note: material.note,
      sendToDyer: material.sendToDyer,
      dyeColour: material.dyeColour,
      dyeInstructions: material.dyeInstructions,
      createdBy: material.createdBy?.name ?? null,
      // Item-wide stock context so the UI can warn about shortages.
      itemOnHand: standing.onHand,
      itemReserved: standing.reserved,
      itemAvailable: standing.available,
      itemShortage: standing.shortage,
    };
  });

  // Inventory items available to allocate from (consumables only — finished goods excluded).
  const stock = await prisma.inventoryItem.findMany({
    where: { category: { not: "FINISHED_GOOD" } },
    include: allocationStandingInclude,
    orderBy: { name: "asc" },
  });
  const items = stock.map((item) => {
    const standing = stockStanding(item);
    return { id: item.id, sku: item.sku, name: item.name, unit: item.unit, category: item.category, onHand: standing.onHand, available: standing.available };
  });

  return NextResponse.json({ materials: lines, items });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "orders.edit");
  if (isApiError(user)) return user;
  try {
    const { id } = await params;
    const order = await findScopedOrder(id, user);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const data = allocateSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: data.inventoryItemId }, include: allocationStandingInclude });
      if (!item) throw new BusinessError("Inventory item not found", 404);

      const existing = await tx.orderMaterial.findUnique({ where: { orderId_inventoryItemId: { orderId: id, inventoryItemId: data.inventoryItemId } } });

      // Available excluding this order's own existing reservation (so editing doesn't double-count).
      const standing = stockStanding(item);
      const ownReserved = existing ? Math.max(0, Number(existing.requiredQty) - Number(existing.consumedQty)) : 0;
      const availableToThisOrder = standing.available + ownReserved;
      const alreadyConsumed = existing ? Number(existing.consumedQty) : 0;
      if (data.requiredQty < alreadyConsumed) throw new BusinessError("Required quantity cannot be below what is already consumed");
      const newReservation = Math.max(0, data.requiredQty - alreadyConsumed);
      if (newReservation > availableToThisOrder && !data.allowShortage) {
        throw new BusinessError(`Only ${availableToThisOrder} ${item.unit} available. Enable "allocate despite shortage" to reserve anyway.`);
      }

      const dyeFields = {
        sendToDyer: data.sendToDyer,
        ...(data.dyeColour !== undefined && { dyeColour: data.dyeColour || null }),
        ...(data.dyeInstructions !== undefined && { dyeInstructions: data.dyeInstructions || null }),
      };
      const material = existing
        ? await tx.orderMaterial.update({ where: { id: existing.id }, data: { requiredQty: data.requiredQty, note: data.note ?? existing.note, ...dyeFields } })
        : await tx.orderMaterial.create({ data: { orderId: id, inventoryItemId: data.inventoryItemId, requiredQty: data.requiredQty, note: data.note || null, createdById: user.id, ...dyeFields } });

      await writeAudit(tx, {
        userId: user.id,
        action: existing ? "MATERIAL_ADJUSTED" : "MATERIAL_ALLOCATED",
        entity: "Order",
        entityId: id,
        newValue: { inventoryItemId: data.inventoryItemId, sku: item.sku, requiredQty: data.requiredQty },
      });
      return material;
    });

    return NextResponse.json({ material: result }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
