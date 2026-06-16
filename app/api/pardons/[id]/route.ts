import { DelayState, PardonStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireOwner, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({ status: z.enum([PardonStatus.APPROVED, PardonStatus.REJECTED]) });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireOwner(request);
  if (isApiError(user)) return user;
  try {
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const old = await prisma.delayPardon.findUnique({ where: { id } });
    if (!old) return NextResponse.json({ error: "Pardon request not found" }, { status: 404 });
    if (old.status !== PardonStatus.REQUESTED) return NextResponse.json({ error: "This request has already been reviewed" }, { status: 409 });

    const pardon = await prisma.$transaction(async (tx) => {
      const updated = await tx.delayPardon.update({ where: { id }, data: { status: input.status, reviewedById: user.id, reviewedAt: new Date() } });
      // Approval reduces red to yellow, never green. Rejection preserves red.
      if (input.status === PardonStatus.APPROVED && old.stageId) {
        const stage = await tx.productionStage.update({ where: { id: old.stageId }, data: { delayState: DelayState.YELLOW, hasEverBeenRed: true } });
        const stages = await tx.productionStage.findMany({ where: { orderId: stage.orderId } });
        await tx.order.update({
          where: { id: stage.orderId },
          data: {
            delayState: stages.some((item) => item.delayState === DelayState.RED) ? DelayState.RED : DelayState.YELLOW,
            hasEverBeenRed: true,
          },
        });
      }
      if (input.status === PardonStatus.APPROVED && old.orderId) await tx.order.update({ where: { id: old.orderId }, data: { delayState: DelayState.YELLOW, hasEverBeenRed: true } });
      await writeAudit(tx, { userId: user.id, action: `PARDON_${input.status}`, entity: "DelayPardon", entityId: id, oldValue: old, newValue: updated });
      return updated;
    });
    return NextResponse.json({ pardon });
  } catch (error) { return validationError(error); }
}
