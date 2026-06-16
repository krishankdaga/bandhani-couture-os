import { DelayState, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { aggregateOrderDelay, calculateStageDelay } from "@/lib/delay";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await requireUser(request, "production.edit");
  if (isApiError(user)) return user;
  const stages = await prisma.productionStage.findMany({ where: { status: { not: "COMPLETED" } }, include: { pardons: { where: { status: "APPROVED" } } } });
  let changed = 0;
  await prisma.$transaction(async (tx) => {
    for (const stage of stages) {
      const state = calculateStageDelay({ dueDate: stage.dueDate, status: stage.status, hasEverBeenRed: stage.hasEverBeenRed, pardonApproved: stage.pardons.length > 0 });
      if (state !== stage.delayState) {
        await tx.productionStage.update({ where: { id: stage.id }, data: { delayState: state, hasEverBeenRed: stage.hasEverBeenRed || state === DelayState.RED } });
        changed++;
      }
    }
    const orders = await tx.order.findMany({ where: { status: { in: ["CONFIRMED", "IN_PRODUCTION", "READY"] } }, include: { stages: true, pardons: { where: { status: "APPROVED" } } } });
    for (const order of orders) {
      const everRed = order.hasEverBeenRed || order.stages.some((stage) => stage.hasEverBeenRed || stage.delayState === DelayState.RED);
      const state = aggregateOrderDelay(order.stages.map((stage) => stage.delayState), everRed, order.pardons.length > 0);
      await tx.order.update({ where: { id: order.id }, data: { delayState: state, hasEverBeenRed: everRed } });
    }
    await writeAudit(tx, { userId: user.id, action: "RECALCULATE", entity: "DelayState", entityId: "batch", newValue: { changed } });
  });
  return NextResponse.json({ changed });
}
