import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { storeScope } from "@/lib/scope";

const editSchema = z.object({
  amount: z.number().positive("Enter an amount greater than zero").max(99_999_999),
  method: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"]),
  kind: z.enum(["ADVANCE", "PARTIAL", "FINAL", "REFUND"]),
  note: z.string().max(300).optional().nullable(),
  paidAt: z.string().optional(),
});

// Correct a mis-entered payment without deleting and re-adding it.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const user = await requireUser(request, "orders.edit");
  if (isApiError(user)) return user;
  try {
    const { id, paymentId } = await params;
    const order = await prisma.order.findFirst({ where: { id, ...storeScope(user) }, select: { id: true } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const existing = await prisma.orderPayment.findFirst({ where: { id: paymentId, orderId: id } });
    if (!existing) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    const data = editSchema.parse(await request.json());
    const paidAt = data.paidAt ? new Date(data.paidAt) : existing.paidAt;
    if (Number.isNaN(paidAt.getTime())) throw new Error("Invalid date");
    const payment = await prisma.$transaction(async (tx) => {
      const updated = await tx.orderPayment.update({
        where: { id: paymentId },
        data: { amount: data.amount, method: data.method, kind: data.kind, note: data.note || null, paidAt },
        include: { recordedBy: { select: { name: true } } },
      });
      await writeAudit(tx, { userId: user.id, action: "PAYMENT_UPDATED", entity: "Order", entityId: id, oldValue: { amount: existing.amount, method: existing.method, kind: existing.kind, paidAt: existing.paidAt }, newValue: { amount: data.amount, method: data.method, kind: data.kind, paidAt } });
      return updated;
    });
    return NextResponse.json({ payment });
  } catch (error) {
    return validationError(error);
  }
}

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
