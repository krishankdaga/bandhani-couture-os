import { NextRequest } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { csvResponse, toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { storeScope } from "@/lib/scope";

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "customers.view"); if (isApiError(user)) return user;
  const rows = await prisma.customer.findMany({ where: storeScope(user), include: { store: true, _count: { select: { orders: true } } }, orderBy: { name: "asc" } });
  return csvResponse("bandhani-customers.csv", toCsv(["Name", "Phone", "Email", "Address", "Store", "Orders", "Created At"], rows.map((item) => [item.name, item.phone, item.email, item.address, item.store.name, item._count.orders, item.createdAt])));
}
