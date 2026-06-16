import { DelayState, PardonStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({ orderId: z.string().optional(), stageId: z.string().optional(), reason: z.string().min(10) }).refine((value) => Boolean(value.orderId) !== Boolean(value.stageId), "Provide either orderId or stageId");

export async function POST(request: NextRequest) {
  const user = await requireUser(request, "production.edit");
  if (isApiError(user)) return user;
  try {
    const data = schema.parse(await request.json());
    const pardon = await prisma.$transaction(async (tx) => {
      if (data.stageId) {
        const stage = await tx.productionStage.findUnique({ where: { id: data.stageId } });
        if (!stage) throw new Error("Production stage not found");
        if (stage.delayState !== DelayState.RED) throw new Error("A pardon can only be requested for a delayed stage");
      }
      if (data.orderId) {
        const order = await tx.order.findUnique({ where: { id: data.orderId } });
        if (!order) throw new Error("Order not found");
        if (order.delayState !== DelayState.RED) throw new Error("A pardon can only be requested for a delayed order");
      }
      const existing = await tx.delayPardon.findFirst({ where: { orderId: data.orderId, stageId: data.stageId, status: PardonStatus.REQUESTED } });
      if (existing) throw new Error("A pardon request is already pending");
      const created = await tx.delayPardon.create({ data: { orderId: data.orderId, stageId: data.stageId, reason: data.reason, requestedById: user.id } });
      await writeAudit(tx, { userId: user.id, action: "REQUEST_PARDON", entity: "DelayPardon", entityId: created.id, newValue: created });
      return created;
    });
    return NextResponse.json({ pardon }, { status: 201 });
  } catch (error) { return validationError(error); }
}
