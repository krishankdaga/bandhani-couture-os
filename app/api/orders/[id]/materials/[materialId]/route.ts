import { NextRequest, NextResponse } from "next/server";
import { BusinessError, isApiError, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { storeScope } from "@/lib/scope";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; materialId: string }> }) {
  const user = await requireUser(request, "orders.edit");
  if (isApiError(user)) return user;
  try {
    const { id, materialId } = await params;
    const order = await prisma.order.findFirst({ where: { id, ...storeScope(user) }, select: { id: true } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const material = await prisma.orderMaterial.findFirst({ where: { id: materialId, orderId: id }, include: { inventoryItem: { select: { sku: true } } } });
    if (!material) return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
    if (Number(material.consumedQty) > 0) throw new BusinessError("Cannot remove an allocation that has already been consumed. Adjust the quantity instead.");

    await prisma.$transaction(async (tx) => {
      await tx.orderMaterial.delete({ where: { id: materialId } });
      await writeAudit(tx, { userId: user.id, action: "MATERIAL_DEALLOCATED", entity: "Order", entityId: id, oldValue: { sku: material.inventoryItem.sku, requiredQty: material.requiredQty } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return validationError(error);
  }
}
