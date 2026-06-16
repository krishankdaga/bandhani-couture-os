import { StockMovementType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BusinessError, isApiError, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { storeScope } from "@/lib/scope";

const schema = z.object({
  quantity: z.coerce.number().positive("Quantity must be greater than zero").max(99_999_999),
  note: z.string().max(300).optional().nullable(),
});

/**
 * Record material consumption against an order allocation.
 * Effects (atomic): consumedQty += qty, inventory quantity -= qty (StockMovement OUT), audit log.
 * Guards: cannot consume more than allocated, nor more than is physically on hand.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; materialId: string }> }) {
  const user = await requireUser(request, "production.edit");
  if (isApiError(user)) return user;
  try {
    const { id, materialId } = await params;
    const order = await prisma.order.findFirst({ where: { id, ...storeScope(user) }, select: { id: true, orderNumber: true } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const data = schema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const material = await tx.orderMaterial.findFirst({ where: { id: materialId, orderId: id }, include: { inventoryItem: true } });
      if (!material) throw new BusinessError("Allocation not found", 404);

      const required = Number(material.requiredQty);
      const consumed = Number(material.consumedQty);
      const remaining = required - consumed;
      if (data.quantity > remaining) throw new BusinessError(`Only ${remaining} ${material.inventoryItem.unit} remain allocated to consume.`);

      const onHand = Number(material.inventoryItem.quantity);
      if (data.quantity > onHand) throw new BusinessError(`Only ${onHand} ${material.inventoryItem.unit} physically in stock.`);

      const updated = await tx.orderMaterial.update({ where: { id: materialId }, data: { consumedQty: { increment: data.quantity } } });
      await tx.inventoryItem.update({ where: { id: material.inventoryItemId }, data: { quantity: { decrement: data.quantity } } });
      await tx.stockMovement.create({
        data: {
          inventoryItemId: material.inventoryItemId,
          type: StockMovementType.OUT,
          quantity: data.quantity,
          reason: `Consumed by order ${order.orderNumber}${data.note ? ` — ${data.note}` : ""}`,
          reference: order.orderNumber,
          createdById: user.id,
        },
      });
      await writeAudit(tx, {
        userId: user.id,
        action: "MATERIAL_CONSUMED",
        entity: "Order",
        entityId: id,
        newValue: { sku: material.inventoryItem.sku, quantity: data.quantity, totalConsumed: Number(updated.consumedQty) },
      });
      return updated;
    });

    return NextResponse.json({ material: result }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
