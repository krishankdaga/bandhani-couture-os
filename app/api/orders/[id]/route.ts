import { Priority } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { storeScope } from "@/lib/scope";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "orders.view");
  if (isApiError(user)) return user;
  const { id } = await context.params;
  const order = await prisma.order.findFirst({
    where: { id, ...storeScope(user) },
    include: { customer: true, stylist: { select: { id: true, name: true } }, store: true, stages: { include: { owner: { select: { id: true, name: true } }, pardons: { include: { requestedBy: { select: { name: true } }, reviewedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } } }, orderBy: { sequence: "asc" } }, pardons: { orderBy: { createdAt: "desc" } } },
  });
  return order ? NextResponse.json({ order }) : NextResponse.json({ error: "Order not found" }, { status: 404 });
}

const editSchema = z.object({
  stylistId: z.string().min(1).optional(),
  orderValue: z.coerce.number().positive().optional(),
  priority: z.nativeEnum(Priority).optional(),
  deliveryDate: z.string().date().optional(),
  measurements: z.record(z.string(), z.string()).optional(),
  customisations: z.array(z.string()).optional(),
  referenceImages: z.array(z.string().url()).optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "orders.edit");
  if (isApiError(user)) return user;
  const { id } = await context.params;
  try {
    const data = editSchema.parse(await request.json());
    if (data.deliveryDate) {
      const d = new Date(data.deliveryDate);
      if (d <= new Date()) throw new Error("Delivery date must be in the future");
    }
    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({ where: { id, ...storeScope(user) } });
      if (!existing) throw new Error("Order not found");
      if (data.stylistId) {
        const stylist = await tx.user.findUnique({ where: { id: data.stylistId } });
        if (!stylist || stylist.role !== "STYLIST" || !stylist.active) throw new Error("Select an active stylist");
      }
      const updated = await tx.order.update({
        where: { id },
        data: {
          ...(data.stylistId && { stylistId: data.stylistId }),
          ...(data.orderValue !== undefined && { orderValue: data.orderValue }),
          ...(data.priority && { priority: data.priority }),
          ...(data.deliveryDate && { deliveryDate: new Date(data.deliveryDate) }),
          ...(data.measurements && { measurements: data.measurements }),
          ...(data.customisations !== undefined && { customisations: data.customisations }),
          ...(data.referenceImages !== undefined && { referenceImages: data.referenceImages }),
        },
        include: { customer: true, stylist: { select: { id: true, name: true } }, store: true, stages: { orderBy: { sequence: "asc" } } },
      });
      await writeAudit(tx, { userId: user.id, action: "UPDATE", entity: "Order", entityId: id, oldValue: existing, newValue: updated });
      return updated;
    });
    return NextResponse.json({ order });
  } catch (error) {
    return validationError(error);
  }
}
