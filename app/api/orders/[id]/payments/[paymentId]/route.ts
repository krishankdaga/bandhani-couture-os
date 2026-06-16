import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { storeScope } from "@/lib/scope";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const user = await requireUser(request, "orders.edit");
  if (isApiError(user)) return user;
  try {
    const { id, paymentId } = await params;
    const order = await prisma.order.findFirst({ where: { id, ...storeScope(user) }, select: { id: true } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const payment = await prisma.orderPayment.findFirst({ where: { id: paymentId, orderId: id } });
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await tx.orderPayment.delete({ where: { id: paymentId } });
      await writeAudit(tx, { userId: user.id, action: "PAYMENT_DELETED", entity: "Order", entityId: id, oldValue: { amount: payment.amount, method: payment.method } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return validationError(error);
  }
}
