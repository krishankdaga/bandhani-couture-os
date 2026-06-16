import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { storeScope } from "@/lib/scope";

const schema = z.object({
  amount: z.number().positive("Enter an amount greater than zero").max(99_999_999),
  method: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"]).default("CASH"),
  kind: z.enum(["ADVANCE", "PARTIAL", "FINAL", "REFUND"]).default("ADVANCE"),
  note: z.string().max(300).optional().nullable(),
  paidAt: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "orders.view");
  if (isApiError(user)) return user;
  const { id } = await params;
  const order = await prisma.order.findFirst({ where: { id, ...storeScope(user) }, select: { id: true, orderValue: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const payments = await prisma.orderPayment.findMany({
    where: { orderId: id },
    include: { recordedBy: { select: { name: true } } },
    orderBy: { paidAt: "desc" },
  });
  return NextResponse.json({ payments, orderValue: order.orderValue });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "orders.edit");
  if (isApiError(user)) return user;
  try {
    const { id } = await params;
    const order = await prisma.order.findFirst({ where: { id, ...storeScope(user) }, select: { id: true } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const data = schema.parse(await request.json());
    const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) throw new Error("Invalid date");
    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.orderPayment.create({
        data: { orderId: id, amount: data.amount, method: data.method, kind: data.kind, note: data.note || null, paidAt, recordedById: user.id },
        include: { recordedBy: { select: { name: true } } },
      });
      await writeAudit(tx, { userId: user.id, action: "PAYMENT_ADDED", entity: "Order", entityId: id, newValue: { amount: data.amount, method: data.method, kind: data.kind } });
      return created;
    });
    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    return validationError(error);
  }
}
