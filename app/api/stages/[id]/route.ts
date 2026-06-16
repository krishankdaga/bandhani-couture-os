import { DelayState, OrderStatus, StageStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { aggregateOrderDelay, calculateStageDelay } from "@/lib/delay";
import { PRODUCTION_WRITE_ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  ownerId: z.string().nullable().optional(), vendorName: z.string().nullable().optional(),
  startDate: z.string().date().nullable().optional(), dueDate: z.string().date().optional(), completionDate: z.string().date().nullable().optional(),
  status: z.nativeEnum(StageStatus).optional(), remarks: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "production.edit");
  if (isApiError(user)) return user;
  try {
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const old = await prisma.productionStage.findUnique({ where: { id }, include: { pardons: { where: { status: "APPROVED" } } } });
    if (!old) return NextResponse.json({ error: "Production stage not found" }, { status: 404 });

    const nextStatus = input.status ?? old.status;
    const dueDate = input.dueDate ? new Date(input.dueDate) : old.dueDate;
    if (Number.isNaN(dueDate.getTime())) throw new Error("Invalid date");
    const delayState = calculateStageDelay({ dueDate, status: nextStatus, hasEverBeenRed: old.hasEverBeenRed, pardonApproved: old.pardons.length > 0 });
    const hasEverBeenRed = old.hasEverBeenRed || delayState === DelayState.RED;
    const completionDate = input.completionDate !== undefined
      ? input.completionDate ? new Date(input.completionDate) : null
      : input.status === StageStatus.COMPLETED ? new Date()
      : input.status !== undefined ? null
      : undefined;

    const stage = await prisma.$transaction(async (tx) => {
      const updated = await tx.productionStage.update({
        where: { id }, data: {
          ownerId: input.ownerId, vendorName: input.vendorName,
          startDate: input.startDate === undefined ? undefined : input.startDate ? new Date(input.startDate) : null,
          dueDate, completionDate,
          status: nextStatus, remarks: input.remarks, delayState, hasEverBeenRed,
        },
      });
      const allStages = await tx.productionStage.findMany({ where: { orderId: old.orderId } });
      const order = await tx.order.findUniqueOrThrow({ where: { id: old.orderId }, include: { pardons: { where: { status: "APPROVED" } } } });
      const orderHasBeenRed = order.hasEverBeenRed || allStages.some((item) => item.hasEverBeenRed);
      const orderDelay = aggregateOrderDelay(allStages.map((item) => item.delayState), orderHasBeenRed, order.pardons.length > 0);
      const allComplete = allStages.every((item) => item.status === StageStatus.COMPLETED);
      await tx.order.update({ where: { id: old.orderId }, data: { delayState: orderDelay, hasEverBeenRed: orderHasBeenRed, status: allComplete ? OrderStatus.READY : OrderStatus.IN_PRODUCTION } });
      await writeAudit(tx, { userId: user.id, action: "UPDATE", entity: "ProductionStage", entityId: id, oldValue: old, newValue: updated });
      return updated;
    });
    return NextResponse.json({ stage });
  } catch (error) { return validationError(error); }
}
