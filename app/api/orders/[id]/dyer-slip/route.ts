import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { storeScope } from "@/lib/scope";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request, "orders.view");
  if (isApiError(user)) return user;
  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, ...storeScope(user) },
    include: {
      customer: { select: { name: true, phone: true } },
      store: { select: { name: true } },
      stylist: { select: { name: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const rawMaterials = await prisma.orderMaterial.findMany({
    where: { orderId: id },
    include: { inventoryItem: { select: { name: true, sku: true, unit: true, category: true } } },
    orderBy: [{ inventoryItem: { category: "asc" } }, { createdAt: "asc" }],
  });

  const slip = {
    order: {
      orderNumber: order.orderNumber,
      priority: order.priority,
      deliveryDate: order.deliveryDate,
      status: order.status,
      customisations: Array.isArray(order.customisations) ? order.customisations : [],
      customer: order.customer,
      store: order.store,
      stylist: order.stylist,
    },
    materials: rawMaterials.map((m) => ({
      name: m.inventoryItem.name,
      sku: m.inventoryItem.sku,
      unit: m.inventoryItem.unit,
      category: m.inventoryItem.category,
      requiredQty: Number(m.requiredQty),
      note: m.note,
      dyeColour: m.dyeColour,
      dyeInstructions: m.dyeInstructions,
    })),
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json({ slip });
}
