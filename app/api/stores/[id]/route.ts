import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireOwner, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().min(2).max(100),
  location: z.string().max(200).optional().nullable(),
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "settings.view");
  if (isApiError(user)) return user;
  const { id } = await context.params;

  const [store, employees, orders] = await Promise.all([
    prisma.store.findUnique({ where: { id } }),
    prisma.user.findMany({
      where: { storeId: id, active: true },
      select: { id: true, name: true, email: true, role: true, companyStatus: true, companyRole: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.order.findMany({
      where: { storeId: id },
      select: { id: true, orderValue: true, status: true, delayState: true, payments: { select: { amount: true, kind: true } } },
    }),
  ]);

  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.orderValue), 0);
  const totalCollected = orders.reduce((sum, o) => sum + o.payments.filter((p) => p.kind !== "REFUND").reduce((s, p) => s + Number(p.amount), 0), 0);
  const activeOrders = orders.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status)).length;
  const deliveredOrders = orders.filter((o) => o.status === "DELIVERED").length;

  return NextResponse.json({
    store,
    employees,
    performance: {
      totalOrders: orders.length,
      activeOrders,
      deliveredOrders,
      totalRevenue,
      totalCollected,
      outstanding: totalRevenue - totalCollected,
    },
  });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireOwner(request);
  if (isApiError(user)) return user;
  const { id } = await context.params;
  try {
    const data = patchSchema.parse(await request.json());
    const store = await prisma.$transaction(async (tx) => {
      const existing = await tx.store.findUnique({ where: { id } });
      if (!existing) throw new Error("Store not found");
      const updated = await tx.store.update({ where: { id }, data: { name: data.name, location: data.location ?? null } });
      await writeAudit(tx, { userId: user.id, action: "UPDATE", entity: "Store", entityId: id, oldValue: existing, newValue: updated });
      return updated;
    });
    return NextResponse.json({ store });
  } catch (error) {
    return validationError(error);
  }
}
