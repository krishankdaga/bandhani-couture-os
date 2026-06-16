import { InventoryCategory } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { INVENTORY_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";
import { optionalStoreScope } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  sku: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  category: z.nativeEnum(InventoryCategory).optional(),
  storeId: z.string().optional().nullable(),
  unit: z.string().optional(),
  reorderAt: z.coerce.number().optional().nullable(),
  costPrice: z.coerce.number().optional().nullable(),
  sellingPrice: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(request, "inventory.edit");
  if (isApiError(user)) return user;

  try {
    const { id } = await params;
    const data = schema.parse(await request.json());
    const existing = await prisma.inventoryItem.findFirst({ where: { id, ...optionalStoreScope(user) } });
    if (!existing) throw new Error("Inventory item not found");
    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryItem.update({ where: { id }, data, include: {
        movements: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      } });
      await writeAudit(tx, { userId: user.id, action: "UPDATE", entity: "InventoryItem", entityId: id, oldValue: existing, newValue: updated });
      return updated;
    });

    return NextResponse.json({ item });
  } catch (error) {
    return validationError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(request, "inventory.delete");
  if (isApiError(user)) return user;

  try {
    const { id } = await params;
    const existing = await prisma.inventoryItem.findFirst({ where: { id, ...optionalStoreScope(user) } });
    if (!existing) throw new Error("Inventory item not found");
    await prisma.$transaction(async (tx) => {
      await writeAudit(tx, { userId: user.id, action: "DELETE", entity: "InventoryItem", entityId: id, oldValue: existing });
      await tx.inventoryItem.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return validationError(error);
  }
}
