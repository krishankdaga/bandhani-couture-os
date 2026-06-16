import { NextRequest } from "next/server";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { csvResponse, toCsv } from "@/lib/csv";
import { dateRangeScope } from "@/lib/report-filters";
import { prisma } from "@/lib/prisma";
import { resolveOptionalStoreScope } from "@/lib/scope";

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "purchases.view"); if (isApiError(user)) return user;
  try {
    const url = new URL(request.url);
    const where = { ...resolveOptionalStoreScope(user, url.searchParams.get("storeId")), ...dateRangeScope(url.searchParams.get("dateFrom"), url.searchParams.get("dateTo")) };
    const rows = await prisma.purchase.findMany({ where, include: { lines: true }, orderBy: { createdAt: "desc" } });
    return csvResponse("bandhani-purchases.csv", toCsv(["Purchase No", "Vendor", "Status", "Items", "Total Amount", "Expected Date", "Received Date", "Store ID", "Created At"], rows.map((item) => [item.purchaseNo, item.vendorName, item.status, item.lines.map((line) => `${line.itemName} (${line.quantity} ${line.unit})`).join("; "), item.totalAmount, item.expectedDate, item.receivedDate, item.storeId, item.createdAt])));
  } catch (error) {
    return validationError(error);
  }
}
