import { NextRequest } from "next/server";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { csvResponse, toCsv } from "@/lib/csv";
import { getEmployeePerformance } from "@/lib/employee-performance";

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "reports.export");
  if (isApiError(user)) return user;
  try {
    const params = new URL(request.url).searchParams;
    const rows = await getEmployeePerformance(user, {
      storeId: params.get("storeId"),
      role: params.get("role"),
      dateFrom: params.get("dateFrom"),
      dateTo: params.get("dateTo"),
      search: params.get("search"),
    });
    return csvResponse(
      "bandhani-employee-performance.csv",
      toCsv(
        ["Employee", "Email", "Role", "Store", "Activity", "Leads Handled", "Conversions", "Purchases Handled", "Inventory Movements", "Incentive Amount"],
        rows.map((row) => [row.name, row.email, row.companyRoleName ?? row.role.replaceAll("_", " "), row.storeName ?? "All / unassigned", row.activityCount, row.leadsHandled, row.conversions, row.purchasesHandled, row.inventoryMovements, row.incentiveAmount]),
      ),
    );
  } catch (error) {
    return validationError(error);
  }
}
