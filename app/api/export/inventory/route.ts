import { NextRequest } from "next/server";
import { isApiError, requireUser } from "@/lib/api";
import { csvResponse, toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { optionalStoreScope } from "@/lib/scope";

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "inventory.view"); if (isApiError(user)) return user;
  const rows = await prisma.inventoryItem.findMany({ where: optionalStoreScope(user), orderBy: { sku: "asc" } });
  return csvResponse("bandhani-inventory.csv", toCsv(["SKU", "Name", "Category", "Quantity", "Unit", "Reorder At", "Cost Price", "Selling Price", "Store ID", "Notes"], rows.map((item) => [item.sku, item.name, item.category, item.quantity, item.unit, item.reorderAt, item.costPrice, item.sellingPrice, item.storeId, item.notes])));
}
