import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireAnyPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await requireAnyPermission(request, ["leads.view", "customers.view", "orders.view", "production.view"]);
  if (isApiError(user)) return user;
  const [stores, users, customers] = await Promise.all([
    prisma.store.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true, storeId: true }, orderBy: { name: "asc" } }),
    // Customers are shared across stores, so the picker lists every customer
    // (with their saved measurements to pre-fill the new-order form). Fall back
    // to the latest non-cancelled order's measurements for customers registered
    // before measurements were saved on the profile.
    prisma.customer.findMany({
      select: {
        id: true, name: true, phone: true, measurements: true,
        store: { select: { name: true } },
        orders: { where: { status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" }, take: 1, select: { measurements: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const customerList = customers.map(({ orders, ...c }) => ({
    ...c,
    measurements: c.measurements ?? orders[0]?.measurements ?? null,
  }));
  return NextResponse.json({ stores, users, customers: customerList });
}
