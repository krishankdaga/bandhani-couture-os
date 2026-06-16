import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { storeScope } from "@/lib/scope";

/** Non-owners request deletion; owner sees a notification and can approve by deleting. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "orders.edit");
  if (isApiError(user)) return user;
  const { id } = await context.params;
  const order = await prisma.order.findFirst({ where: { id, ...storeScope(user) } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  await writeAudit(prisma, {
    userId: user.id,
    action: "DELETE_REQUESTED",
    entity: "Order",
    entityId: id,
    newValue: { orderNumber: order.orderNumber, requestedBy: user.name ?? user.id },
  });
  return NextResponse.json({ ok: true });
}
