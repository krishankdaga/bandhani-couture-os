import { OrderStatus, Priority, ProductionStageType, StageStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireAnyPermission, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { ORDER_WRITE_ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const STAGES = Object.values(ProductionStageType);
const schema = z.object({
  customerId: z.string().min(1), stylistId: z.string().min(1), storeId: z.string().min(1),
  orderValue: z.coerce.number().positive(), measurements: z.record(z.string(), z.string()),
  customisations: z.array(z.string()).default([]), referenceImages: z.array(z.string().url()).default([]),
  priority: z.nativeEnum(Priority).default(Priority.NORMAL), deliveryDate: z.string().date(),
  stageOwners: z.record(z.string(), z.string()).default({}), stageVendors: z.record(z.string(), z.string()).default({}),
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
    include: { customer: { select: { id: true, name: true, phone: true } }, stylist: { select: { id: true, name: true } }, stages: { include: { owner: { select: { id: true, name: true } }, pardons: { include: { requestedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } } }, orderBy: { sequence: "asc" } } },
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
      if (customer.storeId !== data.storeId) throw new Error("Customer and order must belong to the same store");
      const count = await tx.order.count();
      const orderNumber = `BD-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;
      const created = await tx.order.create({
        data: {
          orderNumber, customerId: data.customerId, stylistId: data.stylistId, storeId: data.storeId,
          orderValue: data.orderValue, measurements: data.measurements, customisations: data.customisations,
          referenceImages: data.referenceImages, priority: data.priority, deliveryDate, status: OrderStatus.IN_PRODUCTION,
          stages: { create: stageSchedule(deliveryDate).map((stage) => ({ ...stage, ownerId: data.stageOwners[stage.type] || null, vendorName: data.stageVendors[stage.type] || null })) },
        },
        include: { stages: { orderBy: { sequence: "asc" } } },
      });
      await writeAudit(tx, { userId: user.id, action: "CREATE", entity: "Order", entityId: created.id, newValue: created });
      return created;
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) { return validationError(error); }
}
