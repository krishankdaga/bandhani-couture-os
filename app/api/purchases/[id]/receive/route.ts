import { PurchaseStatus, StockMovementType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { PURCHASE_ROLES } from "@/lib/phase2-permissions";
import { prisma } from "@/lib/prisma";
import { optionalStoreScope } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";

const receiveLineSchema = z.object({
  purchaseLineId: z.string(),
  sku: z.string().min(2),
  category: z.enum(["FABRIC", "FINISHED_GOOD", "ACCESSORY", "PACKAGING", "OTHER"]).default("OTHER"),
});

const schema = z.object({
  lines: z.array(receiveLineSchema).min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(request, "purchases.receive");
  if (isApiError(user)) return user;

  try {
    const { id } = await params;
    const data = schema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id, ...optionalStoreScope(user) },
        include: { lines: true },
      });

      if (!purchase) {
        throw new Error("Purchase not found");
      }

      if (purchase.status === PurchaseStatus.RECEIVED) {
        throw new Error("Purchase already received");
      }

      for (const receiveLine of data.lines) {
        const line = purchase.lines.find((l) => l.id === receiveLine.purchaseLineId);

        if (!line) {
          throw new Error("Invalid purchase line");
        }

        const existingItem = await tx.inventoryItem.findUnique({
          where: { sku: receiveLine.sku },
        });

        let item;

        if (existingItem) {
          item = await tx.inventoryItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: Number(existingItem.quantity) + Number(line.quantity),
              costPrice: line.rate,
            },
          });
        } else {
          item = await tx.inventoryItem.create({
            data: {
              sku: receiveLine.sku,
              name: line.itemName,
              category: receiveLine.category,
              storeId: purchase.storeId,
              quantity: line.quantity,
              unit: line.unit,
              costPrice: line.rate,
              notes: `Created from purchase ${purchase.purchaseNo}`,
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            inventoryItemId: item.id,
            type: StockMovementType.IN,
            quantity: line.quantity,
            reason: "Purchase received",
            reference: purchase.purchaseNo,
            createdById: user.id,
          },
        });
      }

      const updatedPurchase = await tx.purchase.update({
        where: { id },
        data: {
          status: PurchaseStatus.RECEIVED,
          receivedDate: new Date(),
        },
        include: { lines: true },
      });
      await writeAudit(tx, { userId: user.id, action: "RECEIVE", entity: "Purchase", entityId: id, oldValue: purchase, newValue: updatedPurchase });

      return updatedPurchase;
    });

    return NextResponse.json({ purchase: result });
  } catch (error) {
    return validationError(error);
  }
}
