import { Priority } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireOwner, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { storeScope } from "@/lib/scope";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "orders.view");
  if (isApiError(user)) return user;
  const { id } = await context.params;
  const order = await prisma.order.findFirst({
    where: { id, ...storeScope(user) },
    include: { customer: true, stylist: { select: { id: true, name: true } }, productionManager: { select: { id: true, name: true } }, store: true, stages: { include: { owner: { select: { id: true, name: true } }, pardons: { include: { requestedBy: { select: { name: true } }, reviewedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } } }, orderBy: { sequence: "asc" } }, pardons: { orderBy: { createdAt: "desc" } } },
  });
  return order ? NextResponse.json({ order }) : NextResponse.json({ error: "Order not found" }, { status: 404 });
}

const customMeasurementSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
  notes: z.string().optional(),
});

const editSchema = z.object({
  stylistId: z.string().min(1).optional(),
  productionManagerId: z.string().min(1).nullable().optional(),
  orderValue: z.coerce.number().positive().optional(),
  priority: z.nativeEnum(Priority).optional(),
  deliveryDate: z.string().date().optional(),
  measurements: z.object({ _custom: z.array(customMeasurementSchema).optional() }).catchall(z.string()).optional(),
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
      if (data.productionManagerId) {
        const manager = await tx.user.findUnique({ where: { id: data.productionManagerId } });
        if (!manager || manager.role !== "PRODUCTION_MANAGER" || !manager.active) throw new Error("Select an active production manager");
      }
      const updated = await tx.order.update({
        where: { id },
        data: {
          ...(data.stylistId && { stylistId: data.stylistId }),
          ...(data.productionManagerId !== undefined && { productionManagerId: data.productionManagerId || null }),
          ...(data.orderValue !== undefined && { orderValue: data.orderValue }),
          ...(data.priority && { priority: data.priority }),
          ...(data.deliveryDate && { deliveryDate: new Date(data.deliveryDate) }),
          ...(data.measurements && { measurements: data.measurements }),
          ...(data.customisations !== undefined && { customisations: data.customisations }),
          ...(data.referenceImages !== undefined && { referenceImages: data.referenceImages }),
        },
        include: { customer: true, stylist: { select: { id: true, name: true } }, store: true, stages: { orderBy: { sequence: "asc" } } },
      });
      // Keep the customer's saved measurements in sync with their latest order edit.
      if (data.measurements) await tx.customer.update({ where: { id: updated.customerId }, data: { measurements: data.measurements } });
      await writeAudit(tx, { userId: user.id, action: "UPDATE", entity: "Order", entityId: id, oldValue: existing, newValue: updated });
      return updated;
    });
    return NextResponse.json({ order });
  } catch (error) {
    return validationError(error);
  }
}

/** Owner-only hard delete — deletes the order and all child records (cascade). */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireOwner(request);
  if (isApiError(user)) return user;
  const { id } = await context.params;
  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await writeAudit(tx, { userId: user.id, action: "DELETE", entity: "Order", entityId: id, oldValue: order });
      // Delete child records that have no cascade
      await tx.orderPayment.deleteMany({ where: { orderId: id } });
      await tx.orderMaterial.deleteMany({ where: { orderId: id } });
      await tx.delayPardon.deleteMany({ where: { orderId: id } });
      await tx.productionStage.deleteMany({ where: { orderId: id } });
      await tx.order.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return validationError(error);
  }
}
