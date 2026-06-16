import { NextRequest } from "next/server";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { csvResponse, toCsv } from "@/lib/csv";
import { dateRangeScope } from "@/lib/report-filters";
import { prisma } from "@/lib/prisma";
import { resolveStoreScope } from "@/lib/scope";

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "customers.view"); if (isApiError(user)) return user;
  try {
    const url = new URL(request.url);
    const where = { ...resolveStoreScope(user, url.searchParams.get("storeId")), ...dateRangeScope(url.searchParams.get("dateFrom"), url.searchParams.get("dateTo")) };
    const rows = await prisma.customer.findMany({ where, include: { store: true, _count: { select: { orders: true } } }, orderBy: { name: "asc" } });
    return csvResponse("bandhani-customers.csv", toCsv(["Name", "Phone", "Email", "Address", "Store", "Orders", "Created At"], rows.map((item) => [item.name, item.phone, item.email, item.address, item.store.name, item._count.orders, item.createdAt])));
  } catch (error) {
    return validationError(error);
  }
}
