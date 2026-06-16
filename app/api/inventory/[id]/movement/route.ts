
import { StockMovementType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { INVENTORY_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { optionalStoreScope } from "@/lib/scope";

const schema = z.object({
  type: z.nativeEnum(StockMovementType),
  quantity: z.coerce.number().positive(),
  reason: z.string().min(2),
  reference: z.string().optional().nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "inventory.movement");
  if (isApiError(user)) return user;

  try {
    const { id } = await params;
    const data = schema.parse(await request.json());

    const item = await prisma.$transaction(async (tx) => {
      const current = await tx.inventoryItem.findFirst({ where: { id, ...optionalStoreScope(user) } });
      if (!current) throw new Error("Inventory item not found");
      const delta = data.type === "OUT" ? -data.quantity : data.quantity;

      await tx.stockMovement.create({
        data: {
          inventoryItemId: id,
          type: data.type,
          quantity: data.quantity,
          reason: data.reason,
          reference: data.reference,
          createdById: user.id,
        },
      });

      const updated = await tx.inventoryItem.update({
        where: { id },
        data: { quantity: Number(current.quantity) + delta },
        include: { movements: { orderBy: { createdAt: "desc" }, take: 5 } },
      });
      await writeAudit(tx, { userId: user.id, action: "MOVEMENT", entity: "InventoryItem", entityId: id, oldValue: current, newValue: updated, metadata: data });
      return updated;
    });

    return NextResponse.json({ item });
  } catch (error) {
    return validationError(error);
  }
}
