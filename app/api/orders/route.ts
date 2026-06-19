import { OrderStatus, Priority, ProductionStageType, StageStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireAnyPermission, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { ORDER_WRITE_ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const STAGES = Object.values(ProductionStageType);
const customMeasurementSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
  notes: z.string().optional(),
});

const measurementsSchema = z.object({ _custom: z.array(customMeasurementSchema).optional() }).catchall(z.string());

const schema = z.object({
  customerId: z.string().min(1), stylistId: z.string().min(1), storeId: z.string().min(1),
  productionManagerId: z.string().min(1).optional().nullable(),
  orderValue: z.coerce.number().positive(), measurements: measurementsSchema,
  customisations: z.array(z.string()).default([]), referenceImages: z.array(z.string().url()).default([]),
  priority: z.nativeEnum(Priority).default(Priority.NORMAL), deliveryDate: z.string().date(),
  stageOwners: z.record(z.string(), z.string()).default({}), stageVendors: z.record(z.string(), z.string()).default({}),
  // Optional advance captured at order creation — recorded as the first ADVANCE payment.
  advanceAmount: z.coerce.number().positive().max(99_999_999).optional().nullable(),
  advanceMethod: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"]).default("CASH"),
});

function stageSchedule(deliveryDate: Date) {
  const start = new Date();
  const available = Math.max(deliveryDate.getTime() - start.getTime(), 6 * 24 * 60 * 60 * 1000);
  return STAGES.map((type, index) => ({
    type, sequence: index + 1,
    dueDate: new Date(start.getTime() + available * ((index + 1) / STAGES.length)),
    status: index === 0 ? StageStatus.IN_PROGRESS : StageStatus.NOT_STARTED,
    startDate: index === 0 ? start : null,
  }));
}

export async function GET(request: NextRequest) {
  const user = await requireAnyPermission(request, ["orders.view", "production.view"]);
  if (isApiError(user)) return user;
  const orders = await prisma.order.findMany({
    where: user.storeId && !["OWNER", "PARTNER"].includes(user.role) ? { storeId: user.storeId } : {},
    include: { customer: { select: { id: true, name: true, phone: true } }, stylist: { select: { id: true, name: true } }, productionManager: { select: { id: true, name: true } }, stages: { include: { owner: { select: { id: true, name: true } }, pardons: { include: { requestedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } } }, orderBy: { sequence: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ orders });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request, "orders.create");
  if (isApiError(user)) return user;
  try {
    const data = schema.parse(await request.json());
    const deliveryDate = new Date(data.deliveryDate);
    if (deliveryDate <= new Date()) throw new Error("Delivery date must be in the future");
    const order = await prisma.$transaction(async (tx) => {
      const [customer, stylist, store] = await Promise.all([
        tx.customer.findUnique({ where: { id: data.customerId } }),
        tx.user.findUnique({ where: { id: data.stylistId } }),
        tx.store.findUnique({ where: { id: data.storeId } }),
      ]);
      if (!customer || !store) throw new Error("A selected related record is invalid");
      if (!stylist || stylist.role !== "STYLIST" || !stylist.active) throw new Error("Select an active stylist");
      // Customers are shared across stores, so an order may be placed at any
      // store regardless of where the customer was first registered.
      if (data.productionManagerId) {
        const manager = await tx.user.findUnique({ where: { id: data.productionManagerId } });
        if (!manager || manager.role !== "PRODUCTION_MANAGER" || !manager.active) throw new Error("Select an active production manager");
      }
      // Short, professional token number the owner/customer can quote easily: BD-1001, BD-1002, …
      // Counts only the BD- series so it starts cleanly at 1001 and is never zero-padded.
      const count = await tx.order.count({ where: { orderNumber: { startsWith: "BD-" } } });
      const orderNumber = `BD-${1001 + count}`;
      const created = await tx.order.create({
        data: {
          orderNumber, customerId: data.customerId, stylistId: data.stylistId, storeId: data.storeId,
          productionManagerId: data.productionManagerId || null,
          orderValue: data.orderValue, measurements: data.measurements, customisations: data.customisations,
          referenceImages: data.referenceImages, priority: data.priority, deliveryDate, status: OrderStatus.IN_PRODUCTION,
          stages: { create: stageSchedule(deliveryDate).map((stage) => ({ ...stage, ownerId: data.stageOwners[stage.type] || null, vendorName: data.stageVendors[stage.type] || null })) },
        },
        include: { stages: { orderBy: { sequence: "asc" } } },
      });
      // Save the captured measurements onto the customer profile so they pre-fill
      // future orders and show on the customer page.
      await tx.customer.update({ where: { id: data.customerId }, data: { measurements: data.measurements } });
      // Record the advance taken at booking, if any, as the order's first payment.
      if (data.advanceAmount && data.advanceAmount > 0) {
        await tx.orderPayment.create({
          data: { orderId: created.id, amount: data.advanceAmount, method: data.advanceMethod, kind: "ADVANCE", note: "Advance received at order creation", recordedById: user.id },
        });
        await writeAudit(tx, { userId: user.id, action: "PAYMENT_ADDED", entity: "Order", entityId: created.id, newValue: { amount: data.advanceAmount, method: data.advanceMethod, kind: "ADVANCE" } });
      }
      await writeAudit(tx, { userId: user.id, action: "CREATE", entity: "Order", entityId: created.id, newValue: created });
      return created;
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) { return validationError(error); }
}
