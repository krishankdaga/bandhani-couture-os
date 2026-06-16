import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
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
