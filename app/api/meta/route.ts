import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireAnyPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await requireAnyPermission(request, ["leads.view", "customers.view", "orders.view", "production.view"]);
  if (isApiError(user)) return user;
  const [stores, users, customers] = await Promise.all([
    prisma.store.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true, storeId: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({
      where: user.storeId && user.companyStatus !== "OWNER" ? { storeId: user.storeId } : {},
      select: { id: true, name: true, phone: true, store: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return NextResponse.json({ stores, users, customers });
}
